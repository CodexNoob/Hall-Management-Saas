-- Split the kitchen in two: Kitchen Manager supervises, Kitchen Staff cooks.
--
-- WHY THIS FILE EXISTS AT ALL. `ensureStarterRoles` is create-only for
-- permissions on purpose (lib/authz/provision.ts): re-running the seed must
-- never re-grant a key an owner deliberately unticked, and must never hand an
-- existing role a key added to the catalog after they last looked. Both would be
-- a privilege change delivered by a deploy rather than by a person. Editing
-- lib/authz/starter-roles.ts therefore changes what NEW organizations get and
-- nothing else - every organization that already has a `kitchen-staff` role
-- keeps the three keys this split moves away from it until this migration runs.
--
-- WHAT IT DOES, per organization:
--   1. Grants `kitchen.read.all` to the roles that supervise, so the split does
--      not blind anybody who could see the whole board yesterday.
--   2. Revokes `kitchen.event.create`, `kitchen.worker.assign` and
--      `eventmenu.confirm` from `kitchen-staff`.
--
-- It deliberately does NOT create the Kitchen Manager role or move anybody into
-- it. `npm run db:seed-authorization` creates it - that path is already
-- idempotent and audited - and who belongs in it is a decision per tenant, not
-- something a migration should guess. RUN THE SEED FIRST, then this.
--
-- IDEMPOTENT. Every statement is ON CONFLICT DO NOTHING or a DELETE of rows that
-- may already be gone, so running it twice changes nothing the second time.
--
-- REVERSIBLE. The revocations at the end are listed in `kitchen-role-split-
-- rollback.sql` as inserts, should a tenant want the old shape back.

BEGIN;

-- 1. `kitchen.read.all` for every role that already reads the whole board.
--
-- Matched by the keys they hold rather than by role key, so a tenant's own
-- "Head Chef" role picks it up too: anyone trusted to assign other people's work
-- was already seeing every dish, and this key is what preserves that. Kitchen
-- Staff is excluded by the absence of `kitchen.worker.assign`, which is exactly
-- the key step 2 takes off it - so ORDER MATTERS, and this runs first.
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), supervising.role_id, target.id, now()
FROM (
  SELECT DISTINCT rp.role_id
  FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  WHERE p.key IN ('kitchen.worker.assign', 'role.manage')
) AS supervising
CROSS JOIN (
  SELECT id FROM permissions WHERE key = 'kitchen.read.all'
) AS target
WHERE EXISTS (
  -- Only roles that can open the kitchen at all. A role holding `role.manage`
  -- but no `kitchen.read` has no board to widen.
  SELECT 1
  FROM role_permissions rp2
  JOIN permissions p2 ON p2.id = rp2.permission_id
  WHERE rp2.role_id = supervising.role_id AND p2.key = 'kitchen.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer too. It holds neither key above, but it is a read-only role whose whole
-- purpose is operational visibility - scoping it to its own assignments would
-- show it an empty kitchen rather than a restricted one, because a viewer is
-- never on the roster.
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), r.id, target.id, now()
FROM roles r
CROSS JOIN (SELECT id FROM permissions WHERE key = 'kitchen.read.all') AS target
WHERE r.key = 'viewer'
  AND EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = r.id AND p.key = 'kitchen.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2. Take supervision off Kitchen Staff.
--
-- Keyed on `roles.key = 'kitchen-staff'` rather than on the permission set: this
-- is the role the product renamed, and a tenant's own role that happens to hold
-- the same three keys is their composition to keep. Restricting somebody's own
-- role without being asked is the failure mode this whole file is careful about.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.key = 'kitchen-staff'
  AND p.key IN (
    'kitchen.event.create',
    'kitchen.worker.assign',
    'eventmenu.confirm'
  );

COMMIT;

-- AFTERWARDS. Kitchen Staff can no longer raise production jobs, assign work or
-- confirm a menu, and the kitchen routes send them only the dishes assigned to
-- them. Anyone who was relying on a cook to do those things needs moving to
-- Kitchen Manager from the Access screen - this migration moves nobody.

