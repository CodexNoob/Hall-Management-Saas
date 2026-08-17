import { z } from "zod";

/**
 * The columns a client may set on a menu item.
 *
 * Shared by create (`POST /api/menu`) and update
 * (`PATCH /api/menu/items/[itemId]`) so the two handlers cannot drift into
 * accepting different shapes for the same row. `organizationId` and
 * `pictureBucket` are deliberately absent: both are decided server side.
 */
export const menuItemFieldsSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().optional(),
  usageType: z.string().trim().min(1),
  kosherType: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  // A storage path, never a bucket and never a URL. The bucket is decided
  // server-side; a signed URL would be dead within five minutes.
  picturePath: z.string().trim().min(1).optional()
});

/**
 * Every field optional, because an edit sends only what changed.
 *
 * `picturePath` widens to nullable here and only here: on create there is
 * nothing to clear, while on update an explicit `null` means "drop the picture"
 * and an omitted key means "leave whatever is stored".
 */
export const menuItemUpdateSchema = menuItemFieldsSchema.partial().extend({
  picturePath: z.string().trim().min(1).nullable().optional()
});

export type MenuItemUpdateInput = z.infer<typeof menuItemUpdateSchema>;
