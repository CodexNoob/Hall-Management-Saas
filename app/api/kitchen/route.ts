import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { replaceKitchenDish } from "@/features/kitchen/server/kitchen-dish-replacement";
import {
  boardStatusSelect,
  buildKitchenSheet,
  DEFAULT_MEAL,
  eventSelect,
  kitchenMenuSelect,
  type StatusRow
} from "@/features/kitchen/server/kitchen-sheet";
import type { EventKitchenLine } from "@/features/events/components/event-manager-shared";
import { resolveMenuCategoryId } from "@/features/menu/server/menu-categories";
import {
  calculateStyleQuantity,
  totalGuests,
  type EventHeadCounts
} from "@/features/menu/lib/menu-quantity";
import {
  readServiceRules,
  SERVICE_STYLES
} from "@/features/menu/lib/service-style";
import { isAdministrativeRole } from "@/lib/auth/roles";
import {
  assertHallAccess,
  requireAnyPermission,
  requirePermission
} from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { listKitchenNotifications } from "@/features/kitchen/server/kitchen-notifications";
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
 * Progress, who is on a dish, and swapping one dish for another.
 *
 * `replace-menu-item` and `remove-menu-item` used to live here and were taken
 * out: they wrote only `Event.menuItemIds` - the legacy mirror - so a dish
 * swapped on the board never reached `EventMenuLine`, which is what the event's
 * Menu tab, this board's own quantity arithmetic and the client portal all read.
 * The two views of one menu silently diverged from the moment anyone used them.
 *
 * Replacing is back because the kitchen is where that problem is discovered - a
 * delivery is short, a dish comes off the fire - but it now writes the line
 * itself, through `replaceKitchenDish`. Removing is not back: a dish nobody is
 * cooking is a promise to the client that somebody has to unmake, and that
 * conversation belongs on the Menu tab.
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
  }),
  z.object({
    action: z.literal("replace-menu-item"),
    eventId: z.string().uuid(),
    /// The dish coming off, which is the line being rewritten.
    menuItemId: z.string().uuid(),
    /// The dish going on in its place. Dishes only: a line is either a dish or
    /// an add-on, and an add-on carries neither a style nor a status.
    replacementMenuItemId: z.string().uuid()
  })
]);

const standaloneKitchenMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("standalone-status"),
    kitchenEventId: z.string().uuid(),
    menuItemId: z.string().uuid(),
    status: z.enum(["PENDING", "COMPLETE"])
  }),
  z.object({
    action: z.literal("standalone-reset-status"),
    kitchenEventId: z.string().uuid(),
    menuItemId: z.string().uuid()
  }),
  z.object({
    action: z.literal("standalone-assign-worker"),
    kitchenEventId: z.string().uuid(),
    menuItemId: z.string().uuid(),
    assignedWorkerId: z.string().uuid().nullable()
  })
]);

const kitchenActionSchema = z.union([
  kitchenMutationSchema,
  standaloneKitchenMutationSchema
]);

const kitchenStandaloneEventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
  menuId: z.string().uuid().optional(),
  quickMenu: z
    .object({
      name: z.string().trim().min(1).max(200),
      dishNames: z
        .array(z.string().trim().min(1).max(200))
        .default([]),
      menuItemIds: z.array(z.string().uuid()).default([]),
      saveToLibrary: z.boolean().default(false)
    })
    .refine(
      (quickMenu) =>
        quickMenu.dishNames.length > 0 || quickMenu.menuItemIds.length > 0,
      "Add at least one dish."
    )
    .optional(),
  portions: z.coerce
    .number()
    .int("Portions must be a whole number.")
    .min(1, "Portions must be at least 1."),
  kitchenNote: z.string().trim().max(2000).optional()
}).refine((input) => Boolean(input.menuId) !== Boolean(input.quickMenu), {
  message: "Choose an existing menu or create a new one.",
  path: ["menuId"]
});

