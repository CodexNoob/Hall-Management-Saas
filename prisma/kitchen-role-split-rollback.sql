-- Undo `kitchen-role-split.sql`: give Kitchen Staff supervision back.
--
-- For a tenant who wants the old single-kitchen-role shape - one role that both
-- cooks and runs the board. It re-grants the three keys the split took off
-- `kitchen-staff`, and grants `kitchen.read.all` so cooks see the whole board
-- again rather than only their own dishes.
--
-- It does NOT delete the Kitchen Manager role. That role may already hold
-- assignments, and deleting a role out from under the people in it is a decision
-- for the Access screen, where it is audited. An unused role costs nothing.
--
-- IDEMPOTENT, like the migration it reverses.

BEGIN;

INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), r.id, p.id, now()
FROM roles r
JOIN permissions p
  ON p.key IN (
    'kitchen.event.create',
    'kitchen.worker.assign',
    'eventmenu.confirm',
    -- Not one of the three the split removed - this key did not exist before it.
    -- Without it a restored Kitchen Staff would keep cooking blind, which is the
    -- half of the split that lives in the routes rather than in the role.
    'kitchen.read.all'
  )
WHERE r.key = 'kitchen-staff'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
