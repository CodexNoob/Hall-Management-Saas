CREATE TABLE "kitchen_standalone_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "menu_id" UUID NOT NULL,
  "menu_name" TEXT NOT NULL,
  "event_date" DATE NOT NULL,
  "portions" INTEGER NOT NULL,
  "kitchen_note" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "kitchen_standalone_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kitchen_standalone_events_portions_check" CHECK ("portions" >= 1)
);

ALTER TABLE "kitchen_standalone_events"
  ADD CONSTRAINT "kitchen_standalone_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kitchen_standalone_events"
  ADD CONSTRAINT "kitchen_standalone_events_menu_id_fkey"
  FOREIGN KEY ("menu_id") REFERENCES "packages"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_standalone_events"
  ADD CONSTRAINT "kitchen_standalone_events_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "kitchen_standalone_events_organization_id_event_date_idx"
  ON "kitchen_standalone_events"("organization_id", "event_date");

CREATE INDEX "kitchen_standalone_events_organization_id_menu_id_idx"
  ON "kitchen_standalone_events"("organization_id", "menu_id");

CREATE TABLE "kitchen_standalone_item_statuses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "kitchen_standalone_event_id" UUID NOT NULL,
  "menu_item_id" UUID NOT NULL,
  "status" TEXT,
  "assigned_worker_id" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "kitchen_standalone_item_statuses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "kitchen_standalone_item_statuses"
  ADD CONSTRAINT "kitchen_standalone_item_statuses_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kitchen_standalone_item_statuses"
  ADD CONSTRAINT "kitchen_standalone_item_statuses_kitchen_standalone_event_id_fkey"
  FOREIGN KEY ("kitchen_standalone_event_id") REFERENCES "kitchen_standalone_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kitchen_standalone_item_statuses"
  ADD CONSTRAINT "kitchen_standalone_item_statuses_menu_item_id_fkey"
  FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kitchen_standalone_item_statuses"
  ADD CONSTRAINT "kitchen_standalone_item_statuses_assigned_worker_id_fkey"
  FOREIGN KEY ("assigned_worker_id") REFERENCES "kitchen_workers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kitchen_standalone_item_statuses"
  ADD CONSTRAINT "kitchen_standalone_item_statuses_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "kitchen_standalone_item_statuses_kitchen_standalone_event_id_menu_item_id_key"
  ON "kitchen_standalone_item_statuses"("kitchen_standalone_event_id", "menu_item_id");

CREATE INDEX "kitchen_standalone_item_statuses_organization_id_status_idx"
  ON "kitchen_standalone_item_statuses"("organization_id", "status");

CREATE INDEX "kitchen_standalone_item_statuses_assigned_worker_id_idx"
  ON "kitchen_standalone_item_statuses"("assigned_worker_id");