type StandaloneStatusRow = {
  menuItemId: string;
  status: string | null;
  assignedWorkerId: string | null;
  assignedWorker: { name: string } | null;
};

type StandaloneMenuItemRow = Prisma.MenuItemGetPayload<{
  select: {
    id: true;
    name: true;
    isActive: true;
    services: {
      select: {
        serviceStyle: true;
        quantity: true;
        unit: true;
        per: true;
        perBasis: true;
        rounding: true;
        minimumUnits: true;
      };
      orderBy: { serviceStyle: "asc" };
    };
  };
}>;

function buildStandaloneKitchenSheet({
  menuItemIds,
  menuItemsById,
  portions,
  statuses,
  currentWorkerId
}: {
  menuItemIds: string[];
  menuItemsById: Map<string, StandaloneMenuItemRow>;
  portions: number;
  statuses: StandaloneStatusRow[];
  currentWorkerId?: string | null;
}) {
  const counts: EventHeadCounts = {
    couples: 0,
    men: portions,
    ladies: 0,
    boys: 0,
    girls: 0,
    kids: 0,
    waiters: 0,
    tables: null
  };
  const statusByMenuItemId = new Map(
    statuses.map((itemStatus) => [itemStatus.menuItemId, itemStatus])
  );

  const lines: EventKitchenLine[] = menuItemIds.flatMap((menuItemId, index) => {
    const menuItem = menuItemsById.get(menuItemId);
    if (!menuItem) return [];

    const services = menuItem.services;
    const rules = readServiceRules(
      services.map((service) => ({
        ...service,
        quantity: Number(service.quantity)
      }))
    );
    const availableStyles = [
      ...new Set(services.map((service) => service.serviceStyle))
    ];
    const style = SERVICE_STYLES.find((candidate) =>
      availableStyles.includes(candidate)
    ) ?? null;
    const result = style ? calculateStyleQuantity(rules, style, counts) : null;
    const itemStatus = statusByMenuItemId.get(menuItem.id);

    return [
      {
        id: `${menuItem.id}:${index}`,
        menuItemId: menuItem.id,
        addOnId: null,
        kind: "Dish" as const,
        name: menuItem.name,
        pictureUrl: null,
        serviceStyle: style,
        availableStyles,
        notes: null,
        sortOrder: index,
        isRetired: !menuItem.isActive,
        quantities: (result?.quantities ?? []).map((quantity) => ({
          unit: quantity.unit,
          units: quantity.units,
          raw: quantity.raw
        })),
        unresolvedBases: result?.unresolved ?? [],
        countState:
          result && result.quantities.length > 0
            ? ("Counted" as const)
            : result && result.unresolved.length > 0
              ? ("Unresolved" as const)
              : !style && availableStyles.length > 0
                ? ("NeedsStyle" as const)
                : ("NoRule" as const),
        status:
          itemStatus?.status == null
            ? null
            : itemStatus.status === "COMPLETE"
              ? ("COMPLETE" as const)
              : ("PENDING" as const),
        assignedWorkerId: itemStatus?.assignedWorkerId ?? null,
        assignedWorkerName: itemStatus?.assignedWorker?.name ?? null
      }
    ];
  });

  return {
    meal: DEFAULT_MEAL,
    menuStatus: "Draft" as const,
    confirmedAt: null,
    version: 0,
    counts: { ...counts, totalGuests: totalGuests(counts) },
    lines,
    summary: {
      dishes: lines.length,
      addOns: 0,
      complete: lines.filter((line) => line.status === "COMPLETE").length,
      pending: lines.filter((line) => line.status === "PENDING").length,
      notStarted: lines.filter((line) => line.status === null).length,
      assigned: lines.filter((line) => Boolean(line.assignedWorkerId)).length,
      assignedToCurrentWorker: currentWorkerId
        ? lines.filter((line) => line.assignedWorkerId === currentWorkerId)
            .length
        : 0,
      needsAttention: lines.filter((line) =>
        ["NeedsStyle", "NoRule", "Unresolved"].includes(line.countState)
      ).length,
      unresolvedBases: [
        ...new Set(lines.flatMap((line) => line.unresolvedBases))
      ]
    }
  };
}

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

    const [events, standaloneEvents, workers, notifications] = await Promise.all([
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
      prisma.kitchenStandaloneEvent.findMany({
        where: {
          organizationId: actor.organizationId,
          eventDate: { gte: start, lt: end }
        },
        select: {
          id: true,
          menuId: true,
          menuName: true,
          eventDate: true,
          portions: true,
          kitchenNote: true,
          menu: { select: { includedMenuItemIds: true } }
        },
        orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }]
      }),
      syncKitchenStaffWorkers(actor.organizationId),
      listKitchenNotifications(actor.organizationId)
    ]);
    const currentWorkerId =
      workers.find((worker) => worker.userId === actor.id)?.id ?? null;

    const eventIds = events.map((event) => event.id);
    const standaloneEventIds = standaloneEvents.map((event) => event.id);
    const standaloneMenuItemIds = [
      ...new Set(
        standaloneEvents.flatMap((event) => event.menu.includedMenuItemIds)
      )
    ];
    // Two queries for the whole window rather than two per event. The board
    // spans four weeks, so the per-event route's shape - which is the right one
    // for a single event - would be up to a hundred round-trips here.
    const [
      menus,
      otherMeals,
      statuses,
      standaloneMenuItems,
      standaloneStatuses
    ] =
      await Promise.all([
      prisma.eventMenu.findMany({
        where: {
          eventId: { in: eventIds },
          organizationId: actor.organizationId,
          meal: DEFAULT_MEAL
        },
        select: { ...kitchenMenuSelect, eventId: true }
      }),
      // The meals this board cannot draw. Ids and names only - the lines behind
      // them are not rendered anywhere yet, and four weeks of a second menu's
      // dishes is a large response for a badge saying they exist.
      prisma.eventMenu.findMany({
        where: {
          eventId: { in: eventIds },
          organizationId: actor.organizationId,
          meal: { not: DEFAULT_MEAL }
        },
        select: { eventId: true, meal: true }
      }),
      prisma.kitchenItemStatus.findMany({
        where: {
          eventId: { in: eventIds },
          organizationId: actor.organizationId
        },
        select: boardStatusSelect
      }),
      prisma.menuItem.findMany({
        where: {
          organizationId: actor.organizationId,
          id: { in: standaloneMenuItemIds }
        },
        select: {
          id: true,
          name: true,
          isActive: true,
          services: {
            select: {
              serviceStyle: true,
              quantity: true,
              unit: true,
              per: true,
              perBasis: true,
              rounding: true,
              minimumUnits: true
            },
            orderBy: { serviceStyle: "asc" }
          }
        }
      }),
      prisma.kitchenStandaloneItemStatus.findMany({
        where: {
          organizationId: actor.organizationId,
          kitchenStandaloneEventId: { in: standaloneEventIds }
        },
        select: {
          kitchenStandaloneEventId: true,
          menuItemId: true,
          status: true,
          assignedWorkerId: true,
          assignedWorker: { select: { name: true } }
        }
      })
    ]);

    const menuByEventId = new Map(menus.map((menu) => [menu.eventId, menu]));
    const statusesByEventId = new Map<string, StatusRow[]>();
    const otherMealsByEventId = new Map<string, string[]>();

    for (const itemStatus of statuses) {
      const current = statusesByEventId.get(itemStatus.eventId) ?? [];
      current.push(itemStatus);
      statusesByEventId.set(itemStatus.eventId, current);
    }
    const standaloneMenuItemsById = new Map(
      standaloneMenuItems.map((menuItem) => [menuItem.id, menuItem])
    );
    const standaloneStatusesByEventId = new Map<string, StandaloneStatusRow[]>();

    for (const itemStatus of standaloneStatuses) {
      const current =
        standaloneStatusesByEventId.get(itemStatus.kitchenStandaloneEventId) ??
        [];
      current.push(itemStatus);
      standaloneStatusesByEventId.set(
        itemStatus.kitchenStandaloneEventId,
        current
      );
    }

    for (const menu of otherMeals) {
      const current = otherMealsByEventId.get(menu.eventId) ?? [];
      current.push(menu.meal);
      otherMealsByEventId.set(menu.eventId, current);
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
        otherMeals: otherMealsByEventId.get(event.id) ?? [],
        statuses: statusesByEventId.get(event.id) ?? [],
        currentWorkerId
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
        otherMeals: sheet.otherMeals,
        counts: sheet.counts,
        summary: sheet.summary
      };
    });

    const canManageEverything = isAdministrativeRole(actor.membership.role);

    // The menus a kitchen event can be raised against. A kitchen event is a
    // production job rather than a booking - "cook this menu for this many
    // people" - so the menu is the one thing it genuinely needs, and a typed
    // name would tell the kitchen nothing about what to make.
    const [menuOptions, libraryMenuItems] = await Promise.all([
      prisma.eventPackage.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        select: { id: true, name: true, includedMenuItemIds: true },
        orderBy: { name: "asc" }
      }),
      prisma.menuItem.findMany({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
          kind: { in: ["Food", "Drink"] }
        },
        select: {
          id: true,
          name: true,
          category: true,
          kind: true,
          categoryRef: { select: { name: true } }
        },
        orderBy: [{ category: "asc" }, { name: "asc" }]
      })
    ]);

    return NextResponse.json({
      events: boardEvents,
      kitchenEvents: standaloneEvents.map((event) => {
        const sheet = buildStandaloneKitchenSheet({
          menuItemIds: event.menu.includedMenuItemIds,
          menuItemsById: standaloneMenuItemsById,
          portions: event.portions,
          statuses: standaloneStatusesByEventId.get(event.id) ?? [],
          currentWorkerId
        });

        return {
          id: event.id,
          source: "standalone",
          dateKey: event.eventDate.toISOString().slice(0, 10),
          category: "Kitchen-only",
          title: event.menuName,
          status: "Kitchen",
          statusType: "kitchen",
          startsAt: null,
          totalGuests: event.portions,
          menuStatus: sheet.menuStatus,
          otherMeals: [],
          summary: sheet.summary,
          kitchenNote: event.kitchenNote,
          sheet
        };
      }),
      workers: workers.map(({ id, name, isStaff }) => ({ id, name, isStaff })),
      currentWorkerId,
      notifications,
      menus: menuOptions.map((menu) => ({
        id: menu.id,
        name: menu.name,
        dishCount: menu.includedMenuItemIds.length
      })),
      menuItems: libraryMenuItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.categoryRef?.name ?? item.category,
        kind: item.kind
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

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canAddKitchenEvents");
    const input = kitchenStandaloneEventSchema.parse(await request.json());

    const eventDate = new Date(`${input.date}T00:00:00.000Z`);

    const kitchenEvent = await prisma.$transaction(async (transaction) => {
      let menu: { id: string; name: string };

      if (input.quickMenu) {
        const uniqueDishNames = [...new Set(input.quickMenu.dishNames)];
        const uniqueMenuItemIds = [...new Set(input.quickMenu.menuItemIds)];
        const categoryId = await resolveMenuCategoryId(
          actor.organizationId,
          "Kitchen"
        );

        const existingItems = uniqueMenuItemIds.length
          ? await transaction.menuItem.findMany({
              where: {
                organizationId: actor.organizationId,
                id: { in: uniqueMenuItemIds },
                isActive: true
              },
              select: { id: true }
            })
          : [];

        if (existingItems.length !== uniqueMenuItemIds.length) {
          throw new Error("One of the selected menu items is unavailable.");
        }

        const createdItems = [];
        for (const name of uniqueDishNames) {
          createdItems.push(
            await transaction.menuItem.create({
              data: {
                organizationId: actor.organizationId,
                name,
                category: "Kitchen",
                categoryId,
                usageType: "Both",
                kind: "Food",
                services: {
                  create: {
                    organizationId: actor.organizationId,
                    serviceStyle: "Buffet",
                    quantity: 1,
                    unit: "portion",
                    per: 1,
                    perBasis: "TotalGuests",
                    rounding: "Exact",
                    minimumUnits: null
                  }
                }
              },
              select: { id: true }
            })
          );
        }

        menu = await transaction.eventPackage.create({
          data: {
            organizationId: actor.organizationId,
            name: input.quickMenu.name,
            includedMenuItemIds: [
              ...existingItems.map((item) => item.id),
              ...createdItems.map((item) => item.id)
            ],
            isActive: input.quickMenu.saveToLibrary,
            notes: input.quickMenu.saveToLibrary
              ? "Created from the Kitchen Dashboard."
              : "One-time kitchen-only quick menu."
          },
          select: { id: true, name: true }
        });
      } else {
        const existingMenu = await transaction.eventPackage.findFirst({
          where: {
            id: input.menuId,
            organizationId: actor.organizationId,
            isActive: true
          },
          select: { id: true, name: true }
        });

        if (!existingMenu) {
          throw new Error("Choose an active menu for this kitchen event.");
        }

        menu = existingMenu;
      }

      return transaction.kitchenStandaloneEvent.create({
        data: {
          organizationId: actor.organizationId,
          menuId: menu.id,
          menuName: menu.name,
          eventDate,
          portions: input.portions,
          kitchenNote: input.kitchenNote || null,
          createdById: actor.id
        },
        select: {
          id: true,
          menuName: true,
          eventDate: true,
          portions: true,
          kitchenNote: true
        }
      });
    });

    return NextResponse.json({
      kitchenEvent: {
        id: kitchenEvent.id,
        dateKey: kitchenEvent.eventDate.toISOString().slice(0, 10),
        category: "Kitchen",
        title: kitchenEvent.menuName,
        statusType: "kitchen",
        startsAt: null,
        totalGuests: kitchenEvent.portions,
        menuStatus: "Draft",
        otherMeals: [],
        summary: null,
        kitchenNote: kitchenEvent.kitchenNote
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
    const input = kitchenActionSchema.parse(await request.json());
    const isAdmin = isAdministrativeRole(actor.membership.role);
    const canAssignWorkers = isAdmin || Boolean(actor.access?.canAssignWorkers);
    const canUpdateKitchenStatus =
      isAdmin || Boolean(actor.access?.canUpdateKitchenStatus);

    if (
      input.action === "standalone-assign-worker" ||
      input.action === "standalone-status" ||
      input.action === "standalone-reset-status"
    ) {
      if (input.action === "standalone-assign-worker" && !canAssignWorkers) {
        return NextResponse.json(
          { error: "You do not have permission to assign kitchen workers." },
          { status: 403 }
        );
      }

      if (
        (input.action === "standalone-status" ||
          input.action === "standalone-reset-status") &&
        !canUpdateKitchenStatus
      ) {
        return NextResponse.json(
          { error: "You do not have permission to update kitchen status." },
          { status: 403 }
        );
      }

      const [kitchenEvent, menuItem] = await Promise.all([
        prisma.kitchenStandaloneEvent.findFirst({
          where: {
            id: input.kitchenEventId,
            organizationId: actor.organizationId
          },
          select: {
            id: true,
            menu: { select: { includedMenuItemIds: true } }
          }
        }),
        prisma.menuItem.findFirst({
          where: { id: input.menuItemId, organizationId: actor.organizationId },
          select: { id: true, name: true }
        })
      ]);

      if (
        !kitchenEvent ||
        !menuItem ||
        !kitchenEvent.menu.includedMenuItemIds.includes(menuItem.id)
      ) {
        return NextResponse.json(
          { error: "Kitchen event or menu item not found." },
          { status: 404 }
        );
      }

      const where = {
        kitchenStandaloneEventId_menuItemId: {
          kitchenStandaloneEventId: kitchenEvent.id,
          menuItemId: menuItem.id
        }
      };

      if (input.action === "standalone-reset-status") {
        await prisma.kitchenStandaloneItemStatus.deleteMany({
          where: {
            kitchenStandaloneEventId: kitchenEvent.id,
            menuItemId: menuItem.id
          }
        });

        return NextResponse.json({ itemStatus: null });
      }

      if (input.action === "standalone-assign-worker") {
        if (input.assignedWorkerId) {
          const worker = await prisma.kitchenWorker.findFirst({
            where: {
              id: input.assignedWorkerId,
              organizationId: actor.organizationId,
              isActive: true
            },
            select: { id: true }
          });

          if (!worker) {
            return NextResponse.json(
              { error: "Kitchen worker not found." },
              { status: 404 }
            );
          }
        }

        const current = await prisma.kitchenStandaloneItemStatus.findUnique({
          where,
          select: { id: true, status: true }
        });

        if (!input.assignedWorkerId && current && current.status == null) {
          await prisma.kitchenStandaloneItemStatus.delete({
            where: { id: current.id }
          });

          return NextResponse.json({ itemStatus: null });
        }

        const itemStatus = await prisma.kitchenStandaloneItemStatus.upsert({
          where,
          update: {
            assignedWorkerId: input.assignedWorkerId,
            updatedById: actor.id
          },
          create: {
            organizationId: actor.organizationId,
            kitchenStandaloneEventId: kitchenEvent.id,
            menuItemId: menuItem.id,
            status: null,
            assignedWorkerId: input.assignedWorkerId,
            updatedById: actor.id
          }
        });

        return NextResponse.json({ itemStatus });
      }

      const itemStatus = await prisma.kitchenStandaloneItemStatus.upsert({
        where,
        update: { status: input.status, updatedById: actor.id },
        create: {
          organizationId: actor.organizationId,
          kitchenStandaloneEventId: kitchenEvent.id,
          menuItemId: menuItem.id,
          status: input.status,
          assignedWorkerId: null,
          updatedById: actor.id
        }
      });

      return NextResponse.json({ itemStatus });
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

    // The same permission that lets someone say a dish is done lets them say it
    // is a different dish. Whoever runs the board runs the production; asking
    // for `canCreateBooking` here - what the Menu tab requires - would hand the
    // swap to everyone except the kitchen it exists for.
    if (input.action === "replace-menu-item" && !canUpdateKitchenStatus) {
      return NextResponse.json(
        {
          error: "You do not have permission to change what the kitchen cooks."
        },
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

    if (input.action === "replace-menu-item") {
      const result = await replaceKitchenDish({
        actorId: actor.id,
        organizationId: actor.organizationId,
        eventId: event.id,
        menuItemId: menuItem.id,
        replacementMenuItemId: input.replacementMenuItemId
      });

      if (result.outcome === "replaced") {
        return NextResponse.json({
          replaced: {
            from: menuItem.name,
            to: result.name,
            serviceStyle: result.serviceStyle
          }
        });
      }

      // Said as the person in front of the board needs to hear it: each of
      // these has a different next move, and "could not save" has none.
      if (result.outcome === "already-on-menu") {
        return NextResponse.json(
          { error: `${result.name} is already on this menu.` },
          { status: 409 }
        );
      }

      if (result.outcome === "conflict") {
        return NextResponse.json(
          {
            error:
              "This menu changed somewhere else while you were looking at it. Reload the board and try again."
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error:
            result.outcome === "line-not-found"
              ? `${menuItem.name} is not on this event's menu any more. Reload the board.`
              : "That dish is no longer in the menu library."
        },
        { status: 404 }
      );
    }

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
