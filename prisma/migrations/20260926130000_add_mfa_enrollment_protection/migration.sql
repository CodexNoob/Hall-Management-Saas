-- Protected first-time 2FA enrollment.
--
-- THE HOLE THIS CLOSES. Setting up an authenticator is a conversation between
-- the browser and Supabase, and Supabase will enroll a TOTP factor for any
-- session that holds the password. Our server trusted any `aal2` session. So a
-- stolen password on an account without 2FA was enough to attach the thief's
-- own authenticator - satisfying an organization's "2FA required" policy with
-- the attacker's phone, and locking the real owner out of their own account.
--
-- Two tables fix it:
--   email_security_codes  - a code emailed to the account's own address, and
--                           the short-lived enrollment grant it turns into.
--   mfa_trusted_factors   - the factors this application counts. A factor only
--                           gets here through a grant, so knowing the password
--                           is no longer enough; the thief also needs the inbox.
--
-- RUN THIS IMMEDIATELY BEFORE DEPLOYING THE CODE THAT READS IT. The backfill
-- below trusts every verified factor that exists when it runs. A factor
-- created by the OLD flow after this runs and before the new code is live would
-- be treated as untrusted and removed (its owner is emailed and can set it up
-- again) - harmless, but avoidable by keeping the gap short.

CREATE TABLE "email_security_codes" (
  "id"               UUID NOT NULL,
  "user_id"          UUID NOT NULL,
  "organization_id"  UUID NOT NULL,
  -- 'MFA_ENROLLMENT' today. Text, like every kind column in this schema.
  "purpose"          TEXT NOT NULL,
  "session_id"       TEXT NOT NULL,
  -- HMAC of the code, never the code itself.
  "code_hash"        TEXT NOT NULL,
  "attempts"         INTEGER NOT NULL DEFAULT 0,
  "expires_at"       TIMESTAMP(3) NOT NULL,
  "verified_at"      TIMESTAMP(3),
  "grant_expires_at" TIMESTAMP(3),
  "consumed_at"      TIMESTAMP(3),
  "ip_address"       TEXT,
  "user_agent"       TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_security_codes_pkey" PRIMARY KEY ("id")
);

-- "The live code for this person and purpose", and the hourly send count.
CREATE INDEX "email_security_codes_user_id_purpose_created_at_idx"
  ON "email_security_codes"("user_id", "purpose", "created_at");

-- The rows belong to the account and carry an IP address; they go with it.
ALTER TABLE "email_security_codes"
  ADD CONSTRAINT "email_security_codes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "mfa_trusted_factors" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL,
  -- auth.mfa_factors.id
  "factor_id"  UUID NOT NULL,
  -- 'email_verified' | 'legacy_backfill'
  "source"     TEXT NOT NULL,
  "trusted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mfa_trusted_factors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_trusted_factors_factor_id_key"
  ON "mfa_trusted_factors"("factor_id");

CREATE INDEX "mfa_trusted_factors_user_id_idx"
  ON "mfa_trusted_factors"("user_id");

ALTER TABLE "mfa_trusted_factors"
  ADD CONSTRAINT "mfa_trusted_factors_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Only the application reads or writes these. Deny-all RLS and no grants to the
-- browser roles, exactly as `user_sessions`: a code hash readable through the
-- public REST API would be an offline guessing target.
ALTER TABLE public.email_security_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_security_codes FROM anon, authenticated;
ALTER TABLE public.mfa_trusted_factors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mfa_trusted_factors FROM anon, authenticated;

-- BACKFILL: everyone who already uses 2FA stays trusted.
--
-- Every verified TOTP factor that exists right now was set up by the flow this
-- migration replaces, before anybody could have exploited the gap on this
-- deployment's behalf. Not trusting them would delete the authenticators of
-- every current 2FA user on their next page load.
--
-- Guarded and dynamic, so the migration still applies to a database with no
-- Supabase `auth` schema (a local shadow database). There, there are no factors
-- to carry over anyway.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = 'auth'
       AND table_name = 'mfa_factors'
  ) THEN
    EXECUTE $backfill$
      INSERT INTO public.mfa_trusted_factors (user_id, factor_id, source, trusted_at)
      SELECT u.id, f.id, 'legacy_backfill', COALESCE(f.updated_at, f.created_at, NOW())
        FROM auth.mfa_factors f
        JOIN public.users u ON u.supabase_auth_id = f.user_id
       WHERE f.status::text = 'verified'
         AND f.factor_type::text = 'totp'
      ON CONFLICT (factor_id) DO NOTHING
    $backfill$;
  END IF;
END
$$;
