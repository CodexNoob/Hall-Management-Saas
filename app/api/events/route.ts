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
    const [events, halls, eventTypes, packages] = await Promise.all([
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
        where: { organizationId: actor.organizationId },
        orderBy: { name: "asc" }
      }),
      prisma.eventPackage.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        orderBy: { name: "asc" }
      })
    ]);

    return NextResponse.json({ events, halls, eventTypes, packages });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
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
