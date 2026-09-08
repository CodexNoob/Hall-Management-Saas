import { NextResponse } from "next/server";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { recordActivity } from "@/lib/audit/activity-log";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { withRoute } from "@/lib/http/with-route";

/**
 * Records that the caller now owns a password of their own.
 *
 * PRECONDITION: the caller has already synced through POST /api/auth/session.
 * `authorizeMember` resolves a person by `supabase_auth_id`, and an invited
 * account does not carry one until `ensureProvisionedUser` claims its row by
 * email - so calling this as the first authenticated request of an invitation
 * answers 403 "User account is not provisioned." The browser satisfies this in
 * `SetPasswordCard.submit`, which syncs before it calls here.
 */
export const POST = withRoute(
  "POST /api/auth/password-set",
  async (request: Request) => {
    try {
      const limited = await enforceRateLimit(request, {
        scope: "auth-password-set",
        limit: 10,
        windowMs: 10 * 60 * 1000
      });
      if (limited) return limited;

      const actor = await authorizeMember(request);
      // Setting a password is something a person does to their own account, so a
      // service credential has no business here even though it authenticates fine.
      const userId = requireUserActor(actor);
      const passwordSetAt = new Date();

      await prisma.$transaction(async (transaction) => {
        const previous = await transaction.user.findUniqueOrThrow({
          where: { id: userId },
          select: { passwordSetAt: true }
        });

        await transaction.user.update({
          where: { id: userId },
          data: { passwordSetAt }
        });

        // The email stays out of both the message and the payload: this table
        // has no redaction and the row is read back on the Activity screen.
        // `userId` and `userName` already identify the account.
        await recordActivity(transaction, actor, {
          action: "auth.password.set",
          message: previous.passwordSetAt
            ? "Account password was changed."
            : "Account password was set for the first time.",
          changed: { after: { wasFirstPassword: !previous.passwordSetAt } }
        });
      });

      return NextResponse.json({ passwordSetAt: passwordSetAt.toISOString() });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
