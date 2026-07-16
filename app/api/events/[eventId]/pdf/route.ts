import { NextResponse } from "next/server";
import { z } from "zod";
import { assertHallAccess, requireAnyPermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { generateKitchenSheetPdf } from "@/lib/pdf/kitchen-sheet";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const actor = await requireAnyPermission(request, [
      "canViewEventManager",
      "canViewKitchenDashboard"
    ]);
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

    assertHallAccess(actor, event.hallId);

    const menuItems = event.menuItemIds.length
      ? await prisma.menuItem.findMany({
          where: {
            organizationId: actor.organizationId,
            id: { in: event.menuItemIds }
          }
        })
      : [];

    const pdf = await generateKitchenSheetPdf({
      eventName: `${event.clientName} ${event.eventType ?? "Event"}`,
      hallName: event.hall.name,
      eventDate: event.eventDate.toISOString().slice(0, 10),
      guestCount:
        event.menCount +
        event.ladiesCount +
        event.boysCount +
        event.girlsCount +
        event.kidsCount +
        event.couplesCount * 2,
      menuItems: menuItems.map((item) => item.name)
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${event.id}-kitchen-sheet.pdf"`
      }
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
