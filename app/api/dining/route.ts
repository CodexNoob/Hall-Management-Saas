import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAnyPermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const tableSchema = z.object({
  id: z.string().min(1).max(100),
  number: z.number().int().positive(),
  seats: z.number().int().min(1).max(100),
  side: z.enum(["men", "women", "kids", "head"])
});

const saveDiningPlanSchema = z.object({
  eventId: z.string().uuid(),
  hallMapPresetId: z.string().uuid().nullable().optional(),
  countType: z.enum(["People", "Couples"]),
  adultCount: z.number().int().min(0).max(100000),
  childrenCount: z.number().int().min(0).max(100000),
  menWaiters: z.number().int().min(0).max(10000),
  womenWaiters: z.number().int().min(0).max(10000),
  tablecloth: z.string().trim().max(100).optional(),
  washingTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  specialNotes: z.string().trim().max(10000).optional(),
  tables: z.array(tableSchema).max(500)
});

const diningPermissions = [
  "canViewEventManager",
  "canViewKitchenDashboard"
] as const;

export async function GET(request: Request) {
  try {
    const actor = await requireAnyPermission(request, [...diningPermissions]);
    const [events, hallMapPresets] = await Promise.all([
      prisma.event.findMany({
        where: {
          organizationId: actor.organizationId,
          deleted: false,
          bookingStatus: { notIn: ["CANCELLED", "EXPIRED"] }
        },
        orderBy: [{ eventDate: "asc" }, { startsAt: "asc" }],
        take: 100,
        select: {
        id: true,
        clientName: true,
        eventType: true,
        eventDate: true,
        startsAt: true,
        eventStatus: true,
        bookingStatus: true,
        packageName: true,
        couplesCount: true,
        menCount: true,
        ladiesCount: true,
        boysCount: true,
        girlsCount: true,
        kidsCount: true,
        waitersCount: true,
        tableclothName: true,
        washingTime: true,
        notes: true,
        hall: { select: { id: true, name: true } },
          diningPlan: true
        }
      }),
      prisma.hallMapPreset.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { name: "asc" },
        select: { id: true, hallId: true, name: true, objects: true }
      })
    ]);

    return NextResponse.json({ events, hallMapPresets });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAnyPermission(request, [...diningPermissions]);
    const input = saveDiningPlanSchema.parse(await request.json());
    const event = await prisma.event.findFirst({
      where: {
        id: input.eventId,
        organizationId: actor.organizationId,
        deleted: false
      },
      select: { id: true, hallId: true }
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found in this organization." },
        { status: 404 }
      );
    }

    if (input.hallMapPresetId) {
      const preset = await prisma.hallMapPreset.findFirst({
        where: {
          id: input.hallMapPresetId,
          organizationId: actor.organizationId,
          hallId: event.hallId
        },
        select: { id: true }
      });
      if (!preset) {
        return NextResponse.json(
          { error: "This map preset is not assigned to the event's hall." },
          { status: 400 }
        );
      }
    }

    const data = {
      organizationId: actor.organizationId,
      hallMapPresetId: input.hallMapPresetId ?? null,
      countType: input.countType,
      adultCount: input.adultCount,
      childrenCount: input.childrenCount,
      menWaiters: input.menWaiters,
      womenWaiters: input.womenWaiters,
      tablecloth: input.tablecloth || null,
      washingTime: input.washingTime || null,
      specialNotes: input.specialNotes || null,
      tables: input.tables
    };
    const plan = await prisma.diningPlan.upsert({
      where: { eventId: input.eventId },
      create: { ...data, eventId: input.eventId },
      update: data
    });

    return NextResponse.json({ plan });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
