import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  conflict,
  confirmedMenu,
  discardOrphanedKitchenStatuses,
  emptyMenu,
  eventIdSchema,
  loadEventForMenu,
  mealSchema,
  readPresentedMenu
} from "@/features/events/server/event-menu-document";
import {
  assertInScope,
  authorize,
  requireUserActor
} from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

/**
 * Putting a package on one event's menu, and taking it back off.
 *
 * A package is a saved list of dishes sold together. Until now the only way to
 * build an event menu was to pick those dishes one at a time out of the library,
 * which is the same work every time a venue books the package it sells most.
 * This materialises the list onto the menu instead - which is exactly what
 * `EventMenuLine.source = 'Package'` was reserved for.
 *
 * Two things separate it from a batch of manual adds:
 *
 * - The lines are tagged `Package`, so removing the package finds them again and
 *   leaves anything staff added by hand alone.
 * - `Event.packageId` / `Event.packageName` are set, which is what the calendar,
 *   the kitchen dashboard and the dining manager read to name the package.
 *
 * The menu's `version` is checked here the same way the PUT checks it, so a
 * package applied against a menu somebody else has since changed is refused
 * rather than quietly overwriting their work.
 */

const applySchema = z.object({
  meal: mealSchema,
  // Absent only on a menu that has never been saved, which is version 0.
  version: z.number().int().min(0).optional(),
  packageId: z.string().uuid()
});

const removeSchema = z.object({
  meal: mealSchema,
  version: z.number().int().min(0).optional()
});

/** Lines this route owns. Manual and ClientPortal lines are never touched. */
const PACKAGE_SOURCE = "Package";

type MenuGate =
  | { kind: "ok"; id: string }
  | { kind: "conflict" }
  | { kind: "confirmed" }
  | { kind: "missing" };

/**
 * The read-check-bump every write to a menu shares: refuse a stale version,
 * refuse a confirmed menu, and take the version with it so a concurrent write
 * cannot land between the check and the change.
 *
 * `createWhenMissing` is false for a removal - there is nothing to take off a
 * menu that has never been saved, and creating an empty row to say so would
 * leave a draft behind on an event nobody has touched.
 */
async function openMenuForWrite(
  transaction: Prisma.TransactionClient,
  {
    organizationId,
    eventId,
    meal,
    version,
    createWhenMissing
  }: {
    organizationId: string;
    eventId: string;
    meal: string;
    version: number | undefined;
    createWhenMissing: boolean;
  }
): Promise<MenuGate> {
  const existing = await transaction.eventMenu.findUnique({
    where: { eventId_meal: { eventId, meal } },
    select: { id: true, status: true, version: true }
  });

  if (!existing) {
    if (version !== undefined && version !== 0) return { kind: "conflict" };
    if (!createWhenMissing) return { kind: "missing" };

    const created = await transaction.eventMenu.create({
      data: {
        organizationId,
        eventId,
        meal,
        status: "Draft",
        version: 1
      },
      select: { id: true }
    });

    return { kind: "ok", id: created.id };
  }

  if (version !== undefined && version !== existing.version) {
    return { kind: "conflict" };
  }

  if (existing.status === "Confirmed") return { kind: "confirmed" };

  const bumped = await transaction.eventMenu.updateMany({
    where: { id: existing.id, version: existing.version },
    data: { version: { increment: 1 } }
  });

  // Someone else committed between the read above and this write.
  if (bumped.count === 0) return { kind: "conflict" };

  return { kind: "ok", id: existing.id };
}

/**
 * Rewrites the id arrays still hanging off the event from what the menu now
 * holds. The kitchen dashboard, the event PDF and the client portal read those,
 * so they cannot be left behind by a write that goes through the lines.
 */
