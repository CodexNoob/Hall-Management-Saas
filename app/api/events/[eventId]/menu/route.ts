import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertHallAccess,
  requireAnyPermission,
  requirePermission
} from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

/**
 * The menu for one event, as a document rather than an id array.
 *
 * Replaces the `menuItemIds` half of `PATCH /api/events/[eventId]`, which could
 * only store an unordered list of uuids and only ever got written when the user
 * confirmed - so a menu built and left unconfirmed was lost on reload.
 *
 * Two things are still mirrored back onto the event on every write, because
 * readers that have not moved across yet depend on them and every branch shares
 * one database:
 *
 * - `Event.menuItemIds`, read by the kitchen dashboard and the event PDF.
 * - `Event.workspaceData.menuConfirmed`, read by the client portal to decide
 *   whether the client may still change their selections.
 */

const MEALS = ["Main", "FridayNight", "ShabbosDay", "SeudahShlishis"] as const;
const SERVICE_STYLES = ["Buffet", "Plated"] as const;

const mealSchema = z.enum(MEALS).default("Main");
const serviceStyleSchema = z.enum(SERVICE_STYLES).nullable().optional();

const menuLineSchema = z.object({
  menuItemId: z.string().uuid(),
  // Only meaningful for a dish carrying both a Buffet and a Plated rule. Null
  // means "inherit the header", which is what a single-rule dish wants.
  serviceStyle: serviceStyleSchema,
  notes: z.string().trim().max(2000).nullable().optional()
});

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

const eventIdSchema = z.string().uuid();

const CONFLICT_MESSAGE =
  "This menu was changed somewhere else. Reload before saving again.";

function conflict() {
  return NextResponse.json({ error: CONFLICT_MESSAGE }, { status: 409 });
}

/**
 * Ordered the way the tabs read: category first, then the dish's position
 * inside it.
 */
const lineOrder = [
  { category: { sortOrder: "asc" } },
  { category: { name: "asc" } },
  { sortOrder: "asc" },
  { createdAt: "asc" }
] satisfies Prisma.EventMenuLineOrderByWithRelationInput[];

const lineSelect = {
  id: true,
  menuItemId: true,
  itemName: true,
  categoryId: true,
  categoryName: true,
  serviceStyle: true,
  notes: true,
  sortOrder: true,
  source: true,
  menuItem: {
    select: { name: true, kind: true, isActive: true, categoryId: true }
  },
  category: { select: { name: true, sortOrder: true } }
} satisfies Prisma.EventMenuLineSelect;

type MenuLineRow = Prisma.EventMenuLineGetPayload<{ select: typeof lineSelect }>;

/**
 * A confirmed line answers from its own snapshot; a draft answers from the
 * library. That is the whole rule: renaming a dish should flow into a menu
 * nobody has signed off yet, and must not change one the kitchen already read.
 */
function presentLine(line: MenuLineRow) {
  return {
    id: line.id,
    menuItemId: line.menuItemId,
    name: line.itemName ?? line.menuItem.name,
    categoryId: line.categoryId ?? line.menuItem.categoryId,
    categoryName: line.categoryName ?? line.category?.name ?? null,
    serviceStyle: line.serviceStyle,
    notes: line.notes,
    sortOrder: line.sortOrder,
    source: line.source,
    kind: line.menuItem.kind,
    isRetired: !line.menuItem.isActive
  };
}

async function loadEvent(
  actor: { organizationId: string },
  eventId: string
) {
  return prisma.event.findFirst({
    where: { id: eventId, organizationId: actor.organizationId, deleted: false },
    select: { id: true, hallId: true, workspaceData: true }
  });
}

/**
 * Merges one key into the event's workspace json without disturbing the
 * timeline that lives beside it. Same read-merge-write the event PATCH does.
 */
