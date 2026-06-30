import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertGoogleCalendarEvent } from "@/lib/google/calendar";

export async function POST(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { hall: true }
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const result = await upsertGoogleCalendarEvent({
    title: `${event.clientName} ${event.eventType ?? "Event"}`,
    description: event.notes ?? undefined,
    startsAt: event.eventDate,
    endsAt: new Date(event.eventDate.getTime() + 4 * 60 * 60 * 1000),
    location: event.hall.name,
    googleCalendarEventId: event.googleCalendarEventId
  });

  if (!result.skipped && result.eventId && result.eventId !== event.googleCalendarEventId) {
    await prisma.event.update({
      where: { id: event.id },
      data: {
        googleCalendarEventId: result.eventId,
        googleSyncStatus: "Synced",
        googleLastSyncedAt: new Date(),
        googleSyncError: null
      }
    });
  }

  return NextResponse.json(result);
}
