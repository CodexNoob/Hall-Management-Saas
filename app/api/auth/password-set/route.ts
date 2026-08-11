import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { createActivityLog } from "@/lib/audit/activity-log";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "auth-password-set",
      limit: 10,
      windowMs: 10 * 60 * 1000
    });
    if (limited) return limited;

    const actor = await requireAuthenticatedUser(request);
    const wasFirstPassword = !actor.passwordSetAt;
    const passwordSetAt = new Date();

    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: actor.id },
        data: { passwordSetAt }
      });

      await createActivityLog(transaction, {
        organizationId: actor.organizationId,
        userId: actor.id,
        userName: actor.name,
        actionType: "auth.password.set",
        message: `Account password was set for ${actor.email}.`,
        newValue: {
          email: actor.email,
          wasFirstPassword
        }
      });
    });

    return NextResponse.json({ passwordSetAt: passwordSetAt.toISOString() });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
