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

export type KitchenWorkerOption = {
  id: string;
  name: string;
  /** Present only server-side so the board can identify the current worker. */
  userId: string | null;
  /** True when the worker is a staff member rather than a typed-in name. */
  isStaff: boolean;
};

/**
 * The people a dish can be assigned to, with Kitchen Staff kept in step.
 *
 * Assignment writes `kitchen_item_statuses.assigned_worker_id`, which points at
 * `kitchen_workers` - a list of names with no connection to anyone who can log
 * in. Giving someone the Kitchen Staff role therefore did nothing for the
 * board: they had to be typed into Manage workers as well, and the two lists
 * then drifted apart.
 *
 * This reconciles them on read, the same way GET /api/files creates the
 * permanent folder it needs. A write on a read path is not free, but the
 * alternative is every screen that grants a role having to remember to mirror
 * it here - which is exactly the coupling that let them diverge.
 *
 * Workers with no `userId` are left alone: a casual hand hired for one night
 * has a name and no login, which is what this table was originally for.
 */
export async function syncKitchenStaffWorkers(
  organizationId: string
): Promise<KitchenWorkerOption[]> {
  const [memberships, workers] = await Promise.all([
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
    })
  ]);

  const eligiblePrincipalIds = await principalIdsHolding(
    organizationId,
    KITCHEN_WORKER_PERMISSION
  );
  const kitchenStaff = memberships.filter((membership) =>
    eligiblePrincipalIds.has(membership.principalId)
  );

  const workerByUserId = new Map(
    workers.filter((worker) => worker.userId).map((worker) => [worker.userId, worker])
  );

  const missing = kitchenStaff.filter(
    (membership) => !workerByUserId.has(membership.user.id)
  );

  // A name is required, and an account can exist before anyone fills one in.
  const staffName = (staff: { name: string; email: string }) =>
    staff.name?.trim() || staff.email;

  if (missing.length) {
    await prisma.kitchenWorker.createMany({
      data: missing.map((membership) => ({
        organizationId,
        userId: membership.user.id,
        name: staffName(membership.user)
      })),
      // Two concurrent board loads would otherwise race on the unique index and
      // one would fail the whole request.
      skipDuplicates: true
    });
  }

  // Someone who has lost the role, or the whole account, should stop being
  // offered - but their existing assignments keep the name, because the row
  // stays and only its availability changes.
  const kitchenUserIds = new Set(kitchenStaff.map((m) => m.user.id));
  const staleWorkerIds = workers
    .filter(
      (worker) =>
        worker.userId && worker.isActive && !kitchenUserIds.has(worker.userId)
    )
    .map((worker) => worker.id);

  if (staleWorkerIds.length) {
    await prisma.kitchenWorker.updateMany({
      where: { id: { in: staleWorkerIds } },
      data: { isActive: false }
    });
  }

  // Re-read rather than reconstruct: the rows just created have ids only the
  // database knows, and a name edited in Manage workers must win over the
  // staff name it started from.
  const assignable = await prisma.kitchenWorker.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true, userId: true },
    orderBy: { name: "asc" }
  });

  return assignable.map((worker) => ({
    id: worker.id,
    name: worker.name,
    userId: worker.userId,
    isStaff: Boolean(worker.userId)
  }));
}
