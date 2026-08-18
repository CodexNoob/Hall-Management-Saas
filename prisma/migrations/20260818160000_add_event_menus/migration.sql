-- The event menu becomes a document - a header and its lines - instead of
-- `events.menu_item_ids`, a bare uuid array with no foreign key, no ordering,
-- and nowhere to record anything about a dish on this particular event.
--
-- `menu_item_ids` is deliberately left in place and still written by the API.
-- Every branch shares one database, so a reader that has not moved over yet
-- (the kitchen dashboard, the event PDF) must keep finding what it expects.
-- Dropping it is a later phase, once those readers are repointed.

-- Tab order for the course strip. Ties fall back to name.
ALTER TABLE "menu_categories" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "menu_categories_organization_id_is_active_idx";
CREATE INDEX "menu_categories_organization_id_is_active_sort_order_idx" ON "menu_categories"("organization_id", "is_active", "sort_order");

-- `menu_categories` has been readable since it was created but nothing ever
-- wrote to it, so it is empty everywhere. The course tabs used to be seven
-- hardcoded strings in the frontend that dish text was fuzzy-matched into.
--
-- Backfilling from what orgs actually typed preserves their real data - a venue
-- that files things as "Fish Appetizers" keeps that tab - rather than imposing
-- the hardcoded list on them. Case-folded, because "Main" and "main" are one
-- course and two tabs would be a bug.
WITH canonical ("name", "position") AS (
    VALUES
        ('Appetizer', 0),
        ('Soup', 1),
        ('Main', 2),
        ('Side', 3),
        ('Drink', 4),
        ('Dessert', 5),
        ('More', 6)
),
distinct_categories AS (
    SELECT DISTINCT ON (item."organization_id", lower(btrim(item."category")))
        item."organization_id",
        btrim(item."category") AS "name"
    FROM "menu_items" AS item
    WHERE item."category" IS NOT NULL
      AND btrim(item."category") <> ''
    -- Oldest spelling wins the tie, so the tab reads the way the org first
    -- wrote it rather than however it was last typed.
    ORDER BY item."organization_id", lower(btrim(item."category")), item."created_at"
),
ordered_categories AS (
    SELECT
        distinct_category."organization_id",
        distinct_category."name",
        -- A course the hardcoded list knew about keeps that position, so the
        -- tabs come out in menu order rather than alphabetically. Anything else
        -- is appended after them.
        COALESCE(
            canonical."position",
            100 + (row_number() OVER (
                PARTITION BY distinct_category."organization_id"
                ORDER BY distinct_category."name"
            ))::INTEGER
        ) AS "sort_order"
    FROM distinct_categories AS distinct_category
    LEFT JOIN canonical ON lower(canonical."name") = lower(distinct_category."name")
)
INSERT INTO "menu_categories" ("id", "organization_id", "name", "sort_order", "is_active", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    ordered_category."organization_id",
    ordered_category."name",
    ordered_category."sort_order",
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM ordered_categories AS ordered_category
ON CONFLICT ("organization_id", "name") DO NOTHING;

-- An org whose dishes carry no category at all would otherwise open the menu
-- tab to an empty tab strip and no way to add anything. Seed those with the
-- seven courses the frontend used to hardcode.
INSERT INTO "menu_categories" ("id", "organization_id", "name", "sort_order", "is_active", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    organization."id",
    seed."name",
    seed."position",
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations" AS organization
CROSS JOIN (
    VALUES
        ('Appetizer', 0),
        ('Soup', 1),
        ('Main', 2),
        ('Side', 3),
        ('Drink', 4),
        ('Dessert', 5),
        ('More', 6)
) AS seed ("name", "position")
WHERE NOT EXISTS (
    SELECT 1 FROM "menu_categories" AS existing
    WHERE existing."organization_id" = organization."id"
)
ON CONFLICT ("organization_id", "name") DO NOTHING;

-- The free-text `category` column stays, written but unread, the way
-- `counting_rules` was left when `menu_item_services` replaced it. Same reason:
-- another branch is still selecting it off this shared database.
ALTER TABLE "menu_items" ADD COLUMN "category_id" UUID;

UPDATE "menu_items" AS item
SET "category_id" = category."id"
FROM "menu_categories" AS category
WHERE category."organization_id" = item."organization_id"
  AND lower(category."name") = lower(btrim(item."category"))
  AND item."category" IS NOT NULL;

CREATE INDEX "menu_items_organization_id_category_id_idx" ON "menu_items"("organization_id", "category_id");
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "event_menus" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "meal" TEXT NOT NULL DEFAULT 'Main',
    "service_style" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "confirmed_at" TIMESTAMPTZ(3),
    "confirmed_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "event_menus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_menu_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_menu_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "item_name" TEXT,
    "category_id" UUID,
    "category_name" TEXT,
    "service_style" TEXT,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'Manual',
    "added_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "event_menu_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_menus_event_id_meal_key" ON "event_menus"("event_id", "meal");
CREATE INDEX "event_menus_organization_id_status_idx" ON "event_menus"("organization_id", "status");

CREATE UNIQUE INDEX "event_menu_lines_event_menu_id_menu_item_id_key" ON "event_menu_lines"("event_menu_id", "menu_item_id");
CREATE INDEX "event_menu_lines_organization_id_event_menu_id_sort_order_idx" ON "event_menu_lines"("organization_id", "event_menu_id", "sort_order");
-- Carries the delete guard. Without it, refusing to delete a dish still on a
-- menu is a sequential scan of every event in the org - which is what
-- /api/menu/items/[itemId] does today against `menu_item_ids`.
CREATE INDEX "event_menu_lines_menu_item_id_idx" ON "event_menu_lines"("menu_item_id");

-- One header per event that has a menu today. Events whose array is empty and
-- whose menu was never confirmed get no row; the API creates one on first save.
INSERT INTO "event_menus" ("id", "organization_id", "event_id", "meal", "status", "confirmed_at", "version", "created_at", "updated_at")
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
    -- Left NULL even for a confirmed menu. `updated_at` is the only timestamp
    -- available and any later edit moved it, so it would be a guess presented
    -- as a fact. The column is nullable precisely so this can be unknown.
    NULL,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "events" AS event
WHERE array_length(event."menu_item_ids", 1) > 0
   OR (
        jsonb_typeof(event."workspace_data") = 'object'
    AND event."workspace_data"->>'menuConfirmed' = 'true'
   );

-- Array position becomes sort order, so the menu comes back in the order it was
-- built rather than whatever order the ids happened to be stored in.
--
-- The join to `menu_items` drops ids pointing at dishes that no longer exist -
-- the array has no foreign key, so nothing stopped a delete from leaving them
-- behind, and the kitchen route quietly `.filter(Boolean)`s them away today.
-- They cannot be carried across a real foreign key, and inventing a dish for
-- them would be worse than dropping them.
--
-- `menu_item_ids` is TEXT[], so the values are cast. The regex guard is there
-- because a cast that fails takes the whole migration with it.
INSERT INTO "event_menu_lines" ("id", "organization_id", "event_menu_id", "menu_item_id", "category_id", "sort_order", "source", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    menu."organization_id",
    menu."id",
    item."id",
    item."category_id",
    (selected."ordinality" - 1)::INTEGER,
    'Manual',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "event_menus" AS menu
JOIN "events" AS event ON event."id" = menu."event_id"
CROSS JOIN LATERAL unnest(event."menu_item_ids") WITH ORDINALITY AS selected("menu_item_id", "ordinality")
JOIN "menu_items" AS item
    ON item."id" = selected."menu_item_id"::UUID
   AND item."organization_id" = menu."organization_id"
WHERE selected."menu_item_id" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
-- The same id twice in one array is possible today: the kitchen's
-- replace-menu-item maps in place, so replacing A with B when B was already on
-- the menu stored B twice. The unique below is what stops that recurring.
ON CONFLICT ("event_menu_id", "menu_item_id") DO NOTHING;

-- A confirmed menu is frozen, so its lines carry their own copy of the names.
-- A draft deliberately does not: it should follow a library rename right up
-- until somebody signs it off.
UPDATE "event_menu_lines" AS line
SET "item_name" = item."name",
    "category_name" = (
        SELECT category."name" FROM "menu_categories" AS category
        WHERE category."id" = line."category_id"
    )
FROM "event_menus" AS menu, "menu_items" AS item
WHERE menu."id" = line."event_menu_id"
  AND menu."status" = 'Confirmed'
  AND item."id" = line."menu_item_id";

-- AddForeignKey
ALTER TABLE "event_menus" ADD CONSTRAINT "event_menus_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_menus" ADD CONSTRAINT "event_menus_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_menus" ADD CONSTRAINT "event_menus_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "event_menu_lines" ADD CONSTRAINT "event_menu_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_menu_lines" ADD CONSTRAINT "event_menu_lines_event_menu_id_fkey" FOREIGN KEY ("event_menu_id") REFERENCES "event_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- RESTRICT is the point of this table: it turns "refuse to delete a dish an
-- event still serves" from an app-level count into something the database
-- guarantees, and it cannot be bypassed by a route that forgot to check.
ALTER TABLE "event_menu_lines" ADD CONSTRAINT "event_menu_lines_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_menu_lines" ADD CONSTRAINT "event_menu_lines_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_menu_lines" ADD CONSTRAINT "event_menu_lines_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Closed value sets as CHECK rather than a native enum, matching
-- menu_item_services: there is no enum in this schema to be consistent with,
-- and ALTER TYPE can add a value but never remove one.
ALTER TABLE "event_menus" ADD CONSTRAINT "event_menus_meal_check" CHECK ("meal" IN ('Main', 'FridayNight', 'ShabbosDay', 'SeudahShlishis'));
ALTER TABLE "event_menus" ADD CONSTRAINT "event_menus_status_check" CHECK ("status" IN ('Draft', 'ClientSubmitted', 'Confirmed'));
ALTER TABLE "event_menus" ADD CONSTRAINT "event_menus_service_style_check" CHECK ("service_style" IS NULL OR "service_style" IN ('Buffet', 'Plated'));

ALTER TABLE "event_menu_lines" ADD CONSTRAINT "event_menu_lines_source_check" CHECK ("source" IN ('Manual', 'Package', 'ClientPortal'));
ALTER TABLE "event_menu_lines" ADD CONSTRAINT "event_menu_lines_service_style_check" CHECK ("service_style" IS NULL OR "service_style" IN ('Buffet', 'Plated'));

-- Tenant isolation, written per table the way supabase-rls.sql does it. Both
-- tables are also added to the loop in that file so a re-run keeps them.
ALTER TABLE public.event_menus ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_menus FROM anon;

CREATE POLICY tenant_member_access ON public.event_menus
FOR ALL TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));

ALTER TABLE public.event_menu_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_menu_lines FROM anon;

CREATE POLICY tenant_member_access ON public.event_menu_lines
FOR ALL TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));
