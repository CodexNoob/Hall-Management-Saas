/**
 * Menu item pictures.
 *
 * A constant rather than an entry in lib/env.ts, unlike the three buckets
 * there: this is the only bucket the browser writes to, so the name has to
 * resolve on both sides. A NEXT_PUBLIC_ variable would not - Next inlines
 * those at build time without applying the zod default, so an unset value
 * would give the server "menu-images" and the browser `undefined`, and the
 * upload would fail only in production. A constant cannot drift.
 *
 * The bucket is private and created by hand in the Supabase dashboard, the
 * same as event-files / event-layouts / generated-pdfs - nothing in this repo
 * provisions storage.buckets. It needs no policies of its own: the four
 * storage.objects policies in prisma/supabase-rls.sql are bucket-agnostic and
 * key on the first path segment being the caller's organization id.
 */
export const MENU_IMAGE_BUCKET = "menu-images";

/**
 * Hall floor-plan backgrounds. Same shape as MENU_IMAGE_BUCKET and for the
 * same reason: the browser uploads directly, so the name has to resolve on
 * both sides, and the bucket-agnostic storage.objects policies key on the
 * org-id path prefix. Private; created by hand in the Supabase dashboard.
 */
export const HALL_FLOOR_PLAN_BUCKET = "hall-floor-plans";

/**
 * The organization logo shown on the settings profile. Same shape and the same
 * reasoning as the two above - browser-written, so a constant rather than an
 * env variable; private, and created by hand in the Supabase dashboard.
 */
export const ORGANIZATION_LOGO_BUCKET = "organization-logos";
