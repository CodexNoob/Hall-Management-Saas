import "server-only";

import { principalIdsHolding } from "@/lib/authz/decide";
import { prisma } from "@/lib/prisma";

/**
 * Eligibility is a PERMISSION, not a role (INV-1).
 *
 * "Who can be assigned a dish" is "who may advance production status". Asking it
 * that way stays correct for a tenant who invents a Head Chef role, and it no
 * longer depends on a free-text column that has held "Kitchen Staff", "kitchen"
 * and "kitchenstaff" at different times.
 */
const KITCHEN_WORKER_PERMISSION = "kitchen.status.update" as const;
const STAFF_ADMIN_PERMISSION = "role.assign" as const;

export type KitchenWorkerOption = {
  id: string;
  name: string;
  /** Present only server-side so the board can identify the current worker. */
  userId: string | null;
  /** True when the worker is a staff member rather than a typed-in name. */
  isStaff: boolean;
};

/**
 * The explicitly designated people a dish can be assigned to.
 *
 * Kitchen access alone is insufficient: Owner holds every permission but is
 * not thereby a cook. A linked, active `KitchenWorker` row is the designation,
 * while production permission ensures the person can act on assigned work.
 * Access managers are excluded so broad administrative access cannot leak an
 * Owner into the roster. Historical rows remain stored for old assignments.
 */
export async function loadKitchenStaffWorkers(
  organizationId: string
): Promise<KitchenWorkerOption[]> {
  const [memberships, workers, eligiblePrincipalIds, accessAdminPrincipalIds] =
    await Promise.all([
      prisma.organizationMembership.findMany({
        where: {
          organizationId,
          isActive: true,
          user: { isActive: true }
        },
        select: {
          principalId: true,
          user: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.kitchenWorker.findMany({
        where: { organizationId },
        select: { id: true, userId: true, name: true, isActive: true }
      }),
      principalIdsHolding(organizationId, KITCHEN_WORKER_PERMISSION),
      principalIdsHolding(organizationId, STAFF_ADMIN_PERMISSION)
    ]);

  const kitchenUserIds = new Set(
    memberships
      .filter(
        (membership) =>
          eligiblePrincipalIds.has(membership.principalId) &&
          !accessAdminPrincipalIds.has(membership.principalId)
      )
      .map((membership) => membership.user.id)
  );

  return workers
    .filter((worker) => worker.isActive)
    .filter((worker) => worker.userId && kitchenUserIds.has(worker.userId))
    .map((worker) => ({
      id: worker.id,
      name: worker.name,
      userId: worker.userId,
      isStaff: Boolean(worker.userId)
    }));
}
