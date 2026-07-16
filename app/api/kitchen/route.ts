import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const statusSchema = z.object({
  eventId: z.string().uuid(),
  menuItemId: z.string().uuid(),
  status: z.string().trim().min(1),
  assignedWorkerId: z.string().uuid().nullable().optional()
});

export async function GET(request: Request) {
  try {
    const actor = await requirePermission(request, "canViewKitchenDashboard");
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 28);

    const [events, workers] = await Promise.all([
      prisma.event.findMany({
        where: {
          organizationId: actor.organizationId,
          deleted: false,
          eventDate: { gte: start, lt: end }
        },
        include: {
          hall: true,
          package: true,
          kitchenItemStatuses: {
            include: { menuItem: true, assignedWorker: true }
          }
        },
        orderBy: { eventDate: "asc" }
      }),
      prisma.kitchenWorker.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        orderBy: { name: "asc" }
      })
    ]);

    return NextResponse.json({ events, workers });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requirePermission(request, "canUpdateKitchenStatus");
    const input = statusSchema.parse(await request.json());
    const event = await prisma.event.findFirst({
      where: {
        id: input.eventId,
        organizationId: actor.organizationId,
        deleted: false
      },
      select: { id: true }
    });
    const menuItem = await prisma.menuItem.findFirst({
      where: { id: input.menuItemId, organizationId: actor.organizationId },
      select: { id: true }
    });

    if (!event || !menuItem) {
      return NextResponse.json(
        { error: "Event or menu item not found." },
        { status: 404 }
      );
    }

    const itemStatus = await prisma.kitchenItemStatus.upsert({
      where: {
        eventId_menuItemId: { eventId: event.id, menuItemId: menuItem.id }
      },
      update: {
        status: input.status,
        assignedWorkerId: input.assignedWorkerId,
        updatedById: actor.id
      },
      create: {
        organizationId: actor.organizationId,
        eventId: event.id,
        menuItemId: menuItem.id,
        status: input.status,
        assignedWorkerId: input.assignedWorkerId,
        updatedById: actor.id
      }
    });

    return NextResponse.json({ itemStatus });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
