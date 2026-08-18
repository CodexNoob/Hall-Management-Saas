-- Lets a menu line point at an add-on instead of a dish.
--
-- `20260818160000_add_event_menus` was edited after it had already been applied
-- to a database, which `prisma migrate deploy` does not re-run - it records a
-- migration as done by name and moves on. So the add-on half of that edit never
-- reached anything that had already migrated, and the app failed on a missing
-- `add_on_id`. This migration carries it instead.
--
-- Every step is written to be a no-op if it has already happened, because two
-- shapes of `event_menu_lines` are now in the wild: the one the original file
-- created, and the one the edited file creates on a database migrating for the
-- first time. Both have to end up here.

ALTER TABLE "event_menu_lines" ADD COLUMN IF NOT EXISTS "add_on_id" UUID;

-- A line is a dish or an add-on, so the dish column can no longer be mandatory.
ALTER TABLE "event_menu_lines" ALTER COLUMN "menu_item_id" DROP NOT NULL;

-- Created before the backfill below, which needs it for ON CONFLICT. NULLs are
-- distinct in a unique index, so this does not constrain dish lines.
CREATE UNIQUE INDEX IF NOT EXISTS "event_menu_lines_event_menu_id_add_on_id_key" ON "event_menu_lines"("event_menu_id", "add_on_id");
-- Carries the delete guard for add-ons, the way the menu_item_id index does for
-- dishes: an index lookup rather than a scan of every line in the org.
CREATE INDEX IF NOT EXISTS "event_menu_lines_add_on_id_idx" ON "event_menu_lines"("add_on_id");

-- An event that only ever had add-ons got no menu header, because the original
-- migration looked at `menu_item_ids` alone. Give those events one so their
-- add-ons have somewhere to hang.
INSERT INTO "event_menus" ("id", "organization_id", "event_id", "meal", "status", "version", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    event."organization_id",
    event."id",
    'Main',
    CASE
        WHEN jsonb_typeof(event."workspace_data") = 'object'
         AND event."workspace_data"->>'menuConfirmed' = 'true'
        THEN 'Confirmed'
        ELSE 'Draft'
    END,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "events" AS event
WHERE array_length(event."add_on_ids", 1) > 0
  AND NOT EXISTS (
      SELECT 1 FROM "event_menus" AS existing
      WHERE existing."event_id" = event."id" AND existing."meal" = 'Main'
  );

-- Dishes already on a menu carry no service style, because the id array they
-- came from could not hold one. Fill it in only where the dish is served
-- exactly one way; a dish carrying both a Buffet and a Plated rule genuinely
-- has no answer here, and guessing would decide what the kitchen cooks.
--
-- `min` rather than a bare column so the HAVING is legal without a GROUP BY:
-- with one distinct style it is that style, and with none or two the HAVING
-- drops the row and the subquery yields NULL.
UPDATE "event_menu_lines" AS line
SET "service_style" = (
        SELECT min(service."service_style")
        FROM "menu_item_services" AS service
        WHERE service."menu_item_id" = line."menu_item_id"
        HAVING count(DISTINCT service."service_style") = 1
    )
WHERE line."menu_item_id" IS NOT NULL
  AND line."service_style" IS NULL;

-- Add-ons the client portal had already put on an event become lines, so the
-- menu tab shows everything the event is getting rather than dishes only. They
-- sort after the dishes, which is how they read on a menu.
INSERT INTO "event_menu_lines" ("id", "organization_id", "event_menu_id", "add_on_id", "sort_order", "source", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    menu."organization_id",
    menu."id",
    "add_on"."id",
    coalesce(array_length(event."menu_item_ids", 1), 0) + (selected."ordinality" - 1)::INTEGER,
    'ClientPortal',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "event_menus" AS menu
JOIN "events" AS event ON event."id" = menu."event_id"
CROSS JOIN LATERAL unnest(event."add_on_ids") WITH ORDINALITY AS selected("add_on_id", "ordinality")
JOIN "add_ons" AS "add_on"
    ON "add_on"."id" = selected."add_on_id"::UUID
   AND "add_on"."organization_id" = menu."organization_id"
-- `add_on_ids` is TEXT[], and a cast that fails would take the migration with it.
WHERE selected."add_on_id" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
ON CONFLICT ("event_menu_id", "add_on_id") DO NOTHING;

-- The event menu is organised by how a dish is served - Buffet, Plated, add-ons -
-- not by course, so these two snapshots have no reader. The course columns on
-- `menu_items` and the `menu_categories` table stay: the menu library's plated
-- view still groups by course.
ALTER TABLE "event_menu_lines" DROP COLUMN IF EXISTS "category_id";
ALTER TABLE "event_menu_lines" DROP COLUMN IF EXISTS "category_name";

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.event_menu_lines'::regclass
          AND conname = 'event_menu_lines_add_on_id_fkey'
    ) THEN
        -- RESTRICT, matching the dish side: deleting something an event is
        -- still serving is refused by the database, not only by the app.
        ALTER TABLE "event_menu_lines"
            ADD CONSTRAINT "event_menu_lines_add_on_id_fkey"
            FOREIGN KEY ("add_on_id") REFERENCES "add_ons"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.event_menu_lines'::regclass
          AND conname = 'event_menu_lines_target_check'
    ) THEN
        -- A line points at a dish or at an add-on, never both and never
        -- neither. Without this two nullable columns would let a row mean
        -- nothing at all, and every reader would have to defend against it.
        ALTER TABLE "event_menu_lines"
            ADD CONSTRAINT "event_menu_lines_target_check"
            CHECK (num_nonnulls("menu_item_id", "add_on_id") = 1);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.event_menu_lines'::regclass
          AND conname = 'event_menu_lines_add_on_style_check'
    ) THEN
        -- An add-on is not served buffet or plated; it is simply on the event.
        ALTER TABLE "event_menu_lines"
            ADD CONSTRAINT "event_menu_lines_add_on_style_check"
            CHECK ("add_on_id" IS NULL OR "service_style" IS NULL);
    END IF;
END
$$;
