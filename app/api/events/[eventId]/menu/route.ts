import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  conflict,
  confirmedMenu,
  emptyMenu,
  eventIdSchema,
  LINE_SOURCES,
  loadEventForMenu,
  mealSchema,
  menuSelect,
  presentMenu,
  readPresentedMenu,
  serviceStyleSchema
} from "@/features/events/server/event-menu-document";
import {
  assertHallAccess,
  requireAnyPermission,
  requirePermission
} from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { createMenuChangedKitchenNotification } from "@/features/kitchen/server/kitchen-notifications";

/**
 * The menu for one event: what it is serving buffet, what it is serving plated,
 * and which add-ons it is getting.
 *
 * Replaces the `menuItemIds` half of `PATCH /api/events/[eventId]`, which could
 * only store an unordered list of uuids and only ever got written when the user
 * confirmed - so a menu built and left unconfirmed was lost on reload.
 *
 * Two things are still mirrored back onto the event on every write, because
 * readers that have not moved across yet depend on them and every branch shares
 * one database:
 *
 * - `Event.menuItemIds` and `Event.addOnIds`, read by the kitchen dashboard,
 *   the event PDF and the client portal.
 * - `Event.workspaceData.menuConfirmed`, read by the client portal to decide
 *   whether the client may still change their selections.
 */

const menuLineSchema = z
  .object({
    menuItemId: z.string().uuid().optional(),
    addOnId: z.string().uuid().optional(),
    /// Which way this dish is served at this event, and so which of its
    /// `MenuItemService` rules the kitchen quantity math runs.
    serviceStyle: serviceStyleSchema,
    /// Sent back as it was read. Without this every line a package put on the
    /// menu would be relabelled `Manual` by the next unrelated edit, and
    /// removing the package would no longer find them.
    source: z.enum(LINE_SOURCES).optional(),
    notes: z.string().trim().max(2000).nullable().optional()
  })
  .refine(
    (line) => Boolean(line.menuItemId) !== Boolean(line.addOnId),
    "A menu line is either a dish or an add-on, not both and not neither."
  )
  .refine(
    (line) => !line.addOnId || !line.serviceStyle,
    "An add-on is not served buffet or plated."
  );

const replaceMenuSchema = z.object({
  meal: mealSchema,
  serviceStyle: serviceStyleSchema,
  // Absent on the very first save, when there is no header to have a version
  // yet. Present after that, and checked - the array this replaces was
  // read-modify-written by three routes with nothing to detect a collision.
  version: z.number().int().min(0).optional(),
  lines: z.array(menuLineSchema).max(500)
});

const lifecycleSchema = z.object({
  action: z.enum(["confirm", "reopen"]),
  meal: mealSchema,
  version: z.number().int().min(0)
});

/**
 * Merges one key into the event's workspace json without disturbing the
 * timeline that lives beside it. Same read-merge-write the event PATCH does.
 */
