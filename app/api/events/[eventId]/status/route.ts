import { NextResponse } from "next/server";
import { authorize, requireUserActor } from "@/lib/authz/authorize";
import { transitionBookingSchema } from "@/features/bookings/validations/booking.schema";
import { transitionBooking } from "@/features/bookings/services/booking.service";
import { createApiErrorResponse } from "@/lib/http/api-error";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const actor = await authorize(request, "event.status.update");
    const { eventId } = await context.params;
    const input = transitionBookingSchema.parse(await request.json());
    const event = await transitionBooking(
      eventId,
      input.status,
      input.expectedVersion,
      input.holdDurationMinutes,
      {
        id: requireUserActor(actor),
        name: actor.actorName,
        organizationId: actor.organizationId,
        hallScope: actor.scope.hallIds
      }
    );
    return NextResponse.json({ event });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
