-- Undo `kitchen-event-calendar-revoke.sql`: give the kitchen roles Events and
-- the booking Calendar back.
--
-- For a venue whose kitchen lead really does work off the booking calendar, or
-- who needs the full Events workspace for a reason the kitchen board does not
-- cover. It re-grants `event.read` and `calendar.read` to the two kitchen
-- starter roles and to nothing else.
--
-- BE DELIBERATE ABOUT WHICH ROLE. This restores BOTH keys to BOTH roles,
-- because that is what the migration removed and a rollback that reverses half
-- of something is worse than one that reverses none of it. If what you
-- actually want is "the kitchen manager may see the calendar, the cooks may
-- not", do it in the role editor instead - one role, one key, and an audit row
-- naming who decided it. This file cannot produce that record.
--
-- IDEMPOTENT, like the migration it reverses. The `role_permissions_bump_epoch`
-- trigger fires here too, so the grant takes effect on the next request rather
-- than at the next sign-in.
--
-- NOTE ON THE LANDING ROUTE. `resolveLandingRoute` picks the first route the
-- caller can actually open, so running this simply moves the kitchen roles'
-- landing page back to Events. Nothing else has to be undone in code.

BEGIN;

INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), r.id, p.id, now()
FROM roles r
JOIN permissions p ON p.key IN ('event.read', 'calendar.read')
WHERE r.is_system = true
  AND r.key IN ('kitchen-manager', 'kitchen-staff')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
