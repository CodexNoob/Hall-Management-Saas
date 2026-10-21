-- Publish `organizations`, so a permission change reaches the browser holding
-- the stale one.
--
-- THE PROBLEM. An invited user could sign in before anybody had given them a
-- role, see an empty sidebar, and stay seeing an empty sidebar after an
-- administrator assigned them one - because nothing told their browser that
-- anything had changed. The only remedy was signing out and back in.
--
-- WHY THIS TABLE AND NOT THE OBVIOUS ONES. The three tables that actually
-- record authorization - `principal_roles`, `principal_permissions` and
-- `role_permissions` - have RLS enabled with NO POLICY AT ALL. That is
-- deliberate and documented in prisma/supabase-rls.sql: "a privilege table gets
-- no policy, not a narrow one". Realtime enforces RLS, so publishing one would
-- deliver nothing to anybody, and giving it a policy to make publication work
-- would be inventing read access to the privilege tables in order to refresh a
-- sidebar. That trade is not worth making and this migration does not make it.
--
-- `organizations` needs none of that. It already carries
-- `permissions_epoch`, and all three privilege tables already bump it through
-- the triggers in 20260827090000_rbac_roles_as_rows:
--
--   principal_roles_bump_epoch        -> role assigned, removed, department moved
--   principal_permissions_bump_epoch  -> a direct grant or deny on one person
--   role_permissions_bump_epoch       -> a role's own permission set edited
--
-- So one published table covers every way authorization can change, and the
-- mechanism is the epoch this application already had rather than a second one
-- built beside it.
--
-- WHAT THIS EXPOSES: NOTHING NEW. `organizations` is already member-readable
-- under the `organization_member_access` policy in supabase-rls.sql, and
-- Realtime applies that policy to every subscriber - so a member receives their
-- own organization's row and no other tenant's. Every column on it (name, slug,
-- subscription plan and status, trial dates, onboarding timestamp,
-- permissions_epoch) is ALREADY sent to the browser by POST /api/auth/session
-- in `organizations: SessionOrganization[]`. The subscriber learns nothing it
-- was not already holding.
--
-- THE PAYLOAD IS NOT TRUSTED. The client treats the event purely as "go and
-- ask again" and refetches POST /api/auth/session, which recomputes the
-- permission set server-side from `principal_roles`, `principal_permissions`
-- and `role_permissions`. Nothing about what anybody may do is read off the
-- wire. See lib/realtime/table-subscriptions.ts.
--
-- REPLICA IDENTITY STAYS DEFAULT, as it does for every other published table:
-- the client needs the table name, never the old column values, and FULL would
-- put every column of every write on the wire.
--
-- Written as a DO block so re-running is harmless - a table already in the
-- publication is skipped rather than raising `is already member of
-- publication`.

-- Kept in the same ARRAY form the first publication migration used, and not
-- because one entry needs a loop: tests/unit/realtime-sync.test.ts reads the
-- published set out of these files by matching quoted names on their own line,
-- and asserts it equals what the client subscribes to. A single
-- `ALTER PUBLICATION ... ADD TABLE` would be invisible to that check, and the
-- test that exists to stop the two drifting apart would start failing for a
-- formatting reason instead of a real one.
DO $$
DECLARE
  target text;
  tables text[] := ARRAY[
    'organizations'
  ];
BEGIN
  FOREACH target IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1
        FROM pg_catalog.pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = target
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE pg_catalog.format(
      'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
      target
    );
  END LOOP;
END;
$$;
