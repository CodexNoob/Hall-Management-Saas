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

const createPresetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  hallId: z.string().uuid(),
  objects: z.array(mapObjectSchema).max(1000)
});

const updatePresetSchema = createPresetSchema
  .partial()
  .extend({ id: z.string().uuid() });

const deletePresetSchema = z.object({ id: z.string().uuid() });

const hallMapPermissions = [
  "canViewEventManager",
  "canViewCalendar"
] as const;

async function getActorAndHallScope(request: Request) {
  const actor = await requireAnyPermission(request, [...hallMapPermissions]);
  const allowedHallIds = actor.access?.allowedHallIds ?? [];
  const restrictHalls =
    !isAdministrativeRole(actor.membership.role) && allowedHallIds.length > 0;
  return { actor, allowedHallIds, restrictHalls };
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
      prisma.hallMapPreset.findMany({
        where: {
          organizationId: actor.organizationId,
          ...(restrictHalls ? { hallId: { in: allowedHallIds } } : {})
        },
        orderBy: [{ hall: { name: "asc" } }, { name: "asc" }],
        include: { hall: { select: { id: true, name: true } } }
      })
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

    const preset = await prisma.hallMapPreset.create({
      data: {
        organizationId: actor.organizationId,
        hallId: hall.id,
        name: input.name,
        objects: input.objects
      },
      include: { hall: { select: { id: true, name: true } } }
    });
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
    const current = await prisma.hallMapPreset.findFirst({
      where: {
        id: input.id,
        organizationId: actor.organizationId,
        ...(restrictHalls ? { hallId: { in: allowedHallIds } } : {})
      },
      select: { id: true, hallId: true }
    });
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

    const preset = await prisma.hallMapPreset.update({
      where: { id: current.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.hallId !== undefined ? { hallId: input.hallId } : {}),
        ...(input.objects !== undefined ? { objects: input.objects } : {})
      },
      include: { hall: { select: { id: true, name: true } } }
    });
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
    const preset = await prisma.hallMapPreset.findFirst({
      where: {
        id: input.id,
        organizationId: actor.organizationId,
        ...(restrictHalls ? { hallId: { in: allowedHallIds } } : {})
      },
      select: { id: true }
    });
    if (!preset) {
      return NextResponse.json(
        { error: "Hall map preset not found." },
        { status: 404 }
      );
    }

    await prisma.hallMapPreset.delete({ where: { id: preset.id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
