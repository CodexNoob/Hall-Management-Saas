import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";
import { createSignedFileUrls } from "@/lib/storage/files";

/**
 * The pieces of an event's menu document that more than one route needs.
 *
 * Lifted out of `app/api/events/[eventId]/menu/route.ts` when applying a package
 * got its own route: both answer with the same `{ menu }` payload, and a second
 * copy of the select, the presenter and the version-conflict reply is exactly
 * the kind of drift that leaves one route serving a field the other does not.
 */

export const MEALS = [
  "Main",
  "FridayNight",
  "ShabbosDay",
  "SeudahShlishis"
] as const;
export const SERVICE_STYLES = ["Buffet", "Plated"] as const;

/// Manual | Package | ClientPortal - who put the line on the menu. Recorded
/// rather than assumed: removing a package has to find the lines that package
/// put there and leave the ones staff added by hand alone.
export const LINE_SOURCES = ["Manual", "Package", "ClientPortal"] as const;

export const mealSchema = z.enum(MEALS).default("Main");
export const serviceStyleSchema = z.enum(SERVICE_STYLES).nullable().optional();
export const eventIdSchema = z.string().uuid();

export const CONFLICT_MESSAGE =
  "This menu was changed somewhere else. Reload before saving again.";

export const CONFIRMED_MESSAGE =
  "This menu is confirmed. Reopen it before editing.";

export function conflict() {
  return NextResponse.json({ error: CONFLICT_MESSAGE }, { status: 409 });
}

export function confirmedMenu() {
  return NextResponse.json({ error: CONFIRMED_MESSAGE }, { status: 409 });
}

const lineOrder = [
  { sortOrder: "asc" },
  { createdAt: "asc" }
] satisfies Prisma.EventMenuLineOrderByWithRelationInput[];

const lineSelect = {
  id: true,
  menuItemId: true,
  addOnId: true,
  itemName: true,
  serviceStyle: true,
  notes: true,
  sortOrder: true,
  quantityMultiplier: true,
  source: true,
  menuItem: {
    select: {
      name: true,
      kind: true,
      isActive: true,
      // Signed below and handed over as a URL. The bucket is never selected and
      // the path never reaches the client, the same rule GET /api/menu follows:
      // these two columns are the only thing that would let a caller address
      // the stored object directly instead of through a short-lived URL.
      picturePath: true,
      services: { select: { serviceStyle: true } }
    }
  },
  addOn: {
    select: { name: true, price: true, isActive: true, picturePath: true }
  }
} satisfies Prisma.EventMenuLineSelect;

export const menuSelect = {
  id: true,
  meal: true,
  status: true,
  serviceStyle: true,
  confirmedAt: true,
  version: true,
  confirmedBy: { select: { id: true, name: true } },
  lines: { select: lineSelect, orderBy: lineOrder }
} satisfies Prisma.EventMenuSelect;

type MenuLineRow = Prisma.EventMenuLineGetPayload<{
  select: typeof lineSelect;
}>;

/**
 * A confirmed line answers from its own snapshot; a draft answers from the
 * library. That is the whole rule: renaming a dish should flow into a menu
 * nobody has signed off yet, and must not change one the kitchen already read.
 */
function presentLine(line: MenuLineRow, pictureUrl: string | null) {
  const isAddOn = line.addOnId !== null;

  return {
    id: line.id,
    menuItemId: line.menuItemId,
    addOnId: line.addOnId,
    kind: isAddOn ? ("AddOn" as const) : ("Dish" as const),
    name: line.itemName ?? line.menuItem?.name ?? line.addOn?.name ?? "",
    // Live, not snapshotted like the name. A picture is how staff recognise the
    // dish on the sheet; a stale one is worse than a renamed one, and the
    // catalog row cannot be deleted out from under a line anyway.
    pictureUrl,
    serviceStyle: line.serviceStyle,
    // Which styles the dish could be served in, so the menu tab can ask when a
    // dish carries a rule for both and this event has not said which.
    availableStyles: [
      ...new Set((line.menuItem?.services ?? []).map((s) => s.serviceStyle))
    ],
    price: line.addOn?.price === undefined ? null : Number(line.addOn.price),
    notes: line.notes,
    sortOrder: line.sortOrder,
    // Not snapshotted on confirmation the way the name is: how many of a dish
    // this event ordered is the event's own decision, never a library value
    // that could change underneath it.
    quantityMultiplier: line.quantityMultiplier,
    source: line.source,
    isRetired: isAddOn
      ? line.addOn?.isActive === false
      : line.menuItem?.isActive === false
  };
}

