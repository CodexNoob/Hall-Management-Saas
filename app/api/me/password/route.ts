import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActivity } from "@/lib/audit/activity-log";
import { getPasswordValidationError } from "@/lib/auth/password";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";
import { log } from "@/lib/logging/context";
import { trackOutbound } from "@/lib/logging/outbound";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  createSupabaseServiceClient,
  createSupabaseTokenVerifier
} from "@/lib/supabase/server";

/**
 * Change your own password, from inside the dashboard.
 *
 * THE CURRENT PASSWORD IS CHECKED HERE, NOT TRUSTED TO SUPABASE'S SETTINGS.
 * `auth.updateUser({ current_password })` is only enforced when the project has
 * "require current password" switched on, which is a dashboard toggle nobody
 * would notice being off. An unattended laptop with a live session would then be
 * enough to lock its owner out of their own account. So the old password is
 * proved against Supabase with a password grant on a stateless client, that
 * proof session is ended at once, and only then is the new one written with the
 * service key.
 *
 * WHY NOT FROM THE BROWSER. Signing in again there would replace the session the
 * dashboard is running on - a new `session_id`, a new session row, and for
 * anybody with two-factor an `aal1` session that the next request would refuse.
 *
 * Rate-limited hard, because it is an oracle for the current password.
 */
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(1).max(200)
  })
  .strict();

function refuse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export const POST = withRoute(
  "POST /api/me/password",
  async (request: Request) => {
    try {
      const limited = await enforceRateLimit(request, {
        scope: "me-password",
        limit: 5,
        windowMs: 15 * 60 * 1000
      });
      if (limited) return limited;

      const actor = await authorizeMember(request);
      const userId = requireUserActor(actor);
      const input = changePasswordSchema.parse(await request.json());

      const rule = getPasswordValidationError(input.newPassword);
      if (rule) return refuse(rule);

      if (input.newPassword === input.currentPassword) {
        return refuse("Choose a password different from your current one.");
      }

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, supabaseAuthId: true }
      });

      if (!user.supabaseAuthId) {
        return refuse("This account has no password sign-in to change.", 409);
      }

      const verifier = createSupabaseTokenVerifier();
      const proof = await trackOutbound(
        { vendor: "supabase", operation: "auth.token.password" },
        () =>
          verifier.auth.signInWithPassword({
            email: user.email,
            password: input.currentPassword
          })
      );

      // The subject is compared as well as the error: a proof for some other
      // account - an email that has since moved - must never count.
      if (proof.error || proof.data.user?.id !== user.supabaseAuthId) {
        // A limit this route exists to enforce, and the one line that says
        // somebody keeps getting it wrong. Not an exception: a 400 follows.
        log.warn({ userId }, "own_password_change_current_rejected");
        return refuse("Your current password is incorrect.");
      }

      const service = createSupabaseServiceClient();

      // The proof session did its job. Left alive, it would sit in the device
      // list as a sign-in nobody made.
      if (proof.data.session?.access_token) {
        const accessToken = proof.data.session.access_token;
        const ended = await trackOutbound(
          { vendor: "supabase", operation: "auth.admin.signOut" },
          () => service.auth.admin.signOut(accessToken, "local")
        );

        if (ended.error) {
          log.warn({ userId }, "own_password_change_proof_session_not_ended");
        }
      }

      const updated = await trackOutbound(
        { vendor: "supabase", operation: "auth.admin.updateUserById" },
        () =>
          service.auth.admin.updateUserById(user.supabaseAuthId as string, {
            password: input.newPassword
          })
      );

      // Supabase has its own password policy (leaked-password protection, a
      // longer minimum) that can be stricter than ours. Its wording is the
      // useful part, and it contains nothing of the password itself.
      if (updated.error) {
        return refuse(updated.error.message, 422);
      }

      await prisma.$transaction(async (transaction) => {
        await transaction.user.update({
          where: { id: userId },
          data: { passwordSetAt: new Date() }
        });

        await recordActivity(transaction, actor, {
          // The same action the first-time set uses; the message tells the two
          // apart, as it already does in /api/auth/password-set.
          action: "auth.password.set",
          message: "Account password was changed from My Account.",
          changed: { after: { userId } }
        });
      });

      return NextResponse.json({ changed: true });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
