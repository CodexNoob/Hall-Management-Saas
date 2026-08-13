import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdministrativeRole } from "@/lib/auth/roles";
import { requireAnyPermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import {
  mapObjectSchema,
  type MapObject
} from "@/features/hall-room-map/validations/hall-map.schema";

const createPresetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  hallId: z.string().uuid(),
  objects: z.array(mapObjectSchema).max(1000)
});

const updatePresetSchema = createPresetSchema
  .partial()
  .extend({ id: z.string().uuid() });

const deletePresetSchema = z.object({ id: z.string().uuid() });

const hallMapPermissions = ["canViewEventManager", "canViewCalendar"] as const;

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

async function getActorAndHallScope(request: Request) {
  const actor = await requireAnyPermission(request, [...hallMapPermissions]);
  const allowedHallIds = actor.access?.allowedHallIds ?? [];
  const restrictHalls =
    !isAdministrativeRole(actor.membership.role) && allowedHallIds.length > 0;
  return { actor, allowedHallIds, restrictHalls };
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
    console.warn(
      `hall-maps: dropped ${objects.length - kept.length} unreadable stored objects`
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

async function listHallMapPresets(
  organizationId: string,
  restrictHalls: boolean,
  allowedHallIds: string[]
) {
  const rows = await prisma.hallMapPreset.findMany({
    where: {
      organizationId,
      ...(restrictHalls ? { hallId: { in: allowedHallIds } } : {})
    },
    orderBy: [{ hall: { name: "asc" } }, { name: "asc" }],
    include: { hall: { select: { id: true, name: true } } }
  });

  return rows.map(formatPreset);
}

async function findPresetIdentity(
  id: string,
  organizationId: string,
  restrictHalls: boolean,
  allowedHallIds: string[]
) {
  return prisma.hallMapPreset.findFirst({
    where: {
      id,
      organizationId,
      ...(restrictHalls ? { hallId: { in: allowedHallIds } } : {})
    },
    select: { id: true, hallId: true }
  });
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
    const { actor, allowedHallIds, restrictHalls } =
      await getActorAndHallScope(request);
    const [halls, presets] = await Promise.all([
      prisma.hall.findMany({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
          ...(restrictHalls ? { id: { in: allowedHallIds } } : {})
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, capacity: true }
      }),
      listHallMapPresets(actor.organizationId, restrictHalls, allowedHallIds)
    ]);

    return NextResponse.json({ halls, presets });
  } catch (error) {
    return createHallMapErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, allowedHallIds, restrictHalls } =
      await getActorAndHallScope(request);
    const input = createPresetSchema.parse(await request.json());
    const hall = await prisma.hall.findFirst({
      where: {
        id: input.hallId,
        organizationId: actor.organizationId,
        isActive: true,
        ...(restrictHalls ? { id: { in: allowedHallIds } } : {})
      },
      select: { id: true }
    });
    if (!hall) {
      return NextResponse.json(
        { error: "Hall not found or unavailable." },
        { status: 404 }
      );
    }

    const created = await prisma.hallMapPreset.create({
      data: {
        organizationId: actor.organizationId,
        hallId: hall.id,
        name: input.name,
        objects: input.objects
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
    const { actor, allowedHallIds, restrictHalls } =
      await getActorAndHallScope(request);
    const input = updatePresetSchema.parse(await request.json());
    const current = await findPresetIdentity(
      input.id,
      actor.organizationId,
      restrictHalls,
      allowedHallIds
    );
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
          ...(restrictHalls ? { id: { in: allowedHallIds } } : {})
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

    await prisma.hallMapPreset.update({
      where: { id: current.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.hallId !== undefined ? { hallId: input.hallId } : {}),
        ...(input.objects !== undefined ? { objects: input.objects } : {})
      }
    });
    const preset = await readPreset(current.id, actor.organizationId);

    return NextResponse.json({ preset });
  } catch (error) {
    return createHallMapErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { actor, allowedHallIds, restrictHalls } =
      await getActorAndHallScope(request);
    const input = deletePresetSchema.parse(await request.json());
    const preset = await findPresetIdentity(
      input.id,
      actor.organizationId,
      restrictHalls,
      allowedHallIds
    );
    if (!preset) {
      return NextResponse.json(
        { error: "Hall map preset not found." },
        { status: 404 }
      );
    }

    await prisma.hallMapPreset.delete({ where: { id: preset.id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return createHallMapErrorResponse(error);
  }
}
