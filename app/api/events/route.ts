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

export async function GET(request: Request) {
  try {
    const actor = await requireAnyPermission(request, [
      "canViewCalendar",
      "canViewEventManager"
    ]);
    const allowedHallIds = actor.access?.allowedHallIds ?? [];
    const restrictHalls =
      !isAdministrativeRole(actor.membership.role) && allowedHallIds.length > 0;

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

    const diningManagerNotesByEventId = await listDiningManagerNotes(
      actor.organizationId,
      events.map((event) => event.id)
    );

    return NextResponse.json({
      events: events.map((event) => ({
        ...event,
        diningManagerNotes: diningManagerNotesByEventId.get(event.id) ?? null
      })),
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
