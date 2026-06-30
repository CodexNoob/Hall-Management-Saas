import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateKitchenSheetPdf } from "@/lib/pdf/kitchen-sheet";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { hall: true }
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const menuItems = event.menuItemIds.length
    ? await prisma.menuItem.findMany({
        where: {
          id: { in: event.menuItemIds }
        }
      })
    : [];

  const pdf = await generateKitchenSheetPdf({
    eventName: `${event.clientName} ${event.eventType ?? "Event"}`,
    hallName: event.hall.name,
    eventDate: event.eventDate.toISOString().slice(0, 10),
    guestCount:
      event.menCount + event.ladiesCount + event.boysCount + event.girlsCount + event.kidsCount + event.couplesCount * 2,
    menuItems: menuItems.map((item) => item.name)
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${event.id}-kitchen-sheet.pdf"`
    }
  });
}
