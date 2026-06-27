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
    title: event.name,
    description: event.notes ?? undefined,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location: event.hall.name,
    googleCalendarEventId: event.googleCalendarEventId
  });

  if (!result.skipped && result.eventId && result.eventId !== event.googleCalendarEventId) {
    await prisma.event.update({
      where: { id: event.id },
      data: { googleCalendarEventId: result.eventId }
    });
  }

  return NextResponse.json(result);
}
