-- Take the Events workspace and the booking Calendar off the kitchen roles.
--
-- WHY THIS FILE EXISTS AT ALL. `ensureStarterRoles` is create-only for
-- permissions on purpose (lib/authz/provision.ts): re-running the seed must
-- never re-grant a key an owner deliberately unticked, and must never hand an
-- existing role a key added to the catalog after they last looked. Both would
-- be a privilege change delivered by a deploy rather than by a person. Editing
-- lib/authz/starter-roles.ts therefore changes what NEW organizations get and
-- nothing else - every organization that already has a `kitchen-manager` or
-- `kitchen-staff` role keeps `event.read` and `calendar.read` until this runs.
--
-- WHAT WAS WRONG. Both kitchen roles were seeded with `event.read` and
-- `calendar.read`. The sidebar is derived from route permissions
-- (lib/auth/dashboard-routes.ts), so it was reporting those grants correctly -
-- a Kitchen Manager arrived with Events and Calendar in their navigation, and
-- the navigation was not the bug. The grant was.
--
-- WHAT `event.read` ACTUALLY OPENS, which is why it is coming off:
--   * /dashboard/events - the entire booking workspace, for every event in the
--     organization, including the ones with no kitchen work on them at all.
--   * `GET /api/events`, the list behind it.
--   * The workspace's own tabs, which are the office's: the client, the
--     booking, the documents.
-- None of that is production. `calendar.read` is the booking calendar, which
-- answers a question a kitchen does not ask.
--
-- WHAT IT DOES NOT BREAK, and this is the whole reason the removal is safe.
-- Every piece of event context the kitchen board draws already arrives under
-- `kitchen.read`:
--   * `GET /api/kitchen` - event name, type, hall, status, service time,
--     package, guest counts, portions, menu status, day-of timeline and the
--     dish sheet itself.
--   * `GET /api/events/[eventId]/kitchen` - authorize(request, "kitchen.read"),
--     NOT event.read. This is the detail dialog.
-- Confirming a menu is `eventmenu.confirm`; staffing the board is
-- `kitchen.worker.assign`; raising a production job is `kitchen.event.create`;
-- advancing a dish is `kitchen.status.update`. Kitchen Manager keeps all four.
-- The kitchen's own Today / Week / 4 Weeks views are the production schedule
-- and are served by `/api/kitchen`, so nothing needed the booking calendar.
--
-- NOBODY IS STRANDED. `/dashboard/events` is the application's landing route
-- (MVP_LANDING_ROUTE), so revoking `event.read` alone would put every cook on
-- an "Access restricted" card at sign-in. `resolveLandingRoute` in
-- lib/auth/dashboard-routes.ts lands them on the Kitchen instead. That change
-- ships with this migration and is not optional.
--
-- THE SIDEBAR AND THE ROUTE FOLLOW ON THEIR OWN. Both are derived from
-- `dashboardRoutePermissions`, so the entries disappear with no UI change. The
-- refusal is real regardless: `GET /api/events` calls
-- `authorize(request, "event.read")` and `GET /api/calendar` calls
-- `authorize(request, "calendar.read")`, so a hand-rolled request answers 403.
--
-- CACHE INVALIDATION IS AUTOMATIC. The `role_permissions_bump_epoch` trigger
-- raises `organizations.permissions_epoch`, and that epoch is part of the
-- decision cache key (lib/authz/decide.ts), so every affected session is
-- decided against the new set on its next request. Nobody has to be signed out.
--
-- STARTER ROLES ONLY. Keyed on `roles.key` plus `is_system`, so a tenant's own
-- role that happens to hold either key is their composition to keep -
-- restricting somebody's own role without being asked is the failure mode this
-- kind of migration has to be careful about. A venue that genuinely wants its
-- kitchen lead on the booking calendar ticks the key back on in the role
-- editor, where the grant is made by a person and written to the audit trail.
--
-- EVENT MANAGER IS UNTOUCHED, deliberately and by name. It is not in the list
-- below, it keeps both keys, and it keeps `kitchen.read` / `kitchen.read.all`
-- so the office can still answer "is Friday's wedding ready".
--
-- IDEMPOTENT. A DELETE of rows that may already be gone; running it twice
-- changes nothing the second time.
--
-- REVERSIBLE. `kitchen-event-calendar-revoke-rollback.sql` puts both back.

BEGIN;

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.is_system = true
  AND r.key IN ('kitchen-manager', 'kitchen-staff')
  AND p.key IN ('event.read', 'calendar.read');

COMMIT;

-- AFTERWARDS. A Kitchen Manager sees Kitchen and Menu and no longer sees Events
-- or Calendar; a direct visit to either answers with the refusal card, and the
-- APIs behind them answer 403. They keep every kitchen verb they had: staffing
-- the board, raising production jobs, advancing statuses and confirming menus.
-- Kitchen Staff is unchanged apart from the same two removals - still the
-- dishes assigned to them, still nothing else.
--
-- Anyone who was relying on a kitchen lead to read the booking calendar needs
-- either the key granted back on a role of their own, or moving to Event
-- Manager from the Access screen. This migration moves nobody.
