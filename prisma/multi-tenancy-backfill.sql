BEGIN;

INSERT INTO "organizations" ("id", "name", "slug", "is_active", "created_at", "updated_at")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Legacy Organization',
  'legacy-organization',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "users" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "user_access" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "halls" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "event_types" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "events" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "menu_items" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "packages" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "add_ons" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "kitchen_workers" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "kitchen_item_statuses" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "kitchen_notifications" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "school_cycles" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "member_shuls" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "payment_settings" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "tablecloth_options" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "menu_categories" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "holiday_blocked_dates" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "activity_logs" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "generated_pdfs" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "email_logs" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;

INSERT INTO "organization_memberships" (
  "id",
  "organization_id",
  "user_id",
  "role",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  "id",
  CASE WHEN "role" = 'admin' THEN 'owner' ELSE 'member' END,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users"
ON CONFLICT ("organization_id", "user_id") DO NOTHING;

COMMIT;