function mergeWorkspace(current: Prisma.JsonValue | null, menuConfirmed: boolean) {
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

    const event = await loadEvent(actor, id);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    assertHallAccess(actor, event.hallId);

    const [menu, categories] = await Promise.all([
      prisma.eventMenu.findUnique({
        where: { eventId_meal: { eventId: id, meal } },
        select: {
          id: true,
          meal: true,
          status: true,
          serviceStyle: true,
          confirmedAt: true,
          version: true,
          confirmedBy: { select: { id: true, name: true } },
          lines: { select: lineSelect, orderBy: lineOrder }
        }
      }),
      // The course tabs. Org-defined, ordered, and the reason
      // `normalizeMenuCourse` could be deleted.
      prisma.menuCategory.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        select: { id: true, name: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      })
    ]);

    return NextResponse.json({
      // No row until the first save. Version 0 is what the first PUT sends.
      menu: menu
        ? { ...menu, lines: menu.lines.map(presentLine) }
        : {
            id: null,
            meal,
            status: "Draft",
            serviceStyle: null,
            confirmedAt: null,
            version: 0,
            confirmedBy: null,
            lines: []
          },
      categories
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

    const event = await loadEvent(actor, id);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    assertHallAccess(actor, event.hallId);

    // Last one wins rather than rejecting: the unique on (menu, dish) makes a
    // repeated id unstorable, and the client has no way to have meant two.
    const linesByMenuItemId = new Map(
      input.lines.map((line) => [line.menuItemId, line])
    );
    const lines = [...linesByMenuItemId.values()];

    if (lines.length > 0) {
      const owned = await prisma.menuItem.count({
        where: {
          id: { in: lines.map((line) => line.menuItemId) },
          organizationId: actor.organizationId
        }
      });

      if (owned !== lines.length) {
        return NextResponse.json(
          { error: "One or more selected menu items were not found." },
          { status: 400 }
        );
      }
    }

    // Snapshotted onto the line so re-filing a dish in the library later cannot
    // reshuffle a menu somebody already built.
    const categoryByMenuItemId = new Map(
      (
        await prisma.menuItem.findMany({
          where: { id: { in: lines.map((line) => line.menuItemId) } },
          select: { id: true, categoryId: true }
        })
      ).map((item) => [item.id, item.categoryId])
    );

    const saved = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.eventMenu.findUnique({
        where: { eventId_meal: { eventId: id, meal: input.meal } },
        select: { id: true, status: true, version: true }
      });

      if (!existing) {
        // First save. `version` may be absent, but if it was sent it has to be
        // the 0 of a menu that does not exist yet.
        if (input.version !== undefined && input.version !== 0) return null;

        const created = await transaction.eventMenu.create({
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

        return created;
      }

      if (input.version !== undefined && input.version !== existing.version) {
        return null;
      }

      // A confirmed menu is what the kitchen has already been handed. Reopen it
      // first. The client portal refuses writes on the same grounds.
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

      return { id: existing.id, version: existing.version + 1 };
    });

    if (saved === "confirmed") {
      return NextResponse.json(
        { error: "This menu is confirmed. Reopen it before editing." },
        { status: 409 }
      );
    }

    if (!saved) return conflict();

    await prisma.$transaction([
      prisma.eventMenuLine.deleteMany({ where: { eventMenuId: saved.id } }),
      prisma.eventMenuLine.createMany({
        data: lines.map((line, index) => ({
          organizationId: actor.organizationId,
          eventMenuId: saved.id,
          menuItemId: line.menuItemId,
          categoryId: categoryByMenuItemId.get(line.menuItemId) ?? null,
          serviceStyle: line.serviceStyle ?? null,
          notes: line.notes ?? null,
          sortOrder: index,
          source: "Manual",
          addedById: actor.id
        }))
      }),
      // The mirror. Dropped once the kitchen dashboard and the PDF read lines.
      prisma.event.update({
        where: { id, organizationId: actor.organizationId },
        data: {
          menuItemIds: lines.map((line) => line.menuItemId),
          updatedById: actor.id
        }
      })
    ]);

    const menu = await prisma.eventMenu.findUnique({
      where: { id: saved.id },
      select: {
        id: true,
        meal: true,
        status: true,
        serviceStyle: true,
        confirmedAt: true,
        version: true,
        confirmedBy: { select: { id: true, name: true } },
        lines: { select: lineSelect, orderBy: lineOrder }
      }
    });

    return NextResponse.json({
      menu: menu ? { ...menu, lines: menu.lines.map(presentLine) } : null
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
 * Confirm locks the menu and freezes the names on every line; reopen puts it
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

    const event = await loadEvent(actor, id);

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

      if (!existing || existing.version !== input.version) return null;

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
        // Freeze the names. Raw SQL because this copies per-row from two joined
        // tables, which `updateMany` cannot express.
        await transaction.$executeRaw`
          UPDATE "event_menu_lines" AS line
          SET "item_name" = item."name",
              "category_name" = category."name",
              "updated_at" = NOW()
          FROM "menu_items" AS item
          LEFT JOIN "menu_categories" AS category
            ON category."id" = item."category_id"
          WHERE item."id" = line."menu_item_id"
            AND line."event_menu_id" = ${existing.id}::uuid
        `;
      } else {
        // Back to answering from the library.
        await transaction.eventMenuLine.updateMany({
          where: { eventMenuId: existing.id },
          data: { itemName: null, categoryName: null }
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

    const menu = await prisma.eventMenu.findUnique({
      where: { id: result.id },
      select: {
        id: true,
        meal: true,
        status: true,
        serviceStyle: true,
        confirmedAt: true,
        version: true,
        confirmedBy: { select: { id: true, name: true } },
        lines: { select: lineSelect, orderBy: lineOrder }
      }
    });

    return NextResponse.json({
      menu: menu ? { ...menu, lines: menu.lines.map(presentLine) } : null
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
