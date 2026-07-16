BEGIN;

INSERT INTO public.user_access (
  id,
  organization_id,
  user_id,
  can_view_home,
  can_view_calendar,
  can_view_event_manager,
  can_view_kitchen_dashboard,
  can_view_menu,
  can_view_settings,
  can_see_school_events,
  can_see_simcha_events,
  can_view_payment_info,
  allowed_hall_ids,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  membership.organization_id,
  membership.user_id,
  true, true, true, true, true, true, true, true, true,
  ARRAY[]::TEXT[],
  NOW(),
  NOW()
FROM public.organization_memberships AS membership
WHERE membership.is_active = true
ON CONFLICT (organization_id, user_id) DO UPDATE SET
  can_view_home = true,
  can_view_calendar = true,
  can_view_event_manager = true,
  can_view_kitchen_dashboard = true,
  can_view_menu = true,
  can_view_settings = true,
  can_see_school_events = true,
  can_see_simcha_events = true,
  can_view_payment_info = true,
  updated_at = NOW();

COMMIT;
