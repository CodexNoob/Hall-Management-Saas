import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdministrativeRole } from "@/lib/auth/roles";
import {
  requireAnyPermission,
  requirePermission
} from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

/**
 * The one booking state the kitchen cooks for.
 *
 * Named rather than inlined because the PATCH below has to answer the same
 * question: an event that leaves this state stops being the kitchen's business,
 * and a status write against one that is not in it should not be accepted.
 */
const CONFIRMED_STATUS = "CONFIRMED";

const kitchenMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    eventId: z.string().uuid(),
    menuItemId: z.string().uuid(),
    status: z.enum(["PENDING", "COMPLETE"])
  }),
  z.object({
    action: z.literal("reset-status"),
    eventId: z.string().uuid(),
    menuItemId: z.string().uuid()
  }),
  z.object({
    action: z.literal("assign-worker"),
    eventId: z.string().uuid(),
    menuItemId: z.string().uuid(),
    assignedWorkerId: z.string().uuid().nullable()
  }),
  z.object({
    action: z.literal("replace-menu-item"),
    eventId: z.string().uuid(),
    menuItemId: z.string().uuid(),
    replacementMenuItemId: z.string().uuid()
  }),
  z.object({
    action: z.literal("remove-menu-item"),
    eventId: z.string().uuid(),
    menuItemId: z.string().uuid()
  })
]);

