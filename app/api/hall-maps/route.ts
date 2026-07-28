import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdministrativeRole } from "@/lib/auth/roles";
import { requireAnyPermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const shapeTypeSchema = z.enum([
  "round-table",
  "rect-table",
  "kids-table",
  "box",
  "circle",
  "divider",
  "buffet",
  "head-table",
  "drinks"
]);

const mapObjectSchema = z.object({
  id: z.string().min(1).max(150),
  type: shapeTypeSchema,
  name: z.string().trim().min(1).max(100),
  x: z.number().finite().min(0).max(10000),
  y: z.number().finite().min(0).max(10000),
  width: z.number().finite().min(10).max(5000),
  height: z.number().finite().min(10).max(5000),
  rotation: z.number().finite().min(0).max(360),
  seats: z.number().int().min(0).max(1000),
  seatingUse: z.enum(["none", "adult", "kids", "head"])
});

type MapObject = z.infer<typeof mapObjectSchema>;

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
  objects: MapObject[];
  createdAt: Date;
  updatedAt: Date;
  hall: { id: string; name: string };
};

type HallMapPresetIdentity = {
  id: string;
  hallId: string;
};

async function getActorAndHallScope(request: Request) {
  const actor = await requireAnyPermission(request, [...hallMapPermissions]);
  const allowedHallIds = actor.access?.allowedHallIds ?? [];
  const restrictHalls =
    !isAdministrativeRole(actor.membership.role) && allowedHallIds.length > 0;
  return { actor, allowedHallIds, restrictHalls };
}

function normalizeObjects(objects: unknown): MapObject[] {
  const parsed = z.array(mapObjectSchema).safeParse(objects);
  return parsed.success ? parsed.data : [];
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
  const rows = restrictHalls
    ? await prisma.$queryRaw<HallMapPresetRow[]>`
        SELECT
          hmp.id,
          hmp.organization_id AS "organizationId",
          hmp.hall_id AS "hallId",
          hmp.name,
          hmp.objects,
          hmp.created_at AS "createdAt",
          hmp.updated_at AS "updatedAt",
          json_build_object('id', h.id, 'name', h.name) AS hall
        FROM hall_map_presets hmp
        INNER JOIN halls h ON h.id = hmp.hall_id
        WHERE hmp.organization_id = ${organizationId}::uuid
          AND hmp.hall_id = ANY(${allowedHallIds}::uuid[])
        ORDER BY h.name ASC, hmp.name ASC
      `
    : await prisma.$queryRaw<HallMapPresetRow[]>`
        SELECT
          hmp.id,
          hmp.organization_id AS "organizationId",
          hmp.hall_id AS "hallId",
          hmp.name,
          hmp.objects,
          hmp.created_at AS "createdAt",
          hmp.updated_at AS "updatedAt",
          json_build_object('id', h.id, 'name', h.name) AS hall
        FROM hall_map_presets hmp
        INNER JOIN halls h ON h.id = hmp.hall_id
        WHERE hmp.organization_id = ${organizationId}::uuid
        ORDER BY h.name ASC, hmp.name ASC
      `;

  return rows.map(formatPreset);
}

async function findPresetIdentity(
  id: string,
  organizationId: string,
  restrictHalls: boolean,
  allowedHallIds: string[]
) {
  const rows = restrictHalls
    ? await prisma.$queryRaw<HallMapPresetIdentity[]>`
        SELECT id, hall_id AS "hallId"
        FROM hall_map_presets
        WHERE id = ${id}::uuid
          AND organization_id = ${organizationId}::uuid
          AND hall_id = ANY(${allowedHallIds}::uuid[])
        LIMIT 1
      `
    : await prisma.$queryRaw<HallMapPresetIdentity[]>`
        SELECT id, hall_id AS "hallId"
        FROM hall_map_presets
        WHERE id = ${id}::uuid
          AND organization_id = ${organizationId}::uuid
        LIMIT 1
      `;

  return rows[0] ?? null;
}

async function readPreset(id: string, organizationId: string) {
  const rows = await prisma.$queryRaw<HallMapPresetRow[]>`
    SELECT
      hmp.id,
      hmp.organization_id AS "organizationId",
      hmp.hall_id AS "hallId",
      hmp.name,
      hmp.objects,
      hmp.created_at AS "createdAt",
      hmp.updated_at AS "updatedAt",
      json_build_object('id', h.id, 'name', h.name) AS hall
    FROM hall_map_presets hmp
    INNER JOIN halls h ON h.id = hmp.hall_id
    WHERE hmp.id = ${id}::uuid
      AND hmp.organization_id = ${organizationId}::uuid
    LIMIT 1
  `;

  return rows[0] ? formatPreset(rows[0]) : null;
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
    return createApiErrorResponse(error);
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

    const [created] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO hall_map_presets (organization_id, hall_id, name, objects)
      VALUES (
        ${actor.organizationId}::uuid,
        ${hall.id}::uuid,
        ${input.name},
        ${JSON.stringify(input.objects)}::jsonb
      )
      RETURNING id
    `;
    const preset = created
      ? await readPreset(created.id, actor.organizationId)
      : null;

    return NextResponse.json({ preset }, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
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

    await prisma.$executeRaw`
      UPDATE hall_map_presets
      SET
        name = COALESCE(${input.name ?? null}, name),
        hall_id = COALESCE(${input.hallId ?? null}::uuid, hall_id),
        objects = COALESCE(${input.objects ? JSON.stringify(input.objects) : null}::jsonb, objects),
        updated_at = NOW()
      WHERE id = ${current.id}::uuid
        AND organization_id = ${actor.organizationId}::uuid
    `;
    const preset = await readPreset(current.id, actor.organizationId);

    return NextResponse.json({ preset });
  } catch (error) {
    return createApiErrorResponse(error);
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

    await prisma.$executeRaw`
      DELETE FROM hall_map_presets
      WHERE id = ${preset.id}::uuid
        AND organization_id = ${actor.organizationId}::uuid
    `;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
