-- Where a person is signed in.
--
-- Supabase owns the sessions themselves and its admin API can revoke broadly,
-- but it cannot enumerate them - there is no list-sessions endpoint on the
-- admin surface. So the list a person sees is recorded here, keyed by the
-- `session_id` claim on their access token, which is what ties our row to the
-- session Supabase is actually holding.
--
-- NOT tenant-scoped, unlike almost everything else in this schema. A session
-- belongs to a person rather than to one of the organizations they work for:
-- somebody who works for two halls signs in once and has one session, and
-- looking at their own devices is not an act inside either tenant.
--
-- That is also why RLS here is deny-all rather than the usual organization
-- predicate. There is no correct `organization_id` to write a policy against,
-- and nothing reads this table from the browser - `GET /api/me/sessions`
-- returns the caller's own rows and nobody else's. Enabling RLS with no policy
-- is the honest shape for a table only the application may read.
CREATE TABLE "user_sessions" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      UUID NOT NULL,
  "session_id"   TEXT NOT NULL,
  "user_agent"   TEXT,
  "ip_address"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at"   TIMESTAMP(3),

  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- One Supabase session is one row. The sync upserts on this, so a refreshed
-- token updates the row it already has instead of adding a second.
CREATE UNIQUE INDEX "user_sessions_session_id_key"
  ON "user_sessions"("session_id");

-- The list's own query: this person's sessions, most recently seen first.
CREATE INDEX "user_sessions_user_id_last_seen_at_idx"
  ON "user_sessions"("user_id", "last_seen_at");

-- Cascade: a deleted user has no sessions to show, and these rows carry an IP
-- address. They go with the account rather than outliving it.
ALTER TABLE "user_sessions"
  ADD CONSTRAINT "user_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_sessions FROM anon, authenticated;
