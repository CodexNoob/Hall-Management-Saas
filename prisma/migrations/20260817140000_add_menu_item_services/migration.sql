-- CreateTable
CREATE TABLE "menu_item_services" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "service_style" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "per" INTEGER NOT NULL,
    "per_basis" TEXT NOT NULL,
    "rounding" TEXT NOT NULL DEFAULT 'Up',
    "minimum_units" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "menu_item_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The unique carries "per_basis" so that a second rule for the same style - one
-- rate for adults, another for children - is a row rather than a migration. With
-- one rule per style it behaves exactly like a unique on (item, style).
CREATE UNIQUE INDEX "menu_item_services_menu_item_id_service_style_per_basis_key" ON "menu_item_services"("menu_item_id", "service_style", "per_basis");
CREATE INDEX "menu_item_services_organization_id_service_style_idx" ON "menu_item_services"("organization_id", "service_style");

-- AddForeignKey
ALTER TABLE "menu_item_services" ADD CONSTRAINT "menu_item_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_item_services" ADD CONSTRAINT "menu_item_services_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Closed value sets as CHECK rather than a native enum. There is no enum
-- anywhere in this schema to be consistent with, and ALTER TYPE can add a value
-- but never remove one - a CHECK is a single DROP CONSTRAINT to revise.
ALTER TABLE "menu_item_services" ADD CONSTRAINT "menu_item_services_service_style_check" CHECK ("service_style" IN ('Buffet', 'Plated'));
ALTER TABLE "menu_item_services" ADD CONSTRAINT "menu_item_services_per_basis_check" CHECK ("per_basis" IN ('TotalGuests', 'Couples', 'Men', 'Ladies', 'Boys', 'Girls', 'Kids', 'Waiters', 'Tables', 'Event'));
ALTER TABLE "menu_item_services" ADD CONSTRAINT "menu_item_services_rounding_check" CHECK ("rounding" IN ('Up', 'Down', 'Nearest', 'Exact'));
ALTER TABLE "menu_item_services" ADD CONSTRAINT "menu_item_services_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "menu_item_services" ADD CONSTRAINT "menu_item_services_per_check" CHECK ("per" > 0);

-- AlterTable
-- `allergens` is deliberately nullable: that is what Prisma emits for a
-- `String[] @default([])` list column, and it reads a SQL NULL back as an empty
-- array. Adding NOT NULL here would read fine but leave the schema permanently
-- one step out of step with `prisma migrate diff`.
ALTER TABLE "menu_items" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'Food';
ALTER TABLE "menu_items" ADD COLUMN "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Move the service style out of usage_type and into its own row.
--
-- Gated on counting_rules being present, which is what disambiguates the one
-- value that is legal under both meanings of the column. A row that meant
-- segment-Both predates service styles and carries no rule; a row the service
-- style work wrote as Both always carries one, because toCountingRule() returns
-- null only for "Library". So this creates rows only where there is a real rule
-- to carry, and invents nothing.
INSERT INTO "menu_item_services" (
    "id",
    "organization_id",
    "menu_item_id",
    "service_style",
    "quantity",
    "unit",
    "per",
    "per_basis",
    "rounding",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    item."organization_id",
    item."id",
    style.value,
    (item."counting_rules"->>'quantity')::NUMERIC,
    item."counting_rules"->>'unit',
    (item."counting_rules"->>'per')::INTEGER,
    CASE WHEN item."counting_rules"->>'perUnit' = 'tables' THEN 'Tables' ELSE 'TotalGuests' END,
    -- Trays round up; a plate or a portion is one per head and must not.
    CASE
        WHEN item."counting_rules"->>'unit' IN ('plate', 'bowl', 'portion', 'piece', 'roll') THEN 'Exact'
        ELSE 'Up'
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "menu_items" AS item
CROSS JOIN LATERAL (
    SELECT unnest(
        CASE item."usage_type"
            WHEN 'Buffet' THEN ARRAY['Buffet']
            WHEN 'Plated' THEN ARRAY['Plated']
            WHEN 'Both' THEN ARRAY['Buffet', 'Plated']
            ELSE ARRAY[]::TEXT[]
        END
    ) AS value
) AS style
-- `jsonb_exists(...)` rather than the `?` operator: a bare `?` in SQL is read as
-- a parameter placeholder by several drivers, and this file should stay safe to
-- run through any of them.
WHERE item."counting_rules" IS NOT NULL
  AND jsonb_typeof(item."counting_rules") = 'object'
  AND jsonb_exists(item."counting_rules", 'quantity')
  AND jsonb_exists(item."counting_rules", 'per')
  AND jsonb_exists(item."counting_rules", 'unit')
  AND (item."counting_rules"->>'quantity') ~ '^[0-9]+(\.[0-9]+)?$'
  AND (item."counting_rules"->>'per') ~ '^[0-9]+$'
  AND (item."counting_rules"->>'quantity')::NUMERIC > 0
  AND (item."counting_rules"->>'per')::INTEGER > 0;

-- Drinks have been filed as a *category* until now - the create dialog offers
-- "Drink" alongside Appetizer, Soup and Main - which collides with category
-- meaning "course". Deriving the new column from that answer makes it true on
-- day one instead of leaving every drink marked as food.
UPDATE "menu_items" SET "kind" = 'Drink'
WHERE lower(coalesce("category", '')) IN ('drink', 'drinks', 'beverage', 'beverages');

-- usage_type goes back to the meaning the master spec gives it: which side of
-- the business an item belongs to.
--
-- Everything becomes 'Both' rather than 'Simcha' on purpose. No segment
-- filtering is implemented yet, so 'Both' cannot make an item vanish from a list
-- it appears in today. Narrowing an item to School or Simcha is a deliberate,
-- manual call once the filter exists.
UPDATE "menu_items" SET "usage_type" = 'Both';

-- kosher_type has been free text, so normalise the casing that reached it before
-- constraining. Anything still unrecognised is cleared rather than left to fail
-- the constraint: an unreadable kashrut marking is worse than none, and the
-- audit query in the plan surfaces these before this runs.
UPDATE "menu_items" SET "kosher_type" = 'Parve' WHERE lower("kosher_type") IN ('parve', 'pareve');
UPDATE "menu_items" SET "kosher_type" = 'Milchig' WHERE lower("kosher_type") IN ('milchig', 'milchik', 'dairy');
UPDATE "menu_items" SET "kosher_type" = 'Fleishig' WHERE lower("kosher_type") IN ('fleishig', 'fleishik', 'meat');
UPDATE "menu_items" SET "kosher_type" = NULL WHERE "kosher_type" IS NOT NULL AND "kosher_type" NOT IN ('Milchig', 'Fleishig', 'Parve');

ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_usage_type_check" CHECK ("usage_type" IN ('School', 'Simcha', 'Both'));
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_kind_check" CHECK ("kind" IN ('Food', 'Drink'));
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_kosher_type_check" CHECK ("kosher_type" IS NULL OR "kosher_type" IN ('Milchig', 'Fleishig', 'Parve'));

ALTER TABLE public.menu_item_services ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.menu_item_services FROM anon;

CREATE POLICY tenant_member_access ON public.menu_item_services
FOR ALL TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));
