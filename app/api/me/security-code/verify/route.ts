import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAccessToken } from "@/lib/auth/identity";
import { verifySecurityCode } from "@/lib/auth/security-codes";
import { readSessionId } from "@/lib/auth/session-record";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * "Here is the code from my email."
 *
 * A correct code for THIS session becomes a 15-minute, single-use enrollment
 * grant; only while it is live will a newly enrolled authenticator be trusted.
 * Five wrong entries kill the code. The code is compared as an HMAC and never
 * logged.
 *
 * Exempt from the two-factor check for the same reason as the send route.
 */
const verifySchema = z
  .object({
    purpose: z.literal("MFA_ENROLLMENT"),
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email.")
  })
  .strict();

export const POST = withRoute(
  "POST /api/me/security-code/verify",
  async (request: Request) => {
    try {
      const limited = await enforceRateLimit(request, {
        scope: "security-code-verify",
        limit: 30,
        windowMs: 15 * 60 * 1000
      });
      if (limited) return limited;

      // 2FA set-up happens before device confirmation, on the same browser.
      const actor = await authorizeMember(request, {
        allowUnsatisfiedMfa: true,
        allowUnconfirmedDevice: true
      });
      const userId = requireUserActor(actor);
      const { purpose, code } = verifySchema.parse(await request.json());
      const token = await resolveAccessToken(request);
      const sessionId = token ? readSessionId(token) : null;

      if (!sessionId) {
        return NextResponse.json(
          { error: "Your session could not be identified. Sign in again and retry." },
          { status: 400 }
        );
      }

      const result = await verifySecurityCode(prisma, {
        userId,
        purpose,
        sessionId,
        code
      });

      switch (result.status) {
        case "verified":
          log.info({ userId, purpose }, "security_code_verified");
          return NextResponse.json({
            verified: true,
            grantExpiresAt: result.grantExpiresAt.toISOString()
          });
        case "invalid":
          return NextResponse.json(
            {
              error: "That code is not right. Check the email and try again.",
              attemptsLeft: result.attemptsLeft
            },
            { status: 400 }
          );
        case "locked":
          // The limit this exists to enforce, tripped. Worth a line: repeated
          // wrong codes on one account are somebody guessing.
          log.warn({ userId, purpose }, "security_code_locked");
          return NextResponse.json(
            { error: "Too many incorrect codes. Send a new code and try again." },
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
