-- Undo `venue-lifecycle-split.sql`: put `hall.manage` and `eventtype.manage`
-- back, and take the seven verb keys away.
--
-- For a deploy that wants the single-key shape again - one grant covering the
-- whole lifecycle of a hall or an event type, with no role holding the middle
-- of one.
--
-- SAME ORDERING RULE AS THE MIGRATION, in the other direction: the `manage`
-- rows are restored and re-granted BEFORE the verb keys are deleted, because
-- the grant selects roles by the verb keys they hold and deleting those first
-- would cascade the evidence away and restore `manage` to nobody.
--
-- WHO GETS `manage` BACK. Any role holding the whole lifecycle - all four hall
-- verbs, or all three event-type verbs. A role holding only `hall.update`
-- (which is what Event Manager gets from the migration) is NOT given
-- `hall.manage`: that would hand it create, delete and pricing, which is the
-- opposite of what the split was for. Such a role comes out of this rollback
-- holding nothing on halls beyond `hall.read`, which is where it started.
--
-- The code must go back with it. lib/authz/catalog.ts is the source of truth
-- for which keys exist, and running the seed with the verb keys still in the
-- catalog would re-create every row this file removes.
--
-- IDEMPOTENT.

BEGIN;

-- 1. The two keys return to the catalog.
INSERT INTO permissions (id, key, label, description, group_label, is_dangerous, sort_order, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'hall.manage', 'Manage halls', 'Create, edit, and retire halls and their pricing.', 'Venue', false, 1100, now(), now()),
  (gen_random_uuid(), 'eventtype.manage', 'Manage event types', 'Create, edit, and retire event types.', 'Configuration', false, 1101, now(), now())
ON CONFLICT (key) DO NOTHING;

-- 2. Re-granted to whoever holds the COMPLETE lifecycle, and to nobody else.
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), whole.role_id, target.id, now()
FROM (
  SELECT rp.role_id
  FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  WHERE p.key IN ('hall.create', 'hall.update', 'hall.delete', 'hall.price.update')
  GROUP BY rp.role_id
  HAVING COUNT(DISTINCT p.key) = 4
) AS whole
CROSS JOIN (SELECT id FROM permissions WHERE key = 'hall.manage') AS target
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), whole.role_id, target.id, now()
FROM (
  SELECT rp.role_id
  FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  WHERE p.key IN ('eventtype.create', 'eventtype.update', 'eventtype.delete')
  GROUP BY rp.role_id
  HAVING COUNT(DISTINCT p.key) = 3
) AS whole
CROSS JOIN (SELECT id FROM permissions WHERE key = 'eventtype.manage') AS target
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. The verb keys go, and their grants cascade with them.
DELETE FROM permissions
WHERE key IN (
  'hall.create', 'hall.update', 'hall.delete', 'hall.price.update',
  'eventtype.create', 'eventtype.update', 'eventtype.delete'
);

COMMIT;
