import { NextResponse } from "next/server";
import { isAdministrativeRole } from "@/lib/auth/roles";
import {
  requireAnyPermission,
  requirePermission
} from "@/lib/auth/server-auth";
import { createBookingSchema } from "@/features/bookings/validations/booking.schema";
import {
  createBooking,
  expireOrganizationHolds
} from "@/features/bookings/services/booking.service";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

function dailyEventLimitFromIntegrations(integrations: unknown) {
  if (
    integrations &&
    typeof integrations === "object" &&
    "calendar" in integrations
  ) {
    const calendar = (integrations as { calendar?: unknown }).calendar;
    if (calendar && typeof calendar === "object") {
      const dailyEventLimit = (calendar as { dailyEventLimit?: unknown })
        .dailyEventLimit;
      if (typeof dailyEventLimit === "number" && Number.isFinite(dailyEventLimit)) {
        return dailyEventLimit;
      }
    }
  }

  return 2;
}

async function listDiningManagerNotes(
  organizationId: string,
  eventIds: string[]
) {
  if (eventIds.length === 0) return new Map<string, string>();

  const rows = await prisma.$queryRaw<
    Array<{ eventId: string; specialNotes: string | null }>
  >`
    SELECT event_id AS "eventId", special_notes AS "specialNotes"
    FROM dining_plans
    WHERE organization_id = ${organizationId}::uuid
      AND event_id = ANY(${eventIds}::uuid[])
      AND special_notes IS NOT NULL
      AND btrim(special_notes) <> ''
  `;

  return new Map(
    rows.map((row) => [row.eventId, row.specialNotes?.trim() ?? ""])
  );
}

type DiningHallMapPresetRow = {
  eventId: string;
  hallMapPresetId: string | null;
  hallMapPresetName: string | null;
  hallMapPresetObjects: unknown;
};

async function listDiningHallMapPresets(
  organizationId: string,
  eventIds: string[]
) {
  if (eventIds.length === 0) {
    return new Map<string, DiningHallMapPresetRow>();
  }

  const rows = await prisma.$queryRaw<DiningHallMapPresetRow[]>`
    SELECT
      dp.event_id AS "eventId",
      dp.hall_map_preset_id AS "hallMapPresetId",
      hmp.name AS "hallMapPresetName",
      hmp.objects AS "hallMapPresetObjects"
    FROM dining_plans dp
    LEFT JOIN hall_map_presets hmp
      ON hmp.id = dp.hall_map_preset_id
      AND hmp.organization_id = dp.organization_id
    WHERE dp.organization_id = ${organizationId}::uuid
      AND dp.event_id = ANY(${eventIds}::uuid[])
  `;

  return new Map(rows.map((row) => [row.eventId, row]));
}

