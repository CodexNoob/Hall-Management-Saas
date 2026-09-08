-- Undo `event-manager-staff-revoke.sql`: give Event Manager the directory back.
--
-- For a tenant whose Event Manager really is the person who keeps colleague
-- contact details current. It re-grants `staff.read` to the `event-manager`
-- starter role and to nothing else - the roles below it never held the key in
-- any shipped starter set, so restoring it there would be inventing a grant
-- rather than reversing one.
--
-- Prefer the role editor to this file where you can: ticking the key on there
-- writes an audit row naming who decided it, which is the record this migration
-- cannot produce.
--
-- IDEMPOTENT, like the migration it reverses. The epoch trigger fires here too,
-- so the grant takes effect on the next request rather than the next sign-in.

BEGIN;

INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), r.id, p.id, now()
FROM roles r
JOIN permissions p ON p.key = 'staff.read'
WHERE r.is_system = true
  AND r.key = 'event-manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
