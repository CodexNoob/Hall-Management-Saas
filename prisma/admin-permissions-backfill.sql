-- SUPERSEDED - DO NOT RUN.
--
-- The first statement below sets a membership's role FROM `users.role`, which is
-- the cross-tenant privilege leak (C2) expressed as SQL: `users.role` is a single
-- global column that any organization could write through POST /api/staff, so
-- promoting memberships from it re-opens the hole this backfill predates.
--
-- Its npm script (`db:admin-permissions-backfill`) has been removed rather than
-- merely commented, because a comment does not stop `npm run` - and this runs
-- against the one Supabase database every branch shares.
--
-- Kept in the tree for provenance only. If an organization genuinely needs its
-- administrators repaired, do it from the staff screen, or write a one-off that
-- reads `organization_memberships` and never `users`.

BEGIN;

UPDATE public.organization_memberships AS membership
SET role = 'owner', updated_at = NOW()
FROM public.users AS app_user
WHERE membership.user_id = app_user.id
  AND membership.organization_id = app_user.organization_id
  AND REGEXP_REPLACE(LOWER(app_user.role), '[^a-z0-9]+', '', 'g') IN (
    'owner', 'admin', 'administrator', 'superadmin'
  );

INSERT INTO public.user_access (
  id,
  organization_id,
  user_id,
  can_view_home,
  can_view_calendar,
  can_create_booking,
  can_view_event_manager,
  can_view_kitchen_dashboard,
  can_view_menu,
  can_edit_menu,
  can_view_settings,
  can_edit_settings,
  can_assign_workers,
  can_update_kitchen_status,
  can_add_kitchen_events,
  can_manage_school_schedule,
  can_see_school_events,
  can_see_simcha_events,
  can_view_payment_info,
  can_manage_payments,
  can_send_payment_email,
  can_use_nice_home_background,
  allowed_hall_ids,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  membership.organization_id,
  membership.user_id,
  true, true, true, true, true, true, true, true, true, true, true, true,
  true, true, true, true, true, true, true,
  ARRAY[]::TEXT[],
  NOW(),
  NOW()
FROM public.organization_memberships AS membership
WHERE membership.is_active = true
  AND REGEXP_REPLACE(LOWER(membership.role), '[^a-z0-9]+', '', 'g') IN (
    'owner', 'admin', 'administrator', 'superadmin'
  )
ON CONFLICT (organization_id, user_id) DO UPDATE SET
  can_view_home = true,
  can_view_calendar = true,
  can_create_booking = true,
  can_view_event_manager = true,
  can_view_kitchen_dashboard = true,
  can_view_menu = true,
  can_edit_menu = true,
  can_view_settings = true,
  can_edit_settings = true,
  can_assign_workers = true,
  can_update_kitchen_status = true,
  can_add_kitchen_events = true,
  can_manage_school_schedule = true,
  can_see_school_events = true,
  can_see_simcha_events = true,
  can_view_payment_info = true,
  can_manage_payments = true,
  can_send_payment_email = true,
  can_use_nice_home_background = true,
  updated_at = NOW();

UPDATE public.user_access AS access
SET
  can_edit_staff = true,
  can_edit_vendors = true,
  can_edit_clients = true,
  can_edit_files = true,
  updated_at = NOW()
FROM public.organization_memberships AS membership
WHERE access.organization_id = membership.organization_id
  AND access.user_id = membership.user_id
  AND membership.is_active = true
  AND REGEXP_REPLACE(LOWER(membership.role), '[^a-z0-9]+', '', 'g') IN (
    'owner', 'admin', 'administrator', 'superadmin'
  );

COMMIT;
