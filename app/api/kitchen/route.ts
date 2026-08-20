import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  boardStatusSelect,
  buildKitchenSheet,
  DEFAULT_MEAL,
  eventSelect,
  kitchenMenuSelect,
  type StatusRow
} from "@/features/kitchen/server/kitchen-sheet";
import { isAdministrativeRole } from "@/lib/auth/roles";
import {
  assertHallAccess,
  requireAnyPermission,
  requirePermission
} from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { syncKitchenStaffWorkers } from "@/features/kitchen/server/kitchen-staff-workers";

/**
 * The one booking state the kitchen cooks for.
 *
 * Named rather than inlined because the PATCH below has to answer the same
 * question: an event that leaves this state stops being the kitchen's business,
 * and a status write against one that is not in it should not be accepted.
 */
const CONFIRMED_STATUS = "CONFIRMED";

/**
 * How far ahead the board plans, in days.
 */
const WINDOW_DAYS = 28;

/**
 * Progress, and nothing else.
 *
 * `replace-menu-item` and `remove-menu-item` used to live here. They wrote only
 * `Event.menuItemIds` - the legacy mirror - so a dish swapped on the board never
 * reached `EventMenuLine`, which is what the event's Menu tab, this board's own
 * quantity arithmetic and the client portal all read. The two views of one menu
 * silently diverged from the moment anyone used them.
 *
 * Menu content is now changed on the Menu tab, which owns those lines. The board
 * reports what the kitchen has done, which is the only thing it knows that
 * nothing upstream does.
 */
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
  })
]);

/**
 * Everything the board draws for one event, on top of what the sheet needs.
 *
 * `startsAt` is here because a kitchen works against time to service, not
 * against the date - and the board printed a live clock for months with nothing
 * to compare it to.
 */
const boardEventSelect = {
  ...eventSelect,
  clientName: true,
  eventDate: true,
  eventType: true,
  eventStatus: true,
  startsAt: true,
  packageName: true,
  hall: { select: { name: true } }
} satisfies Prisma.EventSelect;

/**
 * The halls this actor may see, as a `where` fragment.
 *
 * Same shape `/api/events` and `/api/dashboard` use. An empty list means the
 * member is not hall-restricted at all, which is why it cannot be passed
 * straight to `hallId: { in: [] }`.
 */
function hallFilter(actor: {
  membership: { role: string };
  access?: { allowedHallIds?: string[] } | null;
}) {
  const allowedHallIds = actor.access?.allowedHallIds ?? [];
  const restrictHalls =
    !isAdministrativeRole(actor.membership.role) && allowedHallIds.length > 0;

  return restrictHalls ? { hallId: { in: allowedHallIds } } : {};
}