export async function GET(request: Request) {
  try {
    const actor = await requirePermission(request, "canViewKitchenDashboard");
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 28);

    const [events, workers, menuItems] = await Promise.all([
      prisma.event.findMany({
        where: {
          organizationId: actor.organizationId,
          deleted: false,
          // Only the events the hall is committed to. Without this the board
          // listed inquiries, expired holds and cancelled bookings beside real
          // work, so a kitchen reading today's list could not tell what it was
          // actually cooking.
          //
          // `bookingStatus`, not `eventStatus`: the lifecycle in
          // `booking.service.ts` is the only writer of this column, while
          // `eventStatus` is a display label PATCH /api/events/[eventId] still
          // accepts as "Confirmed" or "Hold" - so a caller sending it for a
          // cancelled event would relabel it and put it back on this board.
          bookingStatus: CONFIRMED_STATUS,
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
      }),
      prisma.menuItem.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        orderBy: [{ category: "asc" }, { name: "asc" }]
      })
    ]);

    const menuItemById = new Map(menuItems.map((item) => [item.id, item]));
    const eventsWithMenuItems = events.map((event) => {
      const statusByMenuItemId = new Map(
        event.kitchenItemStatuses.map((itemStatus) => [
          itemStatus.menuItemId,
          itemStatus
        ])
      );

      return {
        ...event,
        menuItems: event.menuItemIds
          .map((menuItemId) => {
            const item = menuItemById.get(menuItemId);
            const itemStatus = statusByMenuItemId.get(menuItemId);

            if (!item) return null;

            return {
              id: item.id,
              name: item.name,
              category: item.category,
              status: itemStatus?.status ?? null,
              assignedWorkerId: itemStatus?.assignedWorkerId ?? null,
              assignedWorkerName: itemStatus?.assignedWorker?.name ?? null
            };
          })
          .filter(Boolean)
      };
    });

    const canManageEverything = isAdministrativeRole(actor.membership.role);

    return NextResponse.json({
      events: eventsWithMenuItems,
      workers,
      menuItems,
      permissions: {
        canEditMenu: canManageEverything || Boolean(actor.access?.canEditMenu),
        canAssignWorkers:
          canManageEverything || Boolean(actor.access?.canAssignWorkers),
        canUpdateKitchenStatus:
          canManageEverything || Boolean(actor.access?.canUpdateKitchenStatus),
        canAddKitchenEvents:
          canManageEverything || Boolean(actor.access?.canAddKitchenEvents)
      }
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAnyPermission(request, [
      "canEditMenu",
      "canAssignWorkers",
      "canUpdateKitchenStatus"
    ]);
    const input = kitchenMutationSchema.parse(await request.json());
    const isAdmin = isAdministrativeRole(actor.membership.role);
    const canEditMenu = isAdmin || Boolean(actor.access?.canEditMenu);
    const canAssignWorkers = isAdmin || Boolean(actor.access?.canAssignWorkers);
    const canUpdateKitchenStatus =
      isAdmin || Boolean(actor.access?.canUpdateKitchenStatus);

    if (
      (input.action === "replace-menu-item" ||
        input.action === "remove-menu-item") &&
      !canEditMenu
    ) {
      return NextResponse.json(
        { error: "You do not have permission to edit the kitchen menu." },
        { status: 403 }
      );
    }

    if (input.action === "assign-worker" && !canAssignWorkers) {
      return NextResponse.json(
        { error: "You do not have permission to assign kitchen workers." },
        { status: 403 }
      );
    }

    if (
      (input.action === "status" || input.action === "reset-status") &&
      !canUpdateKitchenStatus
    ) {
      return NextResponse.json(
        { error: "You do not have permission to update kitchen status." },
        { status: 403 }
      );
    }

    const event = await prisma.event.findFirst({
      where: {
        id: input.eventId,
        organizationId: actor.organizationId,
        deleted: false,
        // Matches the GET. A board left open when an event is cancelled would
        // otherwise keep writing statuses, assignments and menu edits against a
        // booking that is off - and those writes are what the kitchen reads
        // back as work to do.
        bookingStatus: CONFIRMED_STATUS
      },
      select: { id: true, eventDate: true, hallName: true, menuItemIds: true }
    });
    const menuItem = await prisma.menuItem.findFirst({
      where: { id: input.menuItemId, organizationId: actor.organizationId },
      select: { id: true, name: true }
    });

    if (!event || !menuItem) {
      return NextResponse.json(
        { error: "Event or menu item not found." },
        { status: 404 }
      );
    }

    if (input.action === "replace-menu-item") {
      const replacement = await prisma.menuItem.findFirst({
        where: {
          id: input.replacementMenuItemId,
          organizationId: actor.organizationId,
          isActive: true
        },
        select: { id: true, name: true }
      });

      if (!replacement) {
        return NextResponse.json(
          { error: "Replacement menu item not found." },
          { status: 404 }
        );
      }

      const nextMenuItemIds = event.menuItemIds.map((itemId) =>
        itemId === menuItem.id ? replacement.id : itemId
      );

      const updatedEvent = await prisma.event.update({
        where: { id: event.id },
        data: { menuItemIds: nextMenuItemIds, updatedById: actor.id },
        select: { id: true, menuItemIds: true }
      });

      await prisma.kitchenItemStatus.deleteMany({
        where: { eventId: event.id, menuItemId: menuItem.id }
      });
      await prisma.kitchenNotification.create({
        data: {
          organizationId: actor.organizationId,
          eventId: event.id,
          notificationType: "MENU_ITEM_REPLACED",
          eventDate: event.eventDate,
          hallOrRoom: event.hallName,
          message: `${menuItem.name} was replaced with ${replacement.name}.`,
          oldValue: { menuItemId: menuItem.id, name: menuItem.name },
          newValue: { menuItemId: replacement.id, name: replacement.name },
          changedById: actor.id
        }
      });

      return NextResponse.json({ event: updatedEvent });
    }

    if (input.action === "remove-menu-item") {
      const updatedEvent = await prisma.event.update({
        where: { id: event.id },
        data: {
          menuItemIds: event.menuItemIds.filter(
            (itemId) => itemId !== menuItem.id
          ),
          updatedById: actor.id
        },
        select: { id: true, menuItemIds: true }
      });

      await prisma.kitchenItemStatus.deleteMany({
        where: { eventId: event.id, menuItemId: menuItem.id }
      });
      await prisma.kitchenNotification.create({
        data: {
          organizationId: actor.organizationId,
          eventId: event.id,
          notificationType: "MENU_ITEM_REMOVED",
          eventDate: event.eventDate,
          hallOrRoom: event.hallName,
          message: `${menuItem.name} was removed from the kitchen menu.`,
          oldValue: { menuItemId: menuItem.id, name: menuItem.name },
          changedById: actor.id
        }
      });

      return NextResponse.json({ event: updatedEvent });
    }

    if (input.action === "reset-status") {
      await prisma.kitchenItemStatus.deleteMany({
        where: { eventId: event.id, menuItemId: menuItem.id }
      });

      return NextResponse.json({ itemStatus: null });
    }

    const itemStatus = await prisma.kitchenItemStatus.upsert({
      where: {
        eventId_menuItemId: { eventId: event.id, menuItemId: menuItem.id }
      },
      update: {
        status: input.action === "status" ? input.status : "PENDING",
        assignedWorkerId:
          input.action === "assign-worker" ? input.assignedWorkerId : undefined,
        updatedById: actor.id
      },
      create: {
        organizationId: actor.organizationId,
        eventId: event.id,
        menuItemId: menuItem.id,
        status: input.action === "status" ? input.status : "PENDING",
        assignedWorkerId:
          input.action === "assign-worker" ? input.assignedWorkerId : null,
        updatedById: actor.id
      }
    });

    return NextResponse.json({ itemStatus });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
