-- One row per notification actually sent, so a replay cannot send it twice.
--
-- WHY A TABLE AND NOT A FLAG. `kitchen_notifications` already carries
-- `email_sent` / `email_sent_at`, and that works because a kitchen notification
-- IS the thing being emailed - one row, one email, one flag. Event
-- confirmations have no such row: a booking created, updated and cancelled is
-- three notifications against one `events` row, and a single flag on the event
-- could only ever record that something was sent once.
--
-- THE DEDUPE KEY IS THE POINT. `POST /api/events` accepts an
-- `Idempotency-Key` header, and a client that retries a timed-out request is
-- doing the right thing - the booking is created once, and the confirmation
-- email has to go out once with it. The unique index below is what enforces
-- that, rather than a check-then-write that two concurrent replays both pass.
--
-- PER ORGANIZATION, not global: two tenants can legitimately produce the same
-- key, and a global unique index would let one tenant's activity silently
-- suppress another's email.
--
-- NO PERSONAL DATA. There is deliberately no recipient list, no address and no
-- message body here - only a count. This table answers "was this sent, and to
-- how many people", which is what a support question needs; who exactly was
-- mailed is derivable from the preferences and the access rules at the time,
-- and storing it would put a list of addresses against every booking change.
CREATE TABLE "notification_deliveries" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID         NOT NULL,
  -- e.g. "event.created:<eventId>:<idempotency key>".
  "dedupe_key"      TEXT         NOT NULL,
  -- The NotificationKind. Text rather than an enum - a new kind should be a
  -- code change and not a migration, and nothing branches on this column.
  "kind"            TEXT         NOT NULL,
  -- How many people it went to. A number, never a list.
  "recipient_count" INTEGER      NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- The whole mechanism. A second attempt at the same notification violates this
-- and is treated as "already sent" rather than as an error.
CREATE UNIQUE INDEX "notification_deliveries_org_key"
  ON "notification_deliveries" ("organization_id", "dedupe_key");

-- For the cleanup a retention policy will eventually want, and for answering
-- "what did we send this venue last week".
CREATE INDEX "notification_deliveries_org_created"
  ON "notification_deliveries" ("organization_id", "created_at");

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant-scoped like every other operational table, and read by nobody in the
-- browser: this is bookkeeping for the server, so the policy exists as the
-- insurance described in prisma/supabase-rls.sql rather than because anything
-- selects from here with an anon key.
ALTER TABLE "notification_deliveries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "notification_deliveries" FROM anon;
REVOKE ALL ON TABLE "notification_deliveries" FROM authenticated;
