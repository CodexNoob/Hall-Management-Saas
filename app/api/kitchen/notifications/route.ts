import { NextResponse } from "next/server";

import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { resolveKitchenVisibility } from "@/features/kitchen/server/kitchen-visibility-resolve";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http/with-route";

/**
 * Both of these act on the organization's whole feed, so both are refused to
 * anyone who is only shown part of it.
 *
 * `kitchen.status.update` is the key a cook holds to advance their own dish, and
 * it is the key these endpoints are gated on - which on its own let a cook
 * acknowledge, or permanently delete, every notification in the organization,
 * including the ones about events their own board withholds from them. Sweeping
 * a feed you cannot read is a supervisor's action: `kitchen.read.all` is what
 * separates the two roles, and it is what decides here.
 */
async function refuseScopedCaller(request: Request) {
  const actor = await authorize(request, "kitchen.status.update");
  const visibility = await resolveKitchenVisibility(actor);

  if (!visibility.seesWholeBoard) {
    return {
      actor,
      response: NextResponse.json(
        {
          error:
            "Only kitchen supervisors can acknowledge or clear the whole notification feed."
        },
        { status: 403 }
      )
    };
  }

  return { actor, response: null };
}

export const PATCH = withRoute(
  "PATCH /api/kitchen/notifications",
  async (request: Request) => {
    try {
      const { actor, response } = await refuseScopedCaller(request);
      if (response) return response;

      const result = await prisma.kitchenNotification.updateMany({
        where: {
          organizationId: actor.organizationId,
          requiresAcknowledgment: true,
          acknowledgedAt: null
        },
        data: {
          acknowledgedById: actor.userId,
          acknowledgedAt: new Date()
        }
      });

      return NextResponse.json({ acknowledgedCount: result.count });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

export const DELETE = withRoute(
  "DELETE /api/kitchen/notifications",
  async (request: Request) => {
    try {
      const { actor, response } = await refuseScopedCaller(request);
      if (response) return response;

      const result = await prisma.kitchenNotification.deleteMany({
        where: { organizationId: actor.organizationId }
      });

      return NextResponse.json({ deletedCount: result.count });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