async function mirrorOntoEvent(
  transaction: Prisma.TransactionClient,
  {
    organizationId,
    eventId,
    eventMenuId,
    actorId,
    packageColumns
  }: {
    organizationId: string;
    eventId: string;
    eventMenuId: string;
    actorId: string;
    packageColumns: { packageId: string | null; packageName: string | null };
  }
) {
  const lines = await transaction.eventMenuLine.findMany({
    where: { eventMenuId },
    select: { menuItemId: true, addOnId: true }
  });

  await transaction.event.update({
    where: { id: eventId, organizationId },
    data: {
      menuItemIds: lines
        .map((line) => line.menuItemId)
        .filter((value): value is string => Boolean(value)),
      addOnIds: lines
        .map((line) => line.addOnId)
        .filter((value): value is string => Boolean(value)),
      ...packageColumns,
      updatedById: actorId
    }
  });

  // Removing a package takes its dishes off the menu, so the kitchen rows they
  // left behind go with them - same rule the manual editor follows.
  await discardOrphanedKitchenStatuses(transaction, {
    organizationId,
    eventId
  });
}

function gateResponse(gate: Exclude<MenuGate, { kind: "ok" }>) {
  if (gate.kind === "confirmed") return confirmedMenu();

  return conflict();
}

/** Puts every dish in a package onto the event's menu. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    // The permission every other write to an event menu asks for.
    const actor = await authorize(request, "eventmenu.update");
    const { eventId } = await params;
    const id = eventIdSchema.parse(eventId);
    const input = applySchema.parse(await request.json());

    const event = await loadEventForMenu(actor, id);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    assertInScope(actor, "hall", event.hallId);

    // Scoped to this organization and to an active package, the same check the
    // client portal makes before it lets a package near an event.
    const eventPackage = await prisma.eventPackage.findFirst({
      where: {
        id: input.packageId,
        organizationId: actor.organizationId,
        isActive: true
      },
      select: { id: true, name: true, includedMenuItemIds: true }
    });

    if (!eventPackage) {
      return NextResponse.json(
        { error: "That package is not available for this event." },
        { status: 400 }
      );
    }

    // Deactivated dishes are skipped rather than refused: a package that has
    // outlived one of its items should still be applicable, minus that item.
    // Their service rules come along because they decide which style each line
    // lands under, and the answer is unknowable once the lines are written.
    const items = await prisma.menuItem.findMany({
      where: {
        id: { in: eventPackage.includedMenuItemIds },
        organizationId: actor.organizationId,
        isActive: true
      },
      select: { id: true, services: { select: { serviceStyle: true } } }
    });

    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            "This package has no active menu items to add. Add items to it in the menu library first."
        },
        { status: 400 }
      );
    }

    const packageItemIds = new Set(items.map((item) => item.id));

    const result = await prisma.$transaction(async (transaction) => {
      const gate = await openMenuForWrite(transaction, {
        organizationId: actor.organizationId,
        eventId: id,
        meal: input.meal,
        version: input.version,
        createWhenMissing: true
      });

      if (gate.kind !== "ok") return gate;

      const existingLines = await transaction.eventMenuLine.findMany({
        where: { eventMenuId: gate.id },
        select: { id: true, menuItemId: true, source: true, sortOrder: true }
      });

      // Swapping packages: whatever the previous one put here and this one does
      // not include goes, so the menu matches the package it now names. A dish
      // in both packages stays put and keeps the style it was given.
      const supersededIds = existingLines
        .filter(
          (line) =>
            line.source === PACKAGE_SOURCE &&
            line.menuItemId !== null &&
            !packageItemIds.has(line.menuItemId)
        )
        .map((line) => line.id);

      if (supersededIds.length > 0) {
        await transaction.eventMenuLine.deleteMany({
          where: { id: { in: supersededIds } }
        });
      }

      const keptItemIds = new Set(
        existingLines
          .filter((line) => !supersededIds.includes(line.id))
          .map((line) => line.menuItemId)
          .filter((value): value is string => Boolean(value))
      );
      // Already on the menu by hand: left exactly as it is, tag included. The
      // user put it there, and relabelling it would have the package's removal
      // take it away.
      const additions = items.filter((item) => !keptItemIds.has(item.id));
      const nextSortOrder =
        existingLines.reduce(
          (highest, line) => Math.max(highest, line.sortOrder),
          -1
        ) + 1;

      if (additions.length > 0) {
        await transaction.eventMenuLine.createMany({
          data: additions.map((item, index) => {
            const styles = [
              ...new Set(item.services.map((service) => service.serviceStyle))
            ];

            return {
              organizationId: actor.organizationId,
              eventMenuId: gate.id,
              menuItemId: item.id,
              // A dish served exactly one way needs no decision. One that
              // carries both rules is left unanswered for staff to settle in
              // the tab, because guessing picks the quantity the kitchen cooks.
              serviceStyle: styles.length === 1 ? styles[0] : null,
              sortOrder: nextSortOrder + index,
              source: PACKAGE_SOURCE,
              addedById: actor.userId
            };
          })
        });
      }

      await mirrorOntoEvent(transaction, {
        organizationId: actor.organizationId,
        eventId: id,
        eventMenuId: gate.id,
        actorId: requireUserActor(actor),
        packageColumns: {
          packageId: eventPackage.id,
          packageName: eventPackage.name
        }
      });

      return gate;
    });

    if (result.kind !== "ok") return gateResponse(result);

    // The whole saved menu, the way every other write to it answers, so the tab
    // draws the result instead of going back for it.
    return NextResponse.json({
      menu: await readPresentedMenu(result.id, {
        organizationId: actor.organizationId,
        packageId: eventPackage.id
      })
    });
  } catch (error) {
    // Two writes creating the header at once: the unique caught the loser.
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
 * Takes the package back off: its lines go, the event stops naming it, and
 * anything staff added by hand stays exactly where it is.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const actor = await authorize(request, "eventmenu.update");
    const { eventId } = await params;
    const id = eventIdSchema.parse(eventId);
    // Query params rather than a body: a DELETE with one is accepted unevenly
    // by proxies, and there are only two scalars to carry.
    const searchParams = new URL(request.url).searchParams;
    const rawVersion = searchParams.get("version");
    const input = removeSchema.parse({
      meal: searchParams.get("meal") ?? undefined,
      version: rawVersion === null ? undefined : Number(rawVersion)
    });

    const event = await loadEventForMenu(actor, id);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    assertInScope(actor, "hall", event.hallId);

    const clearedColumns = { packageId: null, packageName: null };

    const result = await prisma.$transaction(async (transaction) => {
      const gate = await openMenuForWrite(transaction, {
        organizationId: actor.organizationId,
        eventId: id,
        meal: input.meal,
        version: input.version,
        createWhenMissing: false
      });

      // No menu row at all: there are no lines to drop, but the event may still
      // name a package - one chosen at booking or through the client portal -
      // and the user asked for that to go.
      if (gate.kind === "missing") {
        await transaction.event.update({
          where: { id, organizationId: actor.organizationId },
          data: { ...clearedColumns, updatedById: actor.userId }
        });

        return gate;
      }

      if (gate.kind !== "ok") return gate;

      await transaction.eventMenuLine.deleteMany({
        where: { eventMenuId: gate.id, source: PACKAGE_SOURCE }
      });

      await mirrorOntoEvent(transaction, {
        organizationId: actor.organizationId,
        eventId: id,
        eventMenuId: gate.id,
        actorId: requireUserActor(actor),
        packageColumns: clearedColumns
      });

      return gate;
    });

    if (result.kind === "missing") {
      return NextResponse.json({ menu: emptyMenu(input.meal, null) });
    }

    if (result.kind !== "ok") return gateResponse(result);

    return NextResponse.json({
      menu: await readPresentedMenu(result.id, {
        organizationId: actor.organizationId,
        packageId: null
      })
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
