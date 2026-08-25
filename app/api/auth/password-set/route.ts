import { NextRequest, NextResponse } from "next/server";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { createActivityLog } from "@/lib/audit/activity-log";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

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
export async function POST(request: NextRequest) {
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

      await createActivityLog(transaction, {
        organizationId: actor.organizationId,
        userId,
        userName: actor.actorName,
        actionType: "auth.password.set",
        message: `Account password was set for ${actor.userEmail}.`,
        newValue: {
          email: actor.userEmail,
          wasFirstPassword: !previous.passwordSetAt
        }
      });
    });

    return NextResponse.json({ passwordSetAt: passwordSetAt.toISOString() });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
