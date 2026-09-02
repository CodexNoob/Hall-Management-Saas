import { z } from "zod";
import {
  businessSegmentSchema,
  menuItemKindSchema,
  serviceRuleSchema
} from "@/features/menu/lib/service-style";

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
  // Which side of the business the item belongs to. This column briefly held the
  // service style instead, which is why the two are named apart now: the styles
  // live in `services` below, on their own rows.
  usageType: businessSegmentSchema,
  kind: menuItemKindSchema,
  // One entry per style the dish is served in. An empty array is a dish that is
  // catalogued but not served - what used to be the "Library" sentinel.
  // Capped at the number of styles that exist, since the unique index makes a
  // second rule for the same style and basis impossible anyway.
  services: z.array(serviceRuleSchema).max(2).optional(),
  kosherType: z.enum(["Milchig", "Fleishig", "Parve"]).optional(),
  // Only the drink form asks this - it is what stands where that form's category
  // and kashrut selects used to be - so an omitted key is the ordinary case for
  // a dish rather than a caller forgetting a field.
  containsAlcohol: z.boolean().optional(),
  allergens: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
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
 *
 * `containsAlcohol` widens for the same reason and with the same reading: an
 * item re-filed from a drink to a dish sends `null` to unsay an answer that no
 * longer has a question behind it.
 */
export const menuItemUpdateSchema = menuItemFieldsSchema.partial().extend({
  picturePath: z.string().trim().min(1).nullable().optional(),
  containsAlcohol: z.boolean().nullable().optional()
});

export type MenuItemUpdateInput = z.infer<typeof menuItemUpdateSchema>;
