import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActivity } from "@/lib/audit/activity-log";
import { assertInScope, authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { upsertGoogleCalendarEvent } from "@/lib/google/calendar";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";

export const POST = withRoute(
  "POST /api/events/[eventId]/calendar",
  async (
  request: Request,
    { params }: { params: Promise<{ eventId: string }> }
  ) => {
    try {
      const actor = await authorize(request, "event.update");
      const { eventId: rawEventId } = await params;
      const eventId = z.string().uuid().parse(rawEventId);
      const event = await prisma.event.findFirst({
        where: {
          id: eventId,
          organizationId: actor.organizationId,
          deleted: false
        },
        include: { hall: true }
      });

      if (!event) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }

      assertInScope(actor, "hall", event.hallId);

      const result = await upsertGoogleCalendarEvent({
        title: `${event.clientName} ${event.eventType ?? "Event"}`,
        description: event.notes ?? undefined,
        startsAt: event.eventDate,
        endsAt: new Date(event.eventDate.getTime() + 4 * 60 * 60 * 1000),
        location: event.hall.name,
        googleCalendarEventId: event.googleCalendarEventId
      });

      if (
        !result.skipped &&
        result.eventId &&
        result.eventId !== event.googleCalendarEventId
      ) {
        await prisma.$transaction(async (transaction) => {
          await transaction.event.update({
            where: { id: event.id, organizationId: actor.organizationId },
            data: {
              googleCalendarEventId: result.eventId,
              googleSyncStatus: "Synced",
              googleLastSyncedAt: new Date(),
              googleSyncError: null,
              updatedById: actor.userId
            }
          });

          // Recorded only when the push actually landed a NEW calendar entry.
          // A skipped push - the integration is off - changed nothing, and a
          // re-push of an event already synced is a no-op the history should
          // not fill up with. The Google id is deliberately not in the payload:
          // it is a handle into a third party's calendar, not this
          // organization's history.
          await recordActivity(transaction, actor, {
            action: "event.calendar.exported",
            eventId: event.id,
            clientId: event.clientId,
            message: `Sent ${event.clientName}'s event to Google Calendar.`
          });
        });
      }

      return NextResponse.json(result);
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
