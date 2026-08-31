-- Who is running this event, as a person rather than a label.
--
-- The event manager has shown "Unassigned" on every event since the panel was
-- built, because there was nothing behind it - the string was hard-coded in the
-- page. This is the column it was always standing in for.
--
-- A membership rather than a user: coordinating is something somebody does
-- inside one organization, and `organization_memberships` is already the row
-- that says this person belongs here. Pointing at `users` instead would let an
-- event name somebody who has no seat in the tenant that owns it.
--
-- Nullable with no default. An event genuinely may not have a coordinator yet,
-- and that is the state every row already in this table is in - so there is
-- nothing to backfill and nothing to guess. "Unassigned" stays the honest
-- reading of NULL rather than a sentinel row somebody has to maintain.
ALTER TABLE "events"
    ADD COLUMN IF NOT EXISTS "coordinator_membership_id" UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.events'::regclass
          AND conname = 'events_coordinator_membership_id_fkey'
    ) THEN
        -- ON DELETE SET NULL, not CASCADE. Taking somebody off the staff must
        -- never take their events with them - the hall still has the booking,
        -- it simply has nobody assigned to it again.
        ALTER TABLE "events"
            ADD CONSTRAINT "events_coordinator_membership_id_fkey"
            FOREIGN KEY ("coordinator_membership_id")
            REFERENCES "organization_memberships"("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE;
    END IF;
END
$$;

-- For "what is this coordinator running", which is the question this column
-- exists to make answerable, and for the constraint check above on delete.
CREATE INDEX IF NOT EXISTS "events_coordinator_membership_id_idx"
    ON "events" ("coordinator_membership_id");