async function listEventActivityLogs(organizationId: string, eventIds: string[]) {
  if (eventIds.length === 0) {
    return new Map<string, Array<{
      id: string;
      actionType: string;
      message: string;
      userName: string | null;
      createdAt: Date;
    }>>();
  }

  const activityLogs = await prisma.activityLog.findMany({
    where: {
      organizationId,
      eventId: { in: eventIds }
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      eventId: true,
      actionType: true,
      message: true,
      userName: true,
      createdAt: true
    },
    take: eventIds.length * 8
  });

  const logsByEventId = new Map<string, Array<{
    id: string;
    actionType: string;
    message: string;
    userName: string | null;
    createdAt: Date;
  }>>();

  for (const log of activityLogs) {
    if (!log.eventId) continue;

    const eventLogs = logsByEventId.get(log.eventId) ?? [];
    if (eventLogs.length >= 8) continue;

    eventLogs.push({
      id: log.id,
      actionType: log.actionType,
      message: log.message,
      userName: log.userName,
      createdAt: log.createdAt
    });
    logsByEventId.set(log.eventId, eventLogs);
  }

  return logsByEventId;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const actor = await requireAnyPermission(request, [
      "canViewCalendar",
      "canViewEventManager"
    ]);
    const allowedHallIds = actor.access?.allowedHallIds ?? [];
    const restrictHalls =
      !isAdministrativeRole(actor.membership.role) && allowedHallIds.length > 0;
    // The list below is capped, so an event a caller opened by id can fall
    // outside it - the workspace then had nothing to select and quietly showed
    // a different event instead. Naming it here guarantees it is in the answer.
    const requestedEventId =
      new URL(request.url).searchParams.get("eventId") ?? "";

    await expireOrganizationHolds(actor.organizationId);
    const [events, halls, eventTypes, packages, settings] = await Promise.all([
      prisma.event.findMany({
        where: {
          organizationId: actor.organizationId,
          deleted: false,
          ...(restrictHalls ? { hallId: { in: allowedHallIds } } : {})
        },
        orderBy: [{ startsAt: "asc" }, { eventDate: "asc" }],
        include: { hall: true, package: true, client: true },
        take: 100
      }),
      prisma.hall.findMany({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
          isBookable: true,
          ...(restrictHalls ? { id: { in: allowedHallIds } } : {})
        },
        orderBy: { name: "asc" }
      }),
      prisma.eventType.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        orderBy: { name: "asc" }
      }),
      prisma.eventPackage.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        orderBy: { name: "asc" }
      }),
      prisma.organizationSetting.upsert({
        where: { organizationId: actor.organizationId },
        update: {},
        create: { organizationId: actor.organizationId }
      })
    ]);

    if (
      UUID_PATTERN.test(requestedEventId) &&
      !events.some((event) => event.id === requestedEventId)
    ) {
      const requested = await prisma.event.findFirst({
        where: {
          id: requestedEventId,
          organizationId: actor.organizationId,
          deleted: false,
          // Still behind the same hall restriction: naming an id is not a way
          // around what this actor is allowed to see.
          ...(restrictHalls ? { hallId: { in: allowedHallIds } } : {})
        },
        include: { hall: true, package: true, client: true }
      });

      if (requested) events.push(requested);
    }

    const eventIds = events.map((event) => event.id);
    const [
      diningManagerNotesByEventId,
      diningHallMapPresetByEventId,
      activityLogsByEventId
    ] = await Promise.all([
        listDiningManagerNotes(actor.organizationId, eventIds),
        listDiningHallMapPresets(actor.organizationId, eventIds),
        listEventActivityLogs(actor.organizationId, eventIds)
      ]);

    return NextResponse.json({
      events: events.map((event) => {
        const diningHallMapPreset = diningHallMapPresetByEventId.get(event.id);

        return {
          ...event,
          diningManagerNotes: diningManagerNotesByEventId.get(event.id) ?? null,
          activityLogs: activityLogsByEventId.get(event.id) ?? [],
          diningHallMapPreset:
            diningHallMapPreset?.hallMapPresetId &&
            diningHallMapPreset.hallMapPresetName
              ? {
                  id: diningHallMapPreset.hallMapPresetId,
                  name: diningHallMapPreset.hallMapPresetName,
                  objects: Array.isArray(
                    diningHallMapPreset.hallMapPresetObjects
                  )
                    ? diningHallMapPreset.hallMapPresetObjects
                    : []
                }
              : null
        };
      }),
      halls,
      eventTypes,
      packages,
      calendarSettings: {
        dailyEventLimit: dailyEventLimitFromIntegrations(settings.integrations)
      }
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "event-create",
      limit: 30,
      windowMs: 60 * 1000
    });
    if (limited) return limited;

    const actor = await requirePermission(request, "canCreateBooking");
    const body = (await request.json()) as Record<string, unknown>;
    const headerKey = request.headers.get("idempotency-key") ?? undefined;
    const input = createBookingSchema.parse({
      ...body,
      idempotencyKey: headerKey ?? body.idempotencyKey
    });
    const result = await createBooking(input, {
      id: actor.id,
      name: actor.name,
      organizationId: actor.organizationId,
      allowedHallIds: isAdministrativeRole(actor.membership.role)
        ? []
        : (actor.access?.allowedHallIds ?? [])
    });

    return NextResponse.json(result, {
      status: result.replayed ? 200 : 201,
      headers: result.replayed ? { "Idempotent-Replay": "true" } : undefined
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