type StoredMenu = Prisma.EventMenuGetPayload<{ select: typeof menuSelect }>;

/**
 * One signing request for the whole menu rather than one per card, matching
 * what GET /api/menu does for the library grid.
 *
 * The 300s default outlives the 2 minute client query cache, so a cached
 * response never holds an expired URL. Storage being unreachable costs the
 * thumbnails, not the menu.
 *
 * `packageId` rides along from the event rather than from the menu row: the
 * package a booking is on has always lived on `Event`, and the menu tab needs
 * it to say which package the dishes in front of the user came from.
 */
export async function presentMenu(
  menu: StoredMenu,
  {
    organizationId,
    packageId
  }: { organizationId: string; packageId: string | null }
) {
  const picturePaths = menu.lines
    .map((line) => line.menuItem?.picturePath ?? line.addOn?.picturePath)
    .filter((path): path is string => Boolean(path));

  let signedUrlsByPath = new Map<string, string>();

  if (picturePaths.length > 0) {
    try {
      signedUrlsByPath = await createSignedFileUrls({
        organizationId,
        bucket: MENU_IMAGE_BUCKET,
        paths: [...new Set(picturePaths)]
      });
    } catch (signingError) {
      console.error("Failed to sign event menu pictures", signingError);
    }
  }

  return {
    ...menu,
    packageId,
    lines: menu.lines.map((line) => {
      const picturePath =
        line.menuItem?.picturePath ?? line.addOn?.picturePath ?? null;

      return presentLine(
        line,
        picturePath ? (signedUrlsByPath.get(picturePath) ?? null) : null
      );
    })
  };
}

/**
 * Reads one event's menu back and presents it. Every write ends this way, so a
 * caller never has to re-read what it just saved.
 */
export async function readPresentedMenu(
  eventMenuId: string,
  context: { organizationId: string; packageId: string | null }
) {
  const menu = await prisma.eventMenu.findUnique({
    where: { id: eventMenuId },
    select: menuSelect
  });

  return menu ? await presentMenu(menu, context) : null;
}

/// Nothing is stored until the first save, so a read of an untouched event
/// answers with this. Version 0 is what that first write sends back.
export const emptyMenu = (meal: string, packageId: string | null = null) => ({
  id: null,
  meal,
  status: "Draft",
  serviceStyle: null,
  confirmedAt: null,
  version: 0,
  confirmedBy: null,
  packageId,
  lines: []
});

/**
 * Drops the kitchen's per-dish rows for dishes this event no longer serves.
 *
 * `kitchen_item_statuses` is keyed on (event, dish) rather than on a menu line,
 * so taking a dish off a menu used to leave its row behind. Nothing rendered it
 * afterwards - the kitchen board builds its lines from the menu and looks each
 * status up - so the orphan was invisible until the menu library refused to
 * delete the dish and could not say which event was holding it.
 *
 * Every path that rewrites lines calls this, and every one of them is already
 * inside the transaction that did the rewrite: a status row must not outlive a
 * line removal that later rolls back.
 *
 * Scoped to the whole event, not one meal. The statuses are, so pruning against
 * a single meal's lines would delete the progress recorded against another
 * meal's dishes.
 */
export async function discardOrphanedKitchenStatuses(
  transaction: Prisma.TransactionClient,
  { organizationId, eventId }: { organizationId: string; eventId: string }
) {
  const served = await transaction.eventMenuLine.findMany({
    where: { eventMenu: { eventId }, menuItemId: { not: null } },
    select: { menuItemId: true }
  });

  const servedMenuItemIds = [
    ...new Set(
      served
        .map((line) => line.menuItemId)
        .filter((value): value is string => Boolean(value))
    )
  ];

  await transaction.kitchenItemStatus.deleteMany({
    where: {
      organizationId,
      eventId,
      // An event serving nothing keeps no statuses at all. Spelled out rather
      // than left to `notIn: []`, which is a no-op filter in some engines and
      // an empty `NOT IN` in others.
      ...(servedMenuItemIds.length > 0
        ? { menuItemId: { notIn: servedMenuItemIds } }
        : {})
    }
  });
}

export function loadEventForMenu(
  actor: { organizationId: string },
  eventId: string
) {
  return prisma.event.findFirst({
    where: {
      id: eventId,
      organizationId: actor.organizationId,
      deleted: false
    },
    // `packageId` travels with the menu document; `workspaceData` is merged into
    // on confirm, and merging needs what is already there.
    select: {
      id: true,
      hallId: true,
      workspaceData: true,
      packageId: true,
      eventDate: true,
      eventType: true,
      clientName: true,
      hall: { select: { name: true } }
    }
  });
}
