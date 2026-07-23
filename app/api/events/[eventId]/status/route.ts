import { NextResponse } from "next/server";
import { isAdministrativeRole } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/server-auth";
import { transitionBookingSchema } from "@/features/bookings/validations/booking.schema";
import { transitionBooking } from "@/features/bookings/services/booking.service";
import { createApiErrorResponse } from "@/lib/http/api-error";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const actor = await requirePermission(request, "canCreateBooking");
    const { eventId } = await context.params;
    const input = transitionBookingSchema.parse(await request.json());
    const event = await transitionBooking(
      eventId,
      input.status,
      input.expectedVersion,
      input.holdDurationMinutes,
      {
        id: actor.id,
        name: actor.name,
        organizationId: actor.organizationId,
        allowedHallIds: isAdministrativeRole(actor.membership.role)
          ? []
          : (actor.access?.allowedHallIds ?? [])
      }
    );
    return NextResponse.json({ event });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