export async function GET(request: Request) {
  try {
    const actor = await requirePermission(request, "canViewKitchenDashboard");
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + WINDOW_DAYS);

    const [events, workers] = await Promise.all([
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
          eventDate: { gte: start, lt: end },
          // A kitchen lead restricted to one hall was still served every hall's
          // production, because this query only ever scoped by organization.
          ...hallFilter(actor)
        },
        select: boardEventSelect,
        orderBy: { eventDate: "asc" }
      }),
      syncKitchenStaffWorkers(actor.organizationId)
    ]);

    const eventIds = events.map((event) => event.id);
    // Two queries for the whole window rather than two per event. The board
    // spans four weeks, so the per-event route's shape - which is the right one
    // for a single event - would be up to a hundred round-trips here.
    const [menus, statuses] = await Promise.all([
      prisma.eventMenu.findMany({
        where: {
          eventId: { in: eventIds },
          organizationId: actor.organizationId,
          meal: DEFAULT_MEAL
        },
        select: { ...kitchenMenuSelect, eventId: true }
      }),
      prisma.kitchenItemStatus.findMany({
        where: {
          eventId: { in: eventIds },
          organizationId: actor.organizationId
        },
        select: boardStatusSelect
      })
    ]);

    const menuByEventId = new Map(menus.map((menu) => [menu.eventId, menu]));
    const statusesByEventId = new Map<string, StatusRow[]>();

    for (const itemStatus of statuses) {
      const current = statusesByEventId.get(itemStatus.eventId) ?? [];
      current.push(itemStatus);
      statusesByEventId.set(itemStatus.eventId, current);
    }

    const boardEvents = events.map((event) => {
      // The same builder the event's own kitchen tab runs, so a card's progress
      // ratio and that tab's can never disagree. No signed pictures: the board
      // lists events, not dishes, and signing a four week window of thumbnails
      // nobody renders is a storage round-trip per event.
      const sheet = buildKitchenSheet({
        event,
        meal: DEFAULT_MEAL,
        menu: menuByEventId.get(event.id) ?? null,
        statuses: statusesByEventId.get(event.id) ?? []
      });

      return {
        id: event.id,
        clientName: event.clientName,
        eventDate: event.eventDate,
        eventType: event.eventType,
        eventStatus: event.eventStatus,
        startsAt: event.startsAt,
        packageName: event.packageName,
        hall: { name: event.hall.name },
        // Deliberately without `lines`. The card draws a ratio and a time; the
        // dish list is fetched per event by the details dialog, from the route
        // that already signs its pictures.
        menuStatus: sheet.menuStatus,
        counts: sheet.counts,
        summary: sheet.summary
      };
    });

    const canManageEverything = isAdministrativeRole(actor.membership.role);

    // The menus a kitchen event can be raised against. A kitchen event is a
    // production job rather than a booking - "cook this menu for this many
    // people" - so the menu is the one thing it genuinely needs, and a typed
    // name would tell the kitchen nothing about what to make.
    const menuOptions = await prisma.eventPackage.findMany({
      where: { organizationId: actor.organizationId, isActive: true },
      select: { id: true, name: true, includedMenuItemIds: true },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({
      events: boardEvents,
      workers,
      menus: menuOptions.map((menu) => ({
        id: menu.id,
        name: menu.name,
        dishCount: menu.includedMenuItemIds.length
      })),
      permissions: {
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
      "canAssignWorkers",
      "canUpdateKitchenStatus"
    ]);
    const input = kitchenMutationSchema.parse(await request.json());
    const isAdmin = isAdministrativeRole(actor.membership.role);
    const canAssignWorkers = isAdmin || Boolean(actor.access?.canAssignWorkers);
    const canUpdateKitchenStatus =
      isAdmin || Boolean(actor.access?.canUpdateKitchenStatus);

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
        // otherwise keep writing statuses and assignments against a booking
        // that is off - and those writes are what the kitchen reads back as
        // work to do.
        bookingStatus: CONFIRMED_STATUS
      },
      select: { id: true, hallId: true }
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

    // Scoping the GET alone would be half the fix: an event id is all it takes
    // to write progress against a hall this member cannot see.
    assertHallAccess(actor, event.hallId);

    if (input.action === "reset-status") {
      await prisma.kitchenItemStatus.deleteMany({
        where: { eventId: event.id, menuItemId: menuItem.id }
      });

      return NextResponse.json({ itemStatus: null });
    }

    const where = {
      eventId_menuItemId: { eventId: event.id, menuItemId: menuItem.id }
    };

    if (input.action === "assign-worker") {
      const current = await prisma.kitchenItemStatus.findUnique({
        where,
        select: { id: true, status: true }
      });

      // Unassigning the last thing this row was recording. Deleting rather than
      // keeping a row that says nothing: an empty row and no row are the same
      // "not started" to every reader, and only one of them is tidy.
      if (!input.assignedWorkerId && current && current.status == null) {
        await prisma.kitchenItemStatus.delete({ where: { id: current.id } });

        return NextResponse.json({ itemStatus: null });
      }

      const itemStatus = await prisma.kitchenItemStatus.upsert({
        where,
        // Status is deliberately absent from both branches. Assigning someone
        // to a dish says who is doing it, not that it has been started - and
        // writing PENDING here used to demote a COMPLETE dish the moment anyone
        // put a name against it.
        update: {
          assignedWorkerId: input.assignedWorkerId,
          updatedById: actor.id
        },
        create: {
          organizationId: actor.organizationId,
          eventId: event.id,
          menuItemId: menuItem.id,
          status: null,
          assignedWorkerId: input.assignedWorkerId,
          updatedById: actor.id
        }
      });

      return NextResponse.json({ itemStatus });
    }

    const itemStatus = await prisma.kitchenItemStatus.upsert({
      where,
      update: { status: input.status, updatedById: actor.id },
      create: {
        organizationId: actor.organizationId,
        eventId: event.id,
        menuItemId: menuItem.id,
        status: input.status,
        assignedWorkerId: null,
        updatedById: actor.id
      }
    });

    return NextResponse.json({ itemStatus });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
