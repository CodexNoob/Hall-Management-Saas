import { NextResponse } from "next/server";

import { readDeviceSecret } from "@/lib/auth/device-identity";
import {
  findCurrentDevice,
  sendDeviceConfirmation
} from "@/lib/auth/device-trust";
import { isDeviceTrusted } from "@/lib/auth/device-trust-policy";
import { resolveAccessToken } from "@/lib/auth/identity";
import { maskEmail } from "@/lib/auth/security-codes";
import { readSessionId } from "@/lib/auth/session-record";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * "Send the confirmation again" - for THIS browser, to the account's own
 * address. The per-device 60-second cooldown and the per-person hourly cap
 * apply; the code is never in the response.
 */
export const POST = withRoute(
  "POST /api/me/devices/resend",
  async (request: Request) => {
    try {
      const limited = await enforceRateLimit(request, {
        scope: "device-resend",
        limit: 10,
        windowMs: 15 * 60 * 1000
      });
      if (limited) return limited;

      // Exempt from the device gate - it is how the gate is cleared. Still
      // behind the password and any second factor.
      const actor = await authorizeMember(request, {
        allowUnconfirmedDevice: true
      });
      const userId = requireUserActor(actor);
      const token = await resolveAccessToken(request);
      const sessionId = token ? readSessionId(token) : null;
      const device = await findCurrentDevice(
        prisma,
        userId,
        readDeviceSecret(request)
      );

      if (!sessionId || !device) {
        return NextResponse.json(
          {
            error:
              "This device could not be identified. Reload the page and try again."
          },
          { status: 400 }
        );
      }

      // An expired device needs a code like a new one.
      if (isDeviceTrusted(device, new Date())) {
        return NextResponse.json({ confirmed: true, trusted: true });
      }

      const owner = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, name: true }
      });

      const sent = await sendDeviceConfirmation(prisma, {
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
        return NextResponse.json(
          {
            error:
              "We couldn't send the confirmation email. Try again, or ask your administrator to check the email settings."
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        sentTo: maskEmail(owner.email),
        resendAvailableAt: sent.resendAvailableAt.toISOString()
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
