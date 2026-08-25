import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { principalIdsHolding } from "@/lib/authz/decide";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import {
  DUPLICATE_WORKER_MESSAGE,
  isDuplicateWorkerError,
  workerColorSchema,
  workerSelect
} from "@/features/kitchen/server/kitchen-workers";

/**
 * The people a dish can be assigned to.
 *
 * `KitchenWorker` has existed since the baseline and had exactly one reader -
 * the board's GET - and no writer anywhere, so the assignment dropdown on every
 * dish could only ever say "Unassigned". This is the missing half.
 *
 * Gated on `kitchen.worker.read` to look and `kitchen.worker.assign` to change:
 * whoever decides who cooks what is the same person who keeps the list of who
 * there is to ask.
 */

/**
 * A worker is a staff member who may advance production status.
 *
 * ELIGIBILITY IS A PERMISSION, NOT A ROLE (INV-1). "Who can be assigned a dish"
 * is "who may mark it done", which stays correct for a tenant that invents a
 * Head Chef role and never mentions a role name in this file.
 *
 * `name` is no longer accepted from the caller. Typing a name produced a row
 * with no connection to any account, so the same person could exist twice -
 * once typed here and once created from their role - and neither knew about
 * the other. The name now comes from the staff record.
 */
/** The key that makes someone assignable to a dish. */
const WORKER_ELIGIBILITY_PERMISSION = "kitchen.status.update" as const;

const createWorkerSchema = z.object({
  userId: z.string().uuid(),
  color: workerColorSchema
});

export async function GET(request: Request) {
  try {
    const actor = await authorize(request, "kitchen.worker.read");
    // Retired ones too, unlike the board's own read: this is the screen where
    // someone puts a worker back, so it has to be able to show them.
    const [workers, memberships] = await Promise.all([
      prisma.kitchenWorker.findMany({
        where: { organizationId: actor.organizationId },
        select: { ...workerSelect, userId: true },
        orderBy: [{ isActive: "desc" }, { name: "asc" }]
      }),
      prisma.organizationMembership.findMany({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
          user: { isActive: true }
        },
        select: {
          principalId: true,
          user: { select: { id: true, name: true, email: true } }
        }
      })
    ]);

    // Who can still be added: everyone who may advance production status and is
    // not already on the list.
    const eligiblePrincipalIds = await principalIdsHolding(
      actor.organizationId,
      WORKER_ELIGIBILITY_PERMISSION
    );
    const existingUserIds = new Set(
      workers.map((worker) => worker.userId).filter(Boolean)
    );
    const availableStaff = memberships
      .filter(
        (membership) =>
          eligiblePrincipalIds.has(membership.principalId) &&
          !existingUserIds.has(membership.user.id)
      )
      .map((membership) => ({
        id: membership.user.id,
        name: membership.user.name?.trim() || membership.user.email
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    return NextResponse.json({ workers, availableStaff });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await authorize(request, "kitchen.worker.assign");
    const input = createWorkerSchema.parse(await request.json());

    // The role is the eligibility rule, so it is checked server-side rather
    // than trusted from whatever the dropdown happened to offer.
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: actor.organizationId,
        userId: input.userId,
        isActive: true,
        user: { isActive: true }
      },
      select: {
        principalId: true,
        user: { select: { name: true, email: true } }
      }
    });

    if (!membership) {
      return NextResponse.json(
        { error: "That staff member is not part of this organization." },
        { status: 404 }
      );
    }

    // The eligibility rule is enforced server-side rather than trusted from
    // whatever the dropdown happened to offer.
    const eligiblePrincipalIds = await principalIdsHolding(
      actor.organizationId,
      WORKER_ELIGIBILITY_PERMISSION
    );

    if (!eligiblePrincipalIds.has(membership.principalId)) {
      return NextResponse.json(
        {
          error:
            "Only staff who can update kitchen production status can be added as kitchen workers."
        },
        { status: 409 }
      );
    }

    // Checked here for the message, and caught below for the race. The index is
    // what actually guarantees it; this is what makes the failure readable.
    const existing = await prisma.kitchenWorker.findFirst({
      where: { organizationId: actor.organizationId, userId: input.userId },
      select: { id: true, isActive: true, name: true }
    });

    if (existing) {
      return NextResponse.json(
        {
          error: existing.isActive
            ? DUPLICATE_WORKER_MESSAGE
            : `${existing.name} is on this list but retired. Restore them instead of adding a second.`,
          workerId: existing.id
        },
        { status: 409 }
      );
    }

    const worker = await prisma.kitchenWorker.create({
      data: {
        organizationId: actor.organizationId,
        userId: input.userId,
        // From the staff record, not the caller: the two must not be able to
        // disagree about who this row is.
        name: membership.user.name?.trim() || membership.user.email,
        color: input.color
      },
      select: workerSelect
    });

    return NextResponse.json({ worker }, { status: 201 });
  } catch (error) {
    if (isDuplicateWorkerError(error)) {
      return NextResponse.json(
        { error: DUPLICATE_WORKER_MESSAGE },
        { status: 409 }
      );
    }

    return createApiErrorResponse(error);
  }
}
