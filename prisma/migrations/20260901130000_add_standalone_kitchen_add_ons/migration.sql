ALTER TABLE "kitchen_standalone_events"
ADD COLUMN "included_add_on_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
