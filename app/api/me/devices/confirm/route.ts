import { NextResponse } from "next/server";
import { z } from "zod";

import { readDeviceSecret } from "@/lib/auth/device-identity";
import { confirmDevice, findCurrentDevice } from "@/lib/auth/device-trust";
import { isDeviceTrusted } from "@/lib/auth/device-trust-policy";
import {
  resolveAccessToken,
  resolveAssuranceLevel
} from "@/lib/auth/identity";
import { readSessionId } from "@/lib/auth/session-record";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * "This is my device" - the code from the new-device email, entered on the
 * device itself.
 *
 * Confirms THIS browser only: the device comes from its own httpOnly cookie,
 * never from the request body, and the code is bound to that device and to
 * this session. Five wrong entries kill the code.
 *
 * NOT exempt from the two-factor check. Confirming a device happens after a
 * full sign-in; it adds a confirmation, it does not stand in for one.
 *
 * Exempt from the DEVICE gate, necessarily: it is the route that clears it.
 */
const confirmSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email.")
  })
  .strict();

export const POST = withRoute(
  "POST /api/me/devices/confirm",
  async (request: Request) => {
    try {
      const limited = await enforceRateLimit(request, {
        scope: "device-confirm",
        limit: 30,
        windowMs: 15 * 60 * 1000
      });
      if (limited) return limited;

      const actor = await authorizeMember(request, {
        allowUnconfirmedDevice: true
      });
      const userId = requireUserActor(actor);
      const { code } = confirmSchema.parse(await request.json());
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

      // Trusted, not merely confirmed once: an expired device is confirmed
      // again like a new one.
      if (isDeviceTrusted(device, new Date())) {
        return NextResponse.json({ confirmed: true, trusted: true });
      }

      const result = await confirmDevice(prisma, {
        userId,
        deviceId: device.id,
        sessionId,
        code,
        // Read from the VERIFIED token, never the request body. Only a session
        // that cleared the authenticator makes the device remember it.
        mfaVerified: Boolean(
          token && (await resolveAssuranceLevel(token)) === "aal2"
        )
      });

      switch (result.status) {
        case "verified":
          return NextResponse.json({ confirmed: true, trusted: true });
        case "invalid":
          return NextResponse.json(
            {
              error: "That code is not right. Check the email and try again.",
              attemptsLeft: result.attemptsLeft
            },
            { status: 400 }
          );
        case "locked":
          log.warn({ userId }, "device_confirmation_locked");
          return NextResponse.json(
            {
              error: "Too many incorrect codes. Send a new code and try again."
            },
            { status: 429 }
          );
        case "expired":
        case "missing":
          return NextResponse.json(
            { error: "This code has expired. Send a new one." },
            { status: 410 }
          );
      }
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
