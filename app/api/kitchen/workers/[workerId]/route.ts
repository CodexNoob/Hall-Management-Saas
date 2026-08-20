import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DUPLICATE_WORKER_MESSAGE,
  isDuplicateWorkerError,
  workerColorSchema,
  workerNameSchema,
  workerSelect
} from "@/features/kitchen/server/kitchen-workers";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const workerIdSchema = z.string().uuid();

const updateWorkerSchema = z
  .object({
    name: workerNameSchema.optional(),
    color: workerColorSchema,
    /// Restoring a retired worker is the same write as retiring one, from the
    /// other direction, so DELETE is not the only way this column moves.
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

async function loadWorker(organizationId: string, id: string) {
  return prisma.kitchenWorker.findFirst({
    where: { id, organizationId },
    select: { id: true }
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workerId: string }> }
) {
  try {
    const actor = await requirePermission(request, "canAssignWorkers");
    const { workerId } = await params;
    const id = workerIdSchema.parse(workerId);
    const input = updateWorkerSchema.parse(await request.json());

    // Read first rather than leaning on the update's where clause, so a worker
    // belonging to another organization answers 404 instead of surfacing as a
    // Prisma error. Same shape the menu item route uses.
    const current = await loadWorker(actor.organizationId, id);

    if (!current) {
      return NextResponse.json(
        { error: "Kitchen worker not found." },
        { status: 404 }
      );
    }

    if (input.name) {
      const clash = await prisma.kitchenWorker.findFirst({
        where: {
          organizationId: actor.organizationId,
          name: { equals: input.name, mode: "insensitive" },
          id: { not: id }
        },
        select: { id: true }
      });

      if (clash) {
        return NextResponse.json(
          { error: DUPLICATE_WORKER_MESSAGE },
          { status: 409 }
        );
      }
    }

    const worker = await prisma.kitchenWorker.update({
      where: { id },
      data: input,
      select: workerSelect
    });

    return NextResponse.json({ worker });
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

/**
 * Retires a worker. Deliberately not a row delete.
 *
 * `KitchenItemStatus.assigned_worker_id` points here, so a hard delete either
 * fails against the foreign key or takes the name off work that has already
 * been done. A kitchen sheet from last month should still say who cooked it.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ workerId: string }> }
) {
  try {
    const actor = await requirePermission(request, "canAssignWorkers");
    const { workerId } = await params;
    const id = workerIdSchema.parse(workerId);
    const current = await loadWorker(actor.organizationId, id);

    if (!current) {
      return NextResponse.json(
        { error: "Kitchen worker not found." },
        { status: 404 }
      );
    }

    const worker = await prisma.kitchenWorker.update({
      where: { id },
      data: { isActive: false },
      select: workerSelect
    });

    return NextResponse.json({ worker });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
