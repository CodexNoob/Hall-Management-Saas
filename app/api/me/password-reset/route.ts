import { NextResponse } from "next/server";

import { sendPasswordResetEmail } from "@/lib/auth/password-reset";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * "Forgot your current password?" - from inside My Account.
 *
 * Changing a password there needs the current one, which protects a screen
 * somebody walked away from. Forgetting it should not strand the person, so
 * this emails the same reset link the logged-out Forgot Password page sends.
 * It keeps the protection: using the link needs access to the mailbox, not
 * just to the unlocked screen.
 *
 * THE ADDRESS IS READ FROM THE CALLER'S OWN ROW. Nothing in the request names
 * an email or a person, so this cannot be pointed at anybody else's inbox.
 */
export const POST = withRoute(
  "POST /api/me/password-reset",
  async (request: Request) => {
    try {
      const limited = await enforceRateLimit(request, {
        scope: "me-password-reset",
        limit: 3,
        windowMs: 15 * 60 * 1000
      });
      if (limited) return limited;

      const actor = await authorizeMember(request);
      const userId = requireUserActor(actor);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, supabaseAuthId: true }
      });

      if (!user.supabaseAuthId) {
        return NextResponse.json(
          { error: "This account has no password sign-in to reset." },
          { status: 409 }
        );
      }

      const { error } = await sendPasswordResetEmail(user.email);

      if (error) {
        // Supabase's own words - most often its per-address resend limit -
        // which tell the person what to do next. They contain no secret.
        log.warn({ userId }, "own_password_reset_email_refused");
        return NextResponse.json({ error }, { status: 422 });
      }

      log.info({ userId }, "own_password_reset_email_sent");

      return NextResponse.json({ sent: true });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
