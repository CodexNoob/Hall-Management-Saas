import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateKitchenSheetPdf } from "@/lib/pdf/kitchen-sheet";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      hall: true,
      menuItems: {
        include: {
          menuItem: true
        }
      }
    }
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const pdf = await generateKitchenSheetPdf({
    eventName: event.name,
    hallName: event.hall.name,
    eventDate: event.startsAt.toISOString().slice(0, 10),
    guestCount: event.guestCount,
    menuItems: event.menuItems.map((item) => item.menuItem.name)
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${event.id}-kitchen-sheet.pdf"`
    }
  });
}
