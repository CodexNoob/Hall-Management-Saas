BEGIN;

CREATE OR REPLACE FUNCTION public.is_organization_member(target_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships AS membership
    INNER JOIN public.users AS app_user ON app_user.id = membership.user_id
    INNER JOIN public.organizations AS organization ON organization.id = membership.organization_id
    WHERE membership.organization_id = target_organization_id
      AND membership.is_active = true
      AND organization.is_active = true
      AND app_user.is_active = true
      AND app_user.supabase_auth_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_organization_member_path(target_organization_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships AS membership
    INNER JOIN public.users AS app_user ON app_user.id = membership.user_id
    INNER JOIN public.organizations AS organization ON organization.id = membership.organization_id
    WHERE membership.organization_id::TEXT = target_organization_id
      AND membership.is_active = true
      AND organization.is_active = true
      AND app_user.is_active = true
      AND app_user.supabase_auth_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_organization_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_organization_member_path(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_organization_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_member_path(TEXT) TO authenticated;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_member_access ON public.organizations;
CREATE POLICY organization_member_access
ON public.organizations
FOR ALL
TO authenticated
USING (public.is_organization_member(id))
WITH CHECK (public.is_organization_member(id));

DO $$
DECLARE
  tenant_table TEXT;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'organization_memberships',
    'users',
    'user_access',
    'halls',
    'event_types',
    'events',
    'booking_reservations',
    'menu_items',
    'packages',
    'add_ons',
    'kitchen_workers',
    'kitchen_item_statuses',
    'kitchen_notifications',
    'school_cycles',
    'member_shuls',
    'payment_settings',
    'tablecloth_options',
    'menu_categories',
    'holiday_blocked_dates',
    'activity_logs',
    'generated_pdfs',
    'email_logs',
    'stored_files',
    'payment_transactions',
    'payment_refunds',
    'payment_receipts',
    'payment_provider_webhook_events',
    'bank_connections',
    'bank_transactions',
    'vendors',
    'invoices',
    'invoice_line_items',
    'invoice_discounts',
    'invoice_taxes',
    'invoice_payment_schedules',
    'invoice_balances',
    'file_folders',
    'organization_settings',
    'notification_preferences',
    'clients',
    'today_notes',
    'dining_plans',
    'hall_map_presets',
    'support_tickets',
    'support_ticket_messages'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tenant_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_access ON public.%I', tenant_table);
    EXECUTE format(
      'CREATE POLICY tenant_member_access ON public.%I FOR ALL TO authenticated USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id))',
      tenant_table
    );
  END LOOP;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.activity_logs FROM authenticated;
REVOKE ALL ON TABLE public.payment_provider_webhook_events FROM anon, authenticated;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.newsletter_subscribers FROM anon, authenticated;

ALTER TABLE public.api_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_rate_limit_buckets FROM anon, authenticated;

DROP POLICY IF EXISTS tenant_storage_select ON storage.objects;
CREATE POLICY tenant_storage_select
ON storage.objects
FOR SELECT
TO authenticated
USING (public.is_organization_member_path((storage.foldername(name))[1]));

DROP POLICY IF EXISTS tenant_storage_insert ON storage.objects;
CREATE POLICY tenant_storage_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (public.is_organization_member_path((storage.foldername(name))[1]));

DROP POLICY IF EXISTS tenant_storage_update ON storage.objects;
CREATE POLICY tenant_storage_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (public.is_organization_member_path((storage.foldername(name))[1]))
WITH CHECK (public.is_organization_member_path((storage.foldername(name))[1]));

DROP POLICY IF EXISTS tenant_storage_delete ON storage.objects;
CREATE POLICY tenant_storage_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (public.is_organization_member_path((storage.foldername(name))[1]));

COMMIT;
