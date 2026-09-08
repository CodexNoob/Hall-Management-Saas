-- Split `hall.manage` and `eventtype.manage` into their verbs.
--
--   hall.manage      -> hall.create, hall.update, hall.delete, hall.price.update
--   eventtype.manage -> eventtype.create, eventtype.update, eventtype.delete
--
-- and give Event Manager the middle of each lifecycle: `hall.update` and
-- `eventtype.update`, and neither end.
--
-- WHY THIS CANNOT BE LEFT TO THE SEED. `npm run db:seed-authorization` upserts
-- the catalog and then DELETES any permission row whose key left the catalog
-- (prisma/seed-authorization.ts). `role_permissions.permission_id` is
-- ON DELETE CASCADE, so running the seed against this deploy without this file
-- would drop every `hall.manage` grant on the floor - and `ensureStarterRoles`
-- is create-only for permissions, so nothing would grant the four replacements.
-- Owners would lose the ability to add a hall, silently, to a command whose job
-- is to converge roles. RUN THIS FIRST; the seed is then a no-op on these keys.
--
-- WHAT IT DOES, in order, all in one transaction:
--   1. Inserts the seven new catalog rows.
--   2. Copies every `hall.manage` grant onto all four hall keys, and every
--      `eventtype.manage` grant onto all three - so nobody who could manage a
--      hall yesterday can do less today, including tenant-authored roles.
--   3. Grants `hall.update` and `eventtype.update` to the `event-manager`
--      starter role, which is the new capability.
--   4. Deletes the two `manage` rows, which cascades the old grants away.
--
-- STEP 4 IS LAST AND THE ORDER IS LOAD-BEARING: step 2 selects the roles to
-- grant by the key they currently hold, and that key stops existing in step 4.
--
-- `sort_order` on the new rows is left at the tail rather than matched to the
-- catalog's file order. The seed rewrites label, description, group and sort
-- order for every key on its next run, which is the cheap way to converge
-- presentation - and presentation is all `sort_order` is.
--
-- STARTER ROLE ONLY, for step 3. Keyed on `roles.key` plus `is_system`: giving
-- a tenant's own role a key they never asked for is the same mistake in the
-- other direction. Steps 1, 2 and 4 apply to every role, because those preserve
-- what a role already had rather than deciding anything new.
--
-- IDEMPOTENT. Inserts are ON CONFLICT DO NOTHING and the deletes are of rows
-- that may already be gone. Running it twice changes nothing the second time;
-- running it after the seed has already removed the `manage` rows means step 2
-- finds nothing to copy, which is why it must not be run in that order.
--
-- REVERSIBLE. `venue-lifecycle-split-rollback.sql` restores the two keys.

BEGIN;

-- 1. The new catalog rows.
--
-- `updated_at` is spelled out because Prisma manages it in application code and
-- the column carries no database default - an INSERT that omits it fails.
INSERT INTO permissions (id, key, label, description, group_label, is_dangerous, sort_order, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'hall.create', 'Create halls', 'Add a hall to the venue.', 'Venue', false, 1000, now(), now()),
  (gen_random_uuid(), 'hall.update', 'Edit halls', 'Change a hall''s name, capacity, colour, and daily event limit.', 'Venue', false, 1001, now(), now()),
  (gen_random_uuid(), 'hall.price.update', 'Set hall pricing', 'Change what a hall costs, including member rates.', 'Venue', false, 1002, now(), now()),
  (gen_random_uuid(), 'hall.delete', 'Remove halls', 'Deactivate a hall or delete one that nothing references yet.', 'Venue', false, 1003, now(), now()),
  (gen_random_uuid(), 'eventtype.create', 'Create event types', 'Add an event type to the list bookings choose from.', 'Configuration', false, 1004, now(), now()),
  (gen_random_uuid(), 'eventtype.update', 'Edit event types', 'Rename an event type and change which days it is valid on.', 'Configuration', false, 1005, now(), now()),
  (gen_random_uuid(), 'eventtype.delete', 'Remove event types', 'Deactivate an event type or delete one no event has used yet.', 'Configuration', false, 1006, now(), now())
ON CONFLICT (key) DO NOTHING;

-- 2. Everyone who held the `manage` key holds all of its verbs.
--
-- Not keyed on `roles.key`: this preserves an existing grant rather than making
-- a new decision, so a tenant's own "Venue Manager" role must come through it
-- unchanged. Anything else would revoke by migration.
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), holder.role_id, replacement.id, now()
FROM (
  SELECT DISTINCT rp.role_id
  FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  WHERE p.key = 'hall.manage'
) AS holder
CROSS JOIN (
  SELECT id FROM permissions
  WHERE key IN ('hall.create', 'hall.update', 'hall.delete', 'hall.price.update')
) AS replacement
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), holder.role_id, replacement.id, now()
FROM (
  SELECT DISTINCT rp.role_id
  FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  WHERE p.key = 'eventtype.manage'
) AS holder
CROSS JOIN (
  SELECT id FROM permissions
  WHERE key IN ('eventtype.create', 'eventtype.update', 'eventtype.delete')
) AS replacement
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. The new capability: Event Manager edits, and only edits.
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), r.id, p.id, now()
FROM roles r
JOIN permissions p ON p.key IN ('hall.update', 'eventtype.update')
WHERE r.is_system = true
  AND r.key = 'event-manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. The old keys go, and their grants cascade with them.
DELETE FROM permissions WHERE key IN ('hall.manage', 'eventtype.manage');

COMMIT;

-- AFTERWARDS. Owner and Administrator hold every verb of both lifecycles, so
-- nothing they could do yesterday is gone. Event Manager can correct a hall's
-- name, capacity, colour and daily limit and rename an event type - and is
-- refused, by the route rather than by the sidebar, when the payload carries a
-- price field (`hall.price.update`) or `isActive`/`isBookable`, which is how a
-- hall is actually retired (`hall.delete`). Kitchen Manager, Kitchen Staff and
-- Viewer keep `hall.read` and gain nothing.
--
-- The epoch triggers on `role_permissions` fire throughout, so every affected
-- session is decided against the new set on its next request.
