import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authorize,
  scoped,
  tenant,
  type AuthzContext
} from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { HALL_FLOOR_PLAN_BUCKET } from "@/lib/storage/buckets";
import {
  deleteStorageFiles,
  isOrgScopedStoragePath
} from "@/lib/storage/files";
import {
  mapObjectSchema,
  type MapObject
} from "@/features/hall-room-map/validations/hall-map.schema";
import { log } from "@/lib/logging/context";

const createPresetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  hallId: z.string().uuid(),
  objects: z.array(mapObjectSchema).max(1000),
  // Nullable so a PATCH can clear the floor plan; the prefix is verified
  // against the acting organization before it is stored.
  backgroundPath: z.string().min(1).max(500).nullable().optional()
});

const updatePresetSchema = createPresetSchema
  .partial()
  .extend({ id: z.string().uuid() });

const deletePresetSchema = z.object({ id: z.string().uuid() });

type HallMapPresetRow = {
  id: string;
  organizationId: string;
  hallId: string;
  name: string;
  objects: unknown;
  createdAt: Date;
  updatedAt: Date;
  hall: { id: string; name: string };
};

/**
 * One guard, two keys: reading a floor plan and drawing one are different acts,
 * and the four handlers below say which they are rather than sharing a single
 * "can touch hall maps" flag - which is how a POST comes to be gated by a read.
 */
async function getActor(
  request: Request,
  permission: "hallmap.read" | "hallmap.update"
) {
  return authorize(request, permission);
}

/**
 * Reads stored layout objects. Parses per object on purpose: an all-or-nothing
 * parse meant a single legacy row - one missing `seatingUse`, say - returned an
 * empty array and blanked the user's entire saved layout, which then became
 * permanent the next time they saved.
 */
function normalizeObjects(objects: unknown): MapObject[] {
  if (!Array.isArray(objects)) return [];

  const kept: MapObject[] = [];

  for (const candidate of objects) {
    const parsed = mapObjectSchema.safeParse(candidate);
    if (parsed.success) kept.push(parsed.data);
  }

  if (kept.length !== objects.length) {
    log.warn(
      { dropped: objects.length - kept.length, total: objects.length },
      "hall_map_objects_dropped"
    );
  }

  return kept;
}

function formatPreset(row: HallMapPresetRow) {
  return {
    ...row,
    objects: normalizeObjects(row.objects)
  };
}

async function listHallMapPresets(actor: AuthzContext) {
  const rows = await prisma.hallMapPreset.findMany({
    where: {
      ...tenant(actor),
      ...scoped(actor, "hall")
    },
    orderBy: [{ hall: { name: "asc" } }, { name: "asc" }],
    include: { hall: { select: { id: true, name: true } } }
  });

  return rows.map(formatPreset);
}

async function listShapeLibrary(organizationId: string) {
  const rows = await prisma.hallMapShapeLibraryItem.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      shapeType: true,
      width: true,
      height: true,
      seats: true
    }
  });

  return rows.map((row) => ({
    ...row,
    shapeType: row.shapeType === "round-table" ? "round-table" : "rect-table"
  }));
}

async function findPresetIdentity(id: string, actor: AuthzContext) {
  return prisma.hallMapPreset.findFirst({
    where: {
      id,
      ...tenant(actor),
      ...scoped(actor, "hall")
    },
    select: { id: true, hallId: true, backgroundPath: true }
  });
}

/**
 * A client-supplied floor-plan path must live under the acting organization's
 * prefix - the same rule the storage policies enforce - or a crafted body
 * could point one tenant's map at another tenant's file.
 */
function backgroundPathError(
  organizationId: string,
  backgroundPath: string | null | undefined
) {
  if (backgroundPath === null || backgroundPath === undefined) return null;

  return isOrgScopedStoragePath(organizationId, backgroundPath)
    ? null
    : "Invalid floor plan path.";
}

/**
 * Best effort: an orphaned image costs kilobytes, while failing here would
 * cost the user the save that already happened.
 */
async function discardFloorPlan(
  organizationId: string,
  path: string | null | undefined
) {
  if (!path) return;

  try {
    await deleteStorageFiles({
      organizationId,
      bucket: HALL_FLOOR_PLAN_BUCKET,
      paths: [path]
    });
  } catch (error) {
    log.error(
      { bucket: HALL_FLOOR_PLAN_BUCKET, err: String(error) },
      "hall_floor_plan_removal_failed"
    );
  }
}

