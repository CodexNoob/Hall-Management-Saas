import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import {
  DUPLICATE_WORKER_MESSAGE,
  isDuplicateWorkerError,
  workerColorSchema,
  workerNameSchema,
  workerSelect
} from "@/features/kitchen/server/kitchen-workers";

/**
 * The people a dish can be assigned to.
 *
 * `KitchenWorker` has existed since the baseline and had exactly one reader -
 * the board's GET - and no writer anywhere, so the assignment dropdown on every
 * dish could only ever say "Unassigned". This is the missing half.
 *
 * Gated on `canAssignWorkers` rather than a new permission: whoever decides who
 * cooks what is the same person who keeps the list of who there is to ask, and
 * a fifth kitchen permission would have to be answered for on every role.
 */

const createWorkerSchema = z.object({
  name: workerNameSchema,
  color: workerColorSchema
});

export async function GET(request: Request) {
  try {
    const actor = await requirePermission(request, "canAssignWorkers");
    // Retired ones too, unlike the board's own read: this is the screen where
    // someone puts a worker back, so it has to be able to show them.
    const workers = await prisma.kitchenWorker.findMany({
      where: { organizationId: actor.organizationId },
      select: workerSelect,
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });

    return NextResponse.json({ workers });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canAssignWorkers");
    const input = createWorkerSchema.parse(await request.json());

    // Checked here for the message, and caught below for the race. The index is
    // what actually guarantees it; this is what makes the failure readable.
    const existing = await prisma.kitchenWorker.findFirst({
      where: {
        organizationId: actor.organizationId,
        name: { equals: input.name, mode: "insensitive" }
      },
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
        name: input.name,
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
