import { prisma } from "@/lib/prisma";

/**
 * Validates the ids a package is about to include against the acting
 * organization.
 *
 * Returns the message to answer with, or `null` when every id resolves - the
 * same shape as `readPicturePathError`, and called from the same two places
 * (create and update) so a package cannot be built one way and edited another.
 *
 * `included_menu_item_ids` is a `uuid[]`, not a foreign key, so the database
 * will happily store an id belonging to another organization or to no row at
 * all. Nothing downstream re-checks it: the grid resolves these ids against the
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