function createHallMapErrorResponse(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return NextResponse.json(
      { error: "A hall map with this name already exists for the selected hall." },
      { status: 409 }
    );
  }
  return createApiErrorResponse(error);
}

async function readPreset(id: string, organizationId: string) {
  const row = await prisma.hallMapPreset.findFirst({
    where: { id, organizationId },
    include: { hall: { select: { id: true, name: true } } }
  });
  return row ? formatPreset(row) : null;
}

export async function GET(request: Request) {
  try {
    const actor = await getActor(request, "hallmap.read");
    const [halls, presets, shapeLibrary] = await Promise.all([
      prisma.hall.findMany({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
          ...scoped(actor, "hall", { field: "id" })
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, capacity: true }
      }),
      listHallMapPresets(actor),
      listShapeLibrary(actor.organizationId)
    ]);

    return NextResponse.json({ halls, presets, shapeLibrary });
  } catch (error) {
    return createHallMapErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request, "hallmap.update");
    const input = createPresetSchema.parse(await request.json());
    const hall = await prisma.hall.findFirst({
      where: {
        id: input.hallId,
        organizationId: actor.organizationId,
        isActive: true,
        ...scoped(actor, "hall", { field: "id" })
      },
      select: { id: true }
    });
    if (!hall) {
      return NextResponse.json(
        { error: "Hall not found or unavailable." },
        { status: 404 }
      );
    }

    const pathError = backgroundPathError(
      actor.organizationId,
      input.backgroundPath
    );
    if (pathError) {
      return NextResponse.json({ error: pathError }, { status: 400 });
    }

    const created = await prisma.hallMapPreset.create({
      data: {
        organizationId: actor.organizationId,
        hallId: hall.id,
        name: input.name,
        objects: input.objects,
        backgroundPath: input.backgroundPath ?? null
      },
      select: { id: true }
    });
    const preset = await readPreset(created.id, actor.organizationId);

    return NextResponse.json({ preset }, { status: 201 });
  } catch (error) {
    return createHallMapErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await getActor(request, "hallmap.update");
    const input = updatePresetSchema.parse(await request.json());
    const current = await findPresetIdentity(input.id, actor);
    if (!current) {
      return NextResponse.json(
        { error: "Hall map preset not found." },
        { status: 404 }
      );
    }

    if (input.hallId && input.hallId !== current.hallId) {
      const hall = await prisma.hall.findFirst({
        where: {
          id: input.hallId,
          organizationId: actor.organizationId,
          isActive: true,
          ...scoped(actor, "hall", { field: "id" })
        },
        select: { id: true }
      });
      if (!hall) {
        return NextResponse.json(
          { error: "Hall not found or unavailable." },
          { status: 404 }
        );
      }
    }

    const pathError = backgroundPathError(
      actor.organizationId,
      input.backgroundPath
    );
    if (pathError) {
      return NextResponse.json({ error: pathError }, { status: 400 });
    }

    await prisma.hallMapPreset.update({
      where: { id: current.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.hallId !== undefined ? { hallId: input.hallId } : {}),
        ...(input.objects !== undefined ? { objects: input.objects } : {}),
        ...(input.backgroundPath !== undefined
          ? { backgroundPath: input.backgroundPath }
          : {})
      }
    });

    // The row is written; dropping the replaced image afterwards means a
    // storage failure leaves an orphaned object rather than a broken save.
    if (
      input.backgroundPath !== undefined &&
      current.backgroundPath &&
      current.backgroundPath !== input.backgroundPath
    ) {
      await discardFloorPlan(actor.organizationId, current.backgroundPath);
    }

    const preset = await readPreset(current.id, actor.organizationId);

    return NextResponse.json({ preset });
  } catch (error) {
    return createHallMapErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await getActor(request, "hallmap.update");
    const input = deletePresetSchema.parse(await request.json());
    const preset = await findPresetIdentity(input.id, actor);
    if (!preset) {
      return NextResponse.json(
        { error: "Hall map preset not found." },
        { status: 404 }
      );
    }

    await prisma.hallMapPreset.delete({ where: { id: preset.id } });
    await discardFloorPlan(actor.organizationId, preset.backgroundPath);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return createHallMapErrorResponse(error);
  }
}
