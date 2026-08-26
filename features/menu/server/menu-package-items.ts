import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Validates the ids a package is about to include against the acting
 * organization.
 *
 * Returns the message to answer with, or `null` when every id resolves - the
 * same shape as `readPicturePathError`, and called from the same two places
 * (create and update) so a package cannot be built one way and edited another.
 *
 * `included_menu_item_ids` is a bare `text[]`, not a foreign key - not even a
 * `uuid[]` - so the database will happily store an id belonging to another
 * organization, to no row at all, or to nothing shaped like an id in the first
 * place. Nothing downstream re-checks it: the grid resolves these ids against the
 * items it already fetched and silently drops the ones it cannot find, and the
 * delete guard in `/api/menu/items/[itemId]` reads the column the other way
 * round - an id here means "still in use". Both assume what is stored is real,
 * which is only true if it is enforced here, on the way in.
 */
export async function readPackageItemIdsError(
  organizationId: string,
  menuItemIds: string[]
) {
  if (menuItemIds.length === 0) return null;

  // A count is enough rather than a diff of the two lists: the schema has
  // already deduplicated the ids, so a shortfall can only mean one of them did
  // not match. The message stays vague about which - an id the caller could not
  // have got from this organization's menu is not something to help them probe.
  const matchedItems = await prisma.menuItem.count({
    where: { organizationId, id: { in: menuItemIds } }
  });

  if (matchedItems === menuItemIds.length) return null;

  return "One or more selected menu items are not in this organization's menu.";
}

/**
 * Renders a list of ids as a `text[]` literal for the statement below.
 *
 * `text[]`, not `uuid[]`, because that is what the column is: these ids are
 * uuids by convention and are validated as such on the way in, but the column
 * was declared `String[]` with no `@db.Uuid`, so Postgres stores text. Casting
 * to `uuid[]` here gets as far as `array_cat(text[], uuid[]) does not exist`.
 *
 * Every id is still a bound parameter - they are interpolated as placeholders,
 * not as text - so this is no more injectable than passing the array straight
 * through. It is written out element by element rather than handed over as one
 * array parameter so the type is stated in the SQL instead of being inferred
 * from what the driver decided a JavaScript array of strings is, which for an
 * empty list is nothing at all.
 */
function toIdArray(menuItemIds: string[]) {
  if (menuItemIds.length === 0) return Prisma.sql`ARRAY[]::text[]`;

  return Prisma.sql`ARRAY[${Prisma.join(
    menuItemIds.map((menuItemId) => Prisma.sql`${menuItemId}::text`)
  )}]::text[]`;
}

type PackageItemsRow = { id: string; includedMenuItemIds: string[] };

/**
 * Adds and removes package items without reading the column first.
 *
 * This is the whole point of the delta form: the new value is computed from
 * what is stored at the instant of the write, not from what some browser last
 * fetched. Two people adding a different dish - or one person clicking two
 * cards faster than a refetch - both land, where a read-then-replace has the
 * second write silently undo the first.
 *
 * Raw SQL because Prisma's `push` only appends. It cannot remove, and it cannot
 * collapse a repeat, and doing either through the client means reading the row
 * back first, which reopens the exact gap this closes. `EXCEPT` deduplicates on
 * its own, so an id already in the package stays there once however many times
 * it is sent.
 *
 * Order is not preserved, and nothing needs it to be: both the package panel
 * and the event menu resolve these ids against the library and draw them in the
 * library's order.
 *
 * Returns the stored list so the caller can answer with it. `null` means no row
 * matched - a package that is gone, or one belonging to another organization,
 * which are deliberately indistinguishable from out here.
 */
export async function applyPackageItemDelta({
  organizationId,
  packageId,
  addMenuItemIds = [],
  removeMenuItemIds = []
}: {
  organizationId: string;
  packageId: string;
  addMenuItemIds?: string[];
  removeMenuItemIds?: string[];
}) {
  const rows = await prisma.$queryRaw<PackageItemsRow[]>`
    UPDATE "packages"
    SET "included_menu_item_ids" = ARRAY(
          SELECT unnest(
            array_cat("included_menu_item_ids", ${toIdArray(addMenuItemIds)})
          )
          EXCEPT
          SELECT unnest(${toIdArray(removeMenuItemIds)})
        ),
        "updated_at" = NOW()
    WHERE "id" = ${packageId}::uuid
      AND "organization_id" = ${organizationId}::uuid
    RETURNING "id", "included_menu_item_ids" AS "includedMenuItemIds"
  `;

  return rows[0] ?? null;
}