function mergeWorkspace(
  current: Prisma.JsonValue | null,
  menuConfirmed: boolean
) {
  const previous =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};

  return { ...previous, menuConfirmed } as Prisma.InputJsonObject;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const actor = await requireAnyPermission(request, [
      "canViewEventManager",
      "canViewCalendar"
    ]);
    const { eventId } = await params;
    const id = eventIdSchema.parse(eventId);
    const meal = mealSchema.parse(
      new URL(request.url).searchParams.get("meal") ?? undefined
    );

    const event = await loadEventForMenu(actor, id);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    assertHallAccess(actor, event.hallId);

    const menu = await prisma.eventMenu.findUnique({
      where: { eventId_meal: { eventId: id, meal } },
      select: menuSelect
    });

    return NextResponse.json({
      // No row until the first save. Version 0 is what the first PUT sends.
      menu: menu
        ? await presentMenu(menu, {
            organizationId: actor.organizationId,
            packageId: event.packageId
          })
        : emptyMenu(meal, event.packageId)
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

/**
 * Replaces the whole line set for one meal. The client sends the menu it wants
 * to end up with, so this is safe to call on every edit - which is what makes
 * an unconfirmed menu survive a reload.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    // The same permission the menu save has always required, back when it went
    // through PATCH /api/events/[eventId].
    const actor = await requirePermission(request, "canCreateBooking");
    const { eventId } = await params;
    const id = eventIdSchema.parse(eventId);
    const input = replaceMenuSchema.parse(await request.json());

    const event = await loadEventForMenu(actor, id);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    assertHallAccess(actor, event.hallId);

    // Last one wins rather than rejecting: the unique on (menu, dish) makes a
    // repeated target unstorable, and the client has no way to have meant two.
    const linesByTarget = new Map(
      input.lines.map((line) => [
        line.menuItemId ? `dish:${line.menuItemId}` : `addon:${line.addOnId}`,
        line
      ])
    );
    const lines = [...linesByTarget.values()];
    const menuItemIds = lines
      .map((line) => line.menuItemId)
      .filter((value): value is string => Boolean(value));
    const addOnIds = lines
      .map((line) => line.addOnId)
      .filter((value): value is string => Boolean(value));

    const [ownedMenuItems, ownedAddOns] = await Promise.all([
      menuItemIds.length
        ? prisma.menuItem.count({
            where: {
              id: { in: menuItemIds },
              organizationId: actor.organizationId
            }
          })
        : 0,
      addOnIds.length
        ? prisma.addOn.count({
            where: {
              id: { in: addOnIds },
              organizationId: actor.organizationId
            }
          })
        : 0
    ]);

    if (ownedMenuItems !== menuItemIds.length) {
      return NextResponse.json(
        { error: "One or more selected menu items were not found." },
        { status: 400 }
      );
    }

    if (ownedAddOns !== addOnIds.length) {
      return NextResponse.json(
        { error: "One or more selected add-ons were not found." },
        { status: 400 }
      );
    }

    const saved = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.eventMenu.findUnique({
        where: { eventId_meal: { eventId: id, meal: input.meal } },
        select: { id: true, status: true, version: true }
      });

      let savedMenu: { id: string; version: number };

      if (!existing) {
        // First save. `version` may be absent, but if it was sent it has to be
        // the 0 of a menu that does not exist yet.
        if (input.version !== undefined && input.version !== 0) return null;

        savedMenu = await transaction.eventMenu.create({
          data: {
            organizationId: actor.organizationId,
            eventId: id,
            meal: input.meal,
            serviceStyle: input.serviceStyle ?? null,
            status: "Draft",
            version: 1
          },
          select: { id: true, version: true }
        });
      } else {
        if (input.version !== undefined && input.version !== existing.version) {
          return null;
        }

        // A confirmed menu is what the kitchen has already been handed. Reopen
        // it first. The client portal refuses writes on the same grounds.
        if (existing.status === "Confirmed") return "confirmed" as const;

        const bumped = await transaction.eventMenu.updateMany({
          where: { id: existing.id, version: existing.version },
          data: {
            serviceStyle:
              input.serviceStyle === undefined ? undefined : input.serviceStyle,
            version: { increment: 1 }
          }
        });

        // Someone else committed between the read above and this write.
        if (bumped.count === 0) return null;

        savedMenu = { id: existing.id, version: existing.version + 1 };
      }

      await transaction.eventMenuLine.deleteMany({
        where: { eventMenuId: savedMenu.id }
      });

      if (lines.length > 0) {
        await transaction.eventMenuLine.createMany({
          data: lines.map((line, index) => ({
            organizationId: actor.organizationId,
            eventMenuId: savedMenu.id,
            menuItemId: line.menuItemId ?? null,
            addOnId: line.addOnId ?? null,
            serviceStyle: line.menuItemId ? (line.serviceStyle ?? null) : null,
            notes: line.notes ?? null,
            sortOrder: index,
            // Kept as it arrived, so a line a package put here still reads as
            // one after an unrelated edit rewrites the set around it.
            source: line.source ?? "Manual",
            addedById: actor.id
          }))
        });
      }

      // The mirrors. Dropped once the kitchen dashboard, the PDF and the client
      // portal read lines instead.
      await transaction.event.update({
        where: { id, organizationId: actor.organizationId },
        data: { menuItemIds, addOnIds, updatedById: actor.id }
      });

      return savedMenu;
    });

    if (saved === "confirmed") return confirmedMenu();

    if (!saved) return conflict();

    return NextResponse.json({
      menu: await readPresentedMenu(saved.id, {
        organizationId: actor.organizationId,
        packageId: event.packageId
      })
    });
  } catch (error) {
    // Two first-saves racing each other: both saw no header, both created one,
    // the unique caught the loser. That is a conflict, not a server fault.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflict();
    }

    return createApiErrorResponse(error);
  }
}

/**
 * Confirm locks the menu and freezes the name on every line; reopen puts it
 * back to a draft that follows the library again.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const actor = await requirePermission(request, "canCreateBooking");
    const { eventId } = await params;
    const id = eventIdSchema.parse(eventId);
    const input = lifecycleSchema.parse(await request.json());

    const event = await loadEventForMenu(actor, id);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    assertHallAccess(actor, event.hallId);

    const confirming = input.action === "confirm";

    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.eventMenu.findUnique({
        where: { eventId_meal: { eventId: id, meal: input.meal } },
        select: { id: true, version: true, _count: { select: { lines: true } } }
      });

      // A menu nobody has saved yet is empty, not contested. Answering "changed
      // somewhere else" would send the user to reload a page that is already
      // showing the truth, and hide the one thing they need to do.
      if (!existing) return confirming ? ("empty" as const) : null;

      if (existing.version !== input.version) return null;

      if (confirming && existing._count.lines === 0) return "empty" as const;

      const bumped = await transaction.eventMenu.updateMany({
        where: { id: existing.id, version: existing.version },
        data: {
          status: confirming ? "Confirmed" : "Draft",
          confirmedAt: confirming ? new Date() : null,
          confirmedById: confirming ? actor.id : null,
          version: { increment: 1 }
        }
      });

      if (bumped.count === 0) return null;

      if (confirming) {
        // Freeze the name. Raw SQL because it copies per-row from whichever of
        // the two catalogs the line points at, which `updateMany` cannot say.
        await transaction.$executeRaw`
          UPDATE "event_menu_lines" AS line
          SET "item_name" = coalesce(
                (SELECT item."name" FROM "menu_items" AS item
                  WHERE item."id" = line."menu_item_id"),
                (SELECT "add_on"."name" FROM "add_ons" AS "add_on"
                  WHERE "add_on"."id" = line."add_on_id")
              ),
              "updated_at" = NOW()
          WHERE line."event_menu_id" = ${existing.id}::uuid
        `;
      } else {
        // Back to answering from the library.
        await transaction.eventMenuLine.updateMany({
          where: { eventMenuId: existing.id },
          data: { itemName: null }
        });
      }

      // Kept in step for the client portal, which still reads this json to
      // decide whether the client may change their selections.
      await transaction.event.update({
        where: { id, organizationId: actor.organizationId },
        data: {
          workspaceData: mergeWorkspace(event.workspaceData, confirming),
          updatedById: actor.id
        }
      });

      return { id: existing.id };
    });

    if (result === "empty") {
      return NextResponse.json(
        { error: "Add at least one menu item before confirming." },
        { status: 400 }
      );
    }

    if (!result) return conflict();

    const presentedMenu = await readPresentedMenu(result.id, {
      organizationId: actor.organizationId,
      packageId: event.packageId
    });
    const menuItems = (presentedMenu?.lines ?? []).map((line) => ({
      item: line.name,
      type: line.kind,
      serviceStyle: line.serviceStyle ?? "None"
    }));

    await createMenuChangedKitchenNotification({
      organizationId: actor.organizationId,
      eventId: event.id,
      eventType: event.eventType ?? event.clientName,
      eventDate: event.eventDate,
      hallOrRoom: event.hall.name,
      changedById: actor.id,
      oldValue: confirming
        ? { status: "Draft", meal: presentedMenu?.meal ?? input.meal }
        : {
            status: "Confirmed",
            meal: presentedMenu?.meal ?? input.meal,
            items: menuItems
          },
      newValue: confirming
        ? {
            status: "Confirmed",
            meal: presentedMenu?.meal ?? input.meal,
            items: menuItems
          }
        : { status: "Draft", meal: presentedMenu?.meal ?? input.meal }
    });

    return NextResponse.json({
      menu: presentedMenu
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
