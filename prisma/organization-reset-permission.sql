-- Give existing Owners the key that unlocks the Settings > Reset panel.
--
-- WHY THIS FILE EXISTS AT ALL. `ensureStarterRoles` is create-only for
-- permissions on purpose (lib/authz/provision.ts): re-running the seed must
-- never hand an existing role a key added to the catalog after they last looked,
-- because that is a privilege change delivered by a deploy rather than by a
-- person. Adding `organization.reset` to lib/authz/starter-roles.ts therefore
-- changes what NEW organizations get and nothing else - every organization that
-- already has an `owner` role sees an empty Reset panel until this runs.
--
-- RUN THE SEED FIRST: `npm run db:seed-authorization` upserts the catalog, which
-- is what creates the `organization.reset` row this file grants. Without it the
-- INSERT below matches nothing and silently does nothing.
--
-- WHAT IT DOES. Grants `organization.reset` to the `owner` role of every
-- organization, and to nobody else. Not to Administrator: emptying the account
-- is the one act in the catalog with nothing to undo it, and the starter roles
-- withhold it there deliberately. A tenant that wants their administrator to
-- hold it can tick it in the role editor, which is what the editor is for.
--
-- KEYED ON `roles.key = 'owner'`, not on the permission set. A tenant's own
-- role that happens to hold a lot of keys is their composition, and handing it a
-- destructive one it was never given is exactly the failure mode this file is
-- careful about.
--
-- IDEMPOTENT. ON CONFLICT DO NOTHING, so running it twice changes nothing the
-- second time.
--
-- REVERSIBLE. `organization-reset-permission-rollback.sql` deletes the same
-- rows.

BEGIN;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'owner'
  AND p.key = 'organization.reset'
ON CONFLICT DO NOTHING;

COMMIT;
