import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAccessToken } from "@/lib/auth/identity";
import {
  issueSecurityCode,
  maskEmail,
  withdrawSecurityCode
} from "@/lib/auth/security-codes";
import { enrollmentCodeEmail, sendSecurityEmail } from "@/lib/auth/security-emails";
import { readRequestIp, readSessionId } from "@/lib/auth/session-record";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * "Email me a code before I set up 2FA."
 *
 * The first half of protected enrolment: the code goes to the address on the
 * caller's OWN row - never one the request names - and a correct code becomes
 * the grant that lets a new authenticator be trusted
 * (lib/auth/security-codes.ts, lib/auth/mfa-trust.ts).
 *
 * EXEMPT FROM THE TWO-FACTOR CHECK, like `POST /api/me/mfa` and for the same
 * reason: in an organization that requires 2FA, somebody without it is refused
 * everywhere else, and this is the first step of getting it.
 *
 * The code itself appears in the email and nowhere else - not the response,
 * not a log line.
 */
const sendSchema = z.object({ purpose: z.literal("MFA_ENROLLMENT") }).strict();

export const POST = withRoute(
  "POST /api/me/security-code/send",
  async (request: Request) => {
    try {
      // Per address, on top of the per-account cooldown and hourly cap below.
      const limited = await enforceRateLimit(request, {
        scope: "security-code-send",
        limit: 10,
        windowMs: 15 * 60 * 1000
      });
      if (limited) return limited;

      // 2FA set-up happens before device confirmation, on the same browser.
      const actor = await authorizeMember(request, {
        allowUnsatisfiedMfa: true,
        allowUnconfirmedDevice: true
      });
      const userId = requireUserActor(actor);
      const { purpose } = sendSchema.parse(await request.json());
      const token = await resolveAccessToken(request);
      const sessionId = token ? readSessionId(token) : null;

      // The grant is tied to a session; without one there is nothing to tie
      // it to, and an untied grant is exactly what must not exist.
      if (!sessionId) {
        return NextResponse.json(
          { error: "Your session could not be identified. Sign in again and retry." },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, name: true, mfaEnrolledAt: true }
      });

      // Replacing an authenticator is not this flow. Somebody who already has
      // a trusted one signs in with it; a lost one is an administrator reset.
      if (user.mfaEnrolledAt) {
        return NextResponse.json(
          { error: "Two-factor authentication is already set up on this account." },
          { status: 409 }
        );
      }

      const issued = await issueSecurityCode(prisma, {
        userId,
        organizationId: actor.organizationId,
        purpose,
        sessionId,
        ipAddress: readRequestIp(request),
        userAgent: request.headers.get("user-agent")
      });

      if (issued.status !== "issued") {
        log.info({ userId, purpose, reason: issued.status }, "security_code_send_throttled");

        return NextResponse.json(
          {
            error:
              issued.status === "cooldown"
                ? "Please wait a moment before requesting another code."
                : "Too many codes requested. Try again later.",
            resendAvailableAt: issued.resendAvailableAt.toISOString()
          },
          { status: 429 }
        );
      }

      const outcome = await sendSecurityEmail(
        "mfa_enrollment_code",
        user.email,
        enrollmentCodeEmail({ name: user.name, code: issued.code })
      );

      if (outcome !== "sent") {
        // A code nobody received must not stay live.
        await withdrawSecurityCode(prisma, issued.id);

        return NextResponse.json(
          {
            error:
              "We couldn't send the verification email. Try again, or ask your administrator to check the email settings."
          },
          { status: outcome === "unconfigured" ? 503 : 502 }
        );
      }

      log.info({ userId, purpose }, "security_code_sent");

      return NextResponse.json({
        sentTo: maskEmail(user.email),
        expiresAt: issued.expiresAt.toISOString(),
        resendAvailableAt: issued.resendAvailableAt.toISOString()
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
