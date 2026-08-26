import "server-only";

import { prisma } from "@/lib/prisma";
import { hasPermission, type AuthzContext } from "@/lib/authz/authorize";
import type { KitchenVisibility } from "@/features/kitchen/server/kitchen-visibility";

/**
 * Read one caller's kitchen visibility.
 *
 * Split from the rules in `kitchen-visibility.ts` only because this half needs a
 * database and those are applied inside a module that must stay importable by
 * unit tests. The routes call this once per request and pass the result down.
 */
export async function resolveKitchenVisibility(
  actor: AuthzContext
): Promise<KitchenVisibility> {
  // A service account has no `userId` and so can never match a roster row. It
  // gets the whole board only if it holds the key - the same rule as everyone
  // else rather than a special case for machines.
  const [seesWholeBoard, worker] = await Promise.all([
    hasPermission(actor, "kitchen.read.all"),
    actor.userId
      ? prisma.kitchenWorker.findFirst({
          where: {
            organizationId: actor.organizationId,
            userId: actor.userId,
            isActive: true
          },
          select: { id: true }
        })
      : Promise.resolve(null)
  ]);

  return { seesWholeBoard, workerId: worker?.id ?? null };
}
