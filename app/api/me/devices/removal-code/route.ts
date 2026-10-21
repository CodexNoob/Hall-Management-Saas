import { NextResponse } from "next/server";
import { z } from "zod";

import { sendDeviceRemovalCode } from "@/lib/auth/device-trust";
import { resolveAccessToken } from "@/lib/auth/identity";
import { maskEmail } from "@/lib/auth/security-codes";
import { readSessionId } from "@/lib/auth/session-record";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * "Email me a code to remove this device" - the first half of removing a
 * device from the Devices list. Nothing is revoked here.
 *
 * The code goes to the address on the caller's OWN row, never one the request
 * names, and is bound to this session and to the ONE device named here - which
 * must be the caller's own and not already removed. The code itself is in the
 * email and nowhere else: not the response, not a log line.
 *
 * NOT EXEMPT FROM ANY GATE. Only a fully signed-in session - password, the
 * second factor wherever it applies, and a trusted device - can ask. The email
 * code is a confirmation on top of that, never a substitute for it.
 */
const requestSchema = z
  .object({ deviceId: z.string().uuid("Choose a device to remove.") })
  .strict();

export const POST = withRoute(
  "POST /api/me/devices/removal-code",
  async (request: Request) => {
    try {
      // Per address, on top of the per-device cooldown and hourly cap.
      const limited = await enforceRateLimit(request, {
        scope: "device-removal-code",
        limit: 10,
        windowMs: 15 * 60 * 1000
      });
      if (limited) return limited;

      const actor = await authorizeMember(request);
      const userId = requireUserActor(actor);
      const { deviceId } = requestSchema.parse(await request.json());
      const token = await resolveAccessToken(request);
      const sessionId = token ? readSessionId(token) : null;

      // The code is bound to a session; without one there is nothing to bind.
      if (!sessionId) {
        return NextResponse.json(
          { error: "Your session could not be read. Sign in again and retry." },
          { status: 400 }
        );
      }

      // Ownership: scoped by user, so an id belonging to somebody else - or a
      // device already removed - matches nothing and is told so identically.
      const device = await prisma.userDevice.findFirst({
        where: { id: deviceId, userId, revokedAt: null },
        select: { id: true, userAgent: true }
      });

      if (!device) {
        return NextResponse.json(
          { error: "That device was not found." },
          { status: 404 }
        );
      }

      const owner = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, name: true }
      });

      const sent = await sendDeviceRemovalCode(prisma, {
        userId,
        organizationId: actor.organizationId,
        sessionId,
        device,
        owner
      });

      if (sent.status === "throttled") {
        return NextResponse.json(
          {
            error:
              sent.reason === "cooldown"
                ? "Please wait a moment before requesting another code."
                : "Too many codes requested. Try again later.",
            resendAvailableAt: sent.resendAvailableAt.toISOString()
          },
          { status: 429 }
        );
      }

      if (sent.status === "undelivered") {
        // The code was withdrawn; the device stays exactly as it was.
        return NextResponse.json(
          {
            error:
              "We couldn't send the verification email, so the device was not removed. Try again, or ask your administrator to check the email settings."
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        sentTo: maskEmail(owner.email),
        expiresAt: sent.expiresAt.toISOString(),
        resendAvailableAt: sent.resendAvailableAt.toISOString()
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
