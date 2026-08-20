-- Let a staff member be a kitchen worker.
--
-- Assigning a dish writes kitchen_item_statuses.assigned_worker_id, which
-- points at kitchen_workers - a table of free-text names with no connection to
-- anyone who can log in. So a person given the Kitchen Staff role could not be
-- assigned anything until somebody typed their name into Manage workers as
-- well, and the two lists then drifted.
--
-- Additive on purpose. The foreign key the assignment already uses is
-- untouched, so existing assignments and history keep working, and a worker
-- with no login - a casual hand hired for one night - is still a valid row
-- with user_id left null.

ALTER TABLE "kitchen_workers"
  ADD COLUMN IF NOT EXISTS "user_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kitchen_workers_user_id_fkey'
  ) THEN
    ALTER TABLE "kitchen_workers"
      ADD CONSTRAINT "kitchen_workers_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      -- Cascade rather than SET NULL: without the person there is no worker,
      -- and a row left behind would keep appearing in the assign list as an
      -- unassignable name.
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- One worker row per staff member per organization, so the sync below cannot
-- create duplicates if two requests race.
CREATE UNIQUE INDEX IF NOT EXISTS "kitchen_workers_organization_id_user_id_key"
  ON "kitchen_workers" ("organization_id", "user_id");

CREATE INDEX IF NOT EXISTS "kitchen_workers_user_id_idx"
  ON "kitchen_workers" ("user_id");
