-- Take the staff directory off Event Manager and every starter role below it.
--
-- WHY THIS FILE EXISTS AT ALL. `ensureStarterRoles` is create-only for
-- permissions on purpose (lib/authz/provision.ts): re-running the seed must
-- never re-grant a key an owner deliberately unticked, and must never hand an
-- existing role a key added to the catalog after they last looked. Both would
-- be a privilege change delivered by a deploy rather than by a person. Editing
-- lib/authz/starter-roles.ts therefore changes what NEW organizations get and
-- nothing else - every organization that already has an `event-manager` role
-- keeps `staff.read` until this migration runs.
--
-- WHAT `staff.read` ACTUALLY OPENS, which is why it is coming off:
--   * The People and Invitations tabs of /dashboard/staff - every colleague's
--     name, email, phone number and title, and who has not accepted yet.
--   * `GET /api/staff`, which is where that list comes from.
--   * `GET /api/support/tickets`, which widens from "the ones I raised" to
--     every ticket anyone in the organization has raised.
-- None of that is running an event. It is the roster and the correspondence of
-- people this role does not manage, and it stays with Owner and Administrator.
--
-- WHAT IT DOES NOT BREAK. Naming who runs an event still works. The booking
-- form's coordinator field is served by `/api/events` from
-- `organization_memberships`, deliberately NOT from `/api/staff`, precisely so
-- that editing an event never required the directory (see
-- `EventCoordinatorOption` in features/events/components/event-manager-shared.tsx).
--
-- THE SIDEBAR AND THE ROUTE FOLLOW ON THEIR OWN. `/dashboard/staff` is gated on
-- `staff.read` OR `role.read` (lib/auth/dashboard-routes.ts) and the sidebar
-- filters by the same check, so the entry disappears for these roles with no UI
-- change. The refusal is real regardless: `GET /api/staff` calls
-- `authorize(request, "staff.read")` and answers 403 to a hand-rolled request.
--
-- CACHE INVALIDATION IS AUTOMATIC. The `role_permissions_bump_epoch` trigger
-- raises `organizations.permissions_epoch`, and that epoch is part of the
-- decision cache key (lib/authz/decide.ts), so every affected session is
-- decided against the new set on its next request. Nobody has to be signed out.
--
-- STARTER ROLES ONLY. Keyed on `roles.key` plus `is_system`, so a tenant's own
-- role that happens to hold `staff.read` is their composition to keep -
-- restricting somebody's own role without being asked is the failure mode this
-- kind of migration has to be careful about. A tenant who genuinely wants their
-- Event Manager on the directory ticks the key back on in the role editor,
-- where the grant is made by a person and written to the audit trail.
--
-- IDEMPOTENT. A DELETE of rows that may already be gone; running it twice
-- changes nothing the second time.
--
-- REVERSIBLE. `event-manager-staff-revoke-rollback.sql` puts the key back.

BEGIN;

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.is_system = true
  -- Event Manager (rank 300) and below. Kitchen Manager, Kitchen Staff and
  -- Viewer are listed even though the starter set never granted them the key:
  -- an organization seeded by an older revision, or edited and edited back, is
  -- exactly the case a migration is for, and naming them states the rule
  -- instead of relying on today's data to be what it should be.
  AND r.key IN ('event-manager', 'kitchen-manager', 'kitchen-staff', 'viewer')
  AND p.key = 'staff.read';

COMMIT;

-- AFTERWARDS. Event Manager can no longer open the staff directory, sees only
-- the support tickets they raised, and loses the Staff sidebar entry entirely
-- (they hold no `role.read` either, so no tab of that page is reachable).
-- Anyone who was relying on an Event Manager to keep colleague contact details
-- up to date needs moving to Administrator from the Access screen, or granted
-- the key back on a role of their own - this migration moves nobody.
