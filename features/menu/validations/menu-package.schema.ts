import { z } from "zod";
import { moneySchema } from "@/lib/validation/number";

/**
 * The library items a package includes.
 *
 * Collapsed to a set on the way in: `packages.included_menu_item_ids` is a plain
 * array, so the same id sent twice would be stored twice and drawn twice in a
 * list where the copies are indistinguishable - and removing one of them would
 * leave the other behind.
 *
 * Membership only. What an item costs and how it is counted belongs to the item,
 * not to the package that names it, so nothing here duplicates a `menu_items`
 * column.
 */
export const packageMenuItemIdsSchema = z
  .array(z.string().uuid())
  .transform((menuItemIds) => Array.from(new Set(menuItemIds)));

/**
 * The columns a client may set on a package.
 *
 * Shared by create (`POST /api/menu`) and update
 * (`PATCH /api/menu/packages/[packageId]`) for the same reason
 * `menuItemFieldsSchema` is: the two handlers write one row and must not drift
 * into accepting different shapes for it. `organizationId` is absent because it
 * is injected server side.
 */
export const menuPackageFieldsSchema = z.object({
  name: z.string().trim().min(1).max(200),
  regularPrice: moneySchema({ label: "Regular price" }).optional(),
  memberPrice: moneySchema({ label: "Member price" }).optional(),
  hallIds: z.array(z.string().uuid()).default([]),
  eventTypeIds: z.array(z.string().uuid()).default([]),
  includedMenuItemIds: packageMenuItemIdsSchema.default([]),
  notes: z.string().trim().optional()
});

/**
 * Every field optional, because an edit sends only what changed.
 *
 * Two ways to write the item list, and the difference matters:
 *
 * - `includedMenuItemIds` is the whole list, replacing what is stored. It is
 *   what a form that shows every checkbox at once has to send, because only the
 *   full list can express an unchecked box.
 * - `addMenuItemIds` / `removeMenuItemIds` name one end of the change and leave
 *   the rest of the column alone. This is what a click on a single card sends,
 *   and it is the form that survives two clicks racing: the whole-list version
 *   is built from whatever the browser last fetched, so the second write to
 *   arrive undoes the first.
 *
 * Sending both at once is refused rather than resolved in some order, because
 * either order is a guess at which one the caller meant.
 */
export const menuPackageUpdateSchema = menuPackageFieldsSchema
  .partial()
  .pick({ name: true, regularPrice: true, includedMenuItemIds: true })
  .extend({
    addMenuItemIds: packageMenuItemIdsSchema.optional(),
    removeMenuItemIds: packageMenuItemIdsSchema.optional()
  })
  .refine(
    (input) =>
      input.includedMenuItemIds === undefined ||
      (input.addMenuItemIds === undefined &&
        input.removeMenuItemIds === undefined),
    {
      message:
        "Send either the whole item list or an add/remove change, not both.",
      path: ["includedMenuItemIds"]
    }
  );
