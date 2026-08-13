import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAnyPermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { countSchema, dimensionSchema } from "@/lib/validation/number";

const tableSchema = z.object({
  id: z.string().min(1).max(100),
  number: countSchema({ min: 1, label: "Table number" }),
  name: z.string().max(120).optional(),
  seats: countSchema({ max: 100, label: "Seats" }),
  side: z.enum(["men", "women", "kids", "head"]),
  isSeating: z.boolean().optional(),
  mapObjectId: z.string().max(100).optional(),
  mapType: z.string().max(40).optional(),
  // Bounded to match the equivalent geometry in app/api/hall-maps/route.ts;
  // these were previously bare z.number() with no finiteness or range check.
  x: dimensionSchema({ max: 10_000, label: "X" }).optional(),
  y: dimensionSchema({ max: 10_000, label: "Y" }).optional(),
  width: dimensionSchema({ max: 5_000, label: "Width" }).optional(),
  height: dimensionSchema({ max: 5_000, label: "Height" }).optional(),
  rotation: dimensionSchema({ max: 360, label: "Rotation" }).optional()
});

const saveDiningPlanSchema = z.object({
  eventId: z.string().uuid(),
  hallMapPresetId: z.string().uuid().nullable().optional(),
  countType: z.enum(["People", "Couples"]),
  adultCount: countSchema({ label: "Adults" }),
  childrenCount: countSchema({ label: "Children" }),
  menWaiters: countSchema({ max: 10_000, label: "Men waiters" }),
  womenWaiters: countSchema({ max: 10_000, label: "Women waiters" }),
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

type HallMapPresetRow = {
  id: string;
  hallId: string;
  name: string;
  objects: unknown;
};

type DiningPlanRow = {
  id: string;
  organizationId: string;
  eventId: string;
  hallMapPresetId: string | null;
  countType: string;
  adultCount: number;
  childrenCount: number;
  menWaiters: number;
  womenWaiters: number;
  tablecloth: string | null;
  washingTime: string | null;
  specialNotes: string | null;
  tables: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeTables(tables: unknown) {
  const parsed = z.array(tableSchema).safeParse(tables);
  return parsed.success ? parsed.data : [];
}

function formatDiningPlan(row: DiningPlanRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    eventId: row.eventId,
    hallMapPresetId: row.hallMapPresetId,
    countType: row.countType,
    adultCount: row.adultCount,
    childrenCount: row.childrenCount,
    menWaiters: row.menWaiters,
    womenWaiters: row.womenWaiters,
    tablecloth: row.tablecloth,
    washingTime: row.washingTime,
    specialNotes: row.specialNotes,
    tables: normalizeTables(row.tables),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function listHallMapPresets(organizationId: string) {
  const rows = await prisma.$queryRaw<HallMapPresetRow[]>`
    SELECT id, hall_id AS "hallId", name, objects
    FROM hall_map_presets
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY name ASC
  `;

  return rows.map((row) => ({
    ...row,
    objects: Array.isArray(row.objects) ? row.objects : []
  }));
}

async function listDiningPlans(organizationId: string, eventIds: string[]) {
  if (eventIds.length === 0) return [];

  const rows = await prisma.$queryRaw<DiningPlanRow[]>`
    SELECT
      id,
      organization_id AS "organizationId",
      event_id AS "eventId",
      hall_map_preset_id AS "hallMapPresetId",
      count_type AS "countType",
      adult_count AS "adultCount",
      children_count AS "childrenCount",
      men_waiters AS "menWaiters",
      women_waiters AS "womenWaiters",
      tablecloth,
      washing_time AS "washingTime",
      special_notes AS "specialNotes",
      tables,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM dining_plans
    WHERE organization_id = ${organizationId}::uuid
      AND event_id = ANY(${eventIds}::uuid[])
  `;

  return rows.map(formatDiningPlan);
}

async function findHallPreset(
  id: string,
  organizationId: string,
  hallId: string
) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM hall_map_presets
    WHERE id = ${id}::uuid
      AND organization_id = ${organizationId}::uuid
      AND hall_id = ${hallId}::uuid
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function GET(request: Request) {
  try {
    const actor = await requireAnyPermission(request, [...diningPermissions]);
    const events = await prisma.event.findMany({
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
        hall: { select: { id: true, name: true } }
      }
    });
    const [hallMapPresets, diningPlans] = await Promise.all([
      listHallMapPresets(actor.organizationId),
      listDiningPlans(
        actor.organizationId,
        events.map((event) => event.id)
      )
    ]);
    const diningPlanByEventId = new Map(
      diningPlans.map((plan) => [plan.eventId, plan])
    );

    return NextResponse.json({
      events: events.map((event) => ({
        ...event,
        diningPlan: diningPlanByEventId.get(event.id) ?? null
      })),
      hallMapPresets
    });
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
      const preset = await findHallPreset(
        input.hallMapPresetId,
        actor.organizationId,
        event.hallId
      );
      if (!preset) {
        return NextResponse.json(
          { error: "This map preset is not assigned to the event's hall." },
          { status: 400 }
        );
      }
    }

    const planId = crypto.randomUUID();

    const [plan] = await prisma.$queryRaw<DiningPlanRow[]>`
      INSERT INTO dining_plans (
        id,
        organization_id,
        event_id,
        hall_map_preset_id,
        count_type,
        adult_count,
        children_count,
        men_waiters,
        women_waiters,
        tablecloth,
        washing_time,
        special_notes,
        tables,
        created_at,
        updated_at
      ) VALUES (
        ${planId}::uuid,
        ${actor.organizationId}::uuid,
        ${input.eventId}::uuid,
        ${input.hallMapPresetId ?? null}::uuid,
        ${input.countType},
        ${input.adultCount},
        ${input.childrenCount},
        ${input.menWaiters},
        ${input.womenWaiters},
        ${input.tablecloth || null},
        ${input.washingTime || null},
        ${input.specialNotes || null},
        ${JSON.stringify(input.tables)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (event_id) DO UPDATE SET
        hall_map_preset_id = EXCLUDED.hall_map_preset_id,
        count_type = EXCLUDED.count_type,
        adult_count = EXCLUDED.adult_count,
        children_count = EXCLUDED.children_count,
        men_waiters = EXCLUDED.men_waiters,
        women_waiters = EXCLUDED.women_waiters,
        tablecloth = EXCLUDED.tablecloth,
        washing_time = EXCLUDED.washing_time,
        special_notes = EXCLUDED.special_notes,
        tables = EXCLUDED.tables,
        updated_at = NOW()
      RETURNING
        id,
        organization_id AS "organizationId",
        event_id AS "eventId",
        hall_map_preset_id AS "hallMapPresetId",
        count_type AS "countType",
        adult_count AS "adultCount",
        children_count AS "childrenCount",
        men_waiters AS "menWaiters",
        women_waiters AS "womenWaiters",
        tablecloth,
        washing_time AS "washingTime",
        special_notes AS "specialNotes",
        tables,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    return NextResponse.json({ plan: formatDiningPlan(plan) });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
