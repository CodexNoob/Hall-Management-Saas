-- Grant `activity.read` to the roles that already answer for the organization.
--
-- WHY THIS FILE EXISTS AT ALL. `ensureStarterRoles` is create-only for
-- permissions on purpose (lib/authz/provision.ts): re-running the seed must
-- never re-grant a key an owner deliberately unticked, and must never hand an
-- existing role a key added to the catalog after they last looked. Both would be
-- a privilege change delivered by a deploy rather than by a person.
--
-- So adding `activity.read` to lib/authz/catalog.ts changes what NEW
-- organizations get and nothing else. Without this file, every organization that
-- already exists ships a Settings -> Activity screen that nobody - not even the
-- Owner - can open.
--
-- RUN THE SEED FIRST. `npm run db:seed-authorization` upserts the catalog row;
-- this file grants it, and does nothing at all if the row is absent.
--
-- WHO GETS IT, and why only these two. The feed names who did what across every
-- module - it is a management view, not an operational one. Owner and
-- Administrator are the two starter roles whose whole description is running the
-- organization. Event Manager, Kitchen Manager, Kitchen Staff and Viewer are
-- deliberately left out; a tenant who wants their event manager to hold it can
-- tick the box, which is what the role editor is for.
--
-- KEYED ON `roles.key`, not on the permission set. These are the roles the
-- product seeded and named; a tenant's own role that happens to look like an
-- administrator is their composition, and quietly widening it is exactly the
-- failure mode prisma/admin-permissions-backfill.sql is a monument to.
--
-- IDEMPOTENT. ON CONFLICT DO NOTHING, so running it twice changes nothing the
-- second time.
--
-- REVERSIBLE. To undo:
--   DELETE FROM role_permissions rp USING permissions p
--   WHERE rp.permission_id = p.id AND p.key = 'activity.read';

BEGIN;

INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE p.key = 'activity.read'
  AND r.is_system = TRUE
  AND r.key IN ('owner', 'administrator')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
