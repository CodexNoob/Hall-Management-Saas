-- P0-B: narrow the five privilege tables from FOR ALL to FOR SELECT.
--
-- This was meant to ride along with the P1 migration and missed its carrier, so
-- it gets its own file. It ships alongside P1B so the ACCESS EXCLUSIVE locks on
-- the privilege tables are taken once, in one `db:deploy`, rather than twice.
--
-- WHAT THIS IS AND IS NOT
-- -----------------------
-- It is NOT urgent, and it is NOT closing a live hole. Measured 2026-08-24 and
-- unchanged since: `authenticated` holds no SELECT/INSERT/UPDATE/DELETE on any
-- table in public, and pg_default_acl has no row for the schema, so new tables
-- are born ungranted too. A policy only filters access a grant already permits -
-- so every policy in prisma/supabase-rls.sql has never executed, and neither
-- will these. Prisma connects as the table owner and no table is FORCE-enabled,
-- which bypasses RLS regardless.
--
-- It is insurance against exactly one future event: somebody runs
-- `GRANT ... TO authenticated` across the schema. Postgres ACLs have no DENY, so
-- a REVOKE cannot prevent that - a later GRANT simply re-adds what it removed.
-- The POLICY is the only statement here that survives such a grant, and
-- narrowing it means the blast radius degrades to read exposure instead of
-- "any member may rewrite any colleague's privileges".
--
-- FIVE TABLES, NOT THREE
-- ----------------------
-- Beyond the obvious organization_memberships / users / user_access:
--   * organizations        - subscription and trial fields drive entitlement.
--   * organization_settings - its `integrations` JSON holds roleAccessOverrides,
--                             two_factor_required and session_timeout_minutes.
--
-- prisma/supabase-rls.sql is edited in the same commit. That file unconditionally
-- re-creates these policies as FOR ALL, so without the edit the next
-- `npm run db:rls` would silently revert this whole migration.
-- tests/unit/privilege-table-policies.test.ts is the control.

-- DROP POLICY and CREATE POLICY take ACCESS EXCLUSIVE, and a Prisma migration
-- runs in one transaction - so this holds the lock on all five tables at once,
-- on the database every branch's dev server uses. Fail fast instead of queueing.
SET lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- organizations keys on `id` rather than `organization_id`, and carries its own
-- policy name, so it is narrowed separately from the four below.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS organization_member_access ON public.organizations;
CREATE POLICY organization_member_access
ON public.organizations
FOR SELECT
TO authenticated
USING (public.is_organization_member(id));

-- ---------------------------------------------------------------------------
-- The four tenant-keyed privilege tables.
--
-- Same policy name the db:rls loop uses, so the two files converge on one
-- object rather than leaving a stale duplicate behind.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  privilege_table TEXT;
BEGIN
  FOREACH privilege_table IN ARRAY ARRAY[
    'organization_memberships',
    'users',
    'user_access',
    'organization_settings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_access ON public.%I', privilege_table);
    EXECUTE format(
      'CREATE POLICY tenant_member_access ON public.%I FOR SELECT TO authenticated USING (public.is_organization_member(organization_id))',
      privilege_table
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- The REVOKEs document intent. They are a no-op today (nothing is granted) and
-- a no-op after a future blanket GRANT (which would simply re-add them). Kept
-- because the next person to read this file should see the intended grant state
-- stated somewhere, and because a CI guard asserting it is cheap - see the
-- follow-up item in the P6 alternatives.
-- ---------------------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE ON TABLE public.organizations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.organization_memberships FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_access FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.organization_settings FROM anon, authenticated;
