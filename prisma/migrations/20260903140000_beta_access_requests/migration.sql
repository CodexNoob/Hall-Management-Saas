-- Beta access requests: the queue between a Supabase identity and a tenant.
--
-- Self-serve sign-up provisioned an organization, an owner membership and a
-- free trial on first sign-in. While Event Core is in beta it records a request
-- instead, and `provisionOwner` refuses until that request says APPROVED.
--
-- FORWARD-ONLY. Nothing here drops, renames or rewrites an existing object; the
-- whole migration is one new table. Rolling the feature back is deleting the
-- application-side gate, and the table can be left in place as the record of
-- who was admitted and when.

CREATE TABLE IF NOT EXISTS "beta_access_requests" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    -- Lower-cased by the application before it is written.
    "email"            TEXT         NOT NULL,
    -- Null until an authenticated identity claims the request: the public form
    -- records one before Supabase has issued a session.
    "supabase_auth_id" TEXT,
    "status"           TEXT         NOT NULL DEFAULT 'PENDING',
    "signup_method"    TEXT,
    "requested_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at"      TIMESTAMP(3),
    "decided_at"       TIMESTAMP(3),
    "decided_by"       TEXT,
    "notes"            TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_access_requests_pkey" PRIMARY KEY ("id")
);

-- An earlier/partial deployment may already have created this table with only
-- some of its columns. CREATE TABLE IF NOT EXISTS does not fill in missing
-- columns, so make the migration safely converge that table to this schema
-- before creating indexes or constraints below.
ALTER TABLE "beta_access_requests"
    ADD COLUMN IF NOT EXISTS "supabase_auth_id" TEXT,
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS "signup_method" TEXT,
    ADD COLUMN IF NOT EXISTS "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "notified_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "decided_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "decided_by" TEXT,
    ADD COLUMN IF NOT EXISTS "notes" TEXT,
    ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- The two ways one applicant is recognised. Together they are the duplicate
-- handling: the address for somebody registering twice, and the identity for
-- the same person arriving by a second route (registering by password, then
-- signing in with Google on the same address).
CREATE UNIQUE INDEX IF NOT EXISTS "beta_access_requests_email_key"
    ON "beta_access_requests" ("email");

-- Partial, so the many rows that have not been claimed by an identity yet do
-- not collide with each other on NULL. (Postgres already treats NULLs as
-- distinct in a unique index; the WHERE clause also keeps the index small.)
CREATE UNIQUE INDEX IF NOT EXISTS "beta_access_requests_supabase_auth_id_key"
    ON "beta_access_requests" ("supabase_auth_id")
    WHERE "supabase_auth_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "beta_access_requests_status_requested_at_idx"
    ON "beta_access_requests" ("status", "requested_at");

-- The three states, enforced where it counts. A typo in a hand-written approval
-- UPDATE would otherwise leave a row that is neither approved nor pending - and
-- the gate reads anything that is not APPROVED as a refusal, so the failure
-- would be a silent lock-out rather than a visible error.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'beta_access_requests_status_check'
    ) THEN
        ALTER TABLE "beta_access_requests"
            ADD CONSTRAINT "beta_access_requests_status_check"
            CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED'));
    END IF;
END;
$$;

-- Same treatment as newsletter_subscribers and contact_support_requests: RLS
-- on, every grant revoked, and NO POLICY. Supabase grants the anon role access
-- to public tables by default and that key ships in the client bundle, so an
-- unprotected table here would publish the email address of everyone who has
-- ever asked for access. Only service_role and the owner can read it, which is
-- all the Prisma connection and the approval script need.
ALTER TABLE public.beta_access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.beta_access_requests FROM anon, authenticated;
