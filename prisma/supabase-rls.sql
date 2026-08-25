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

-- ---------------------------------------------------------------------------
-- THE FIVE PRIVILEGE TABLES (P0-B).
--
-- These are FOR SELECT, never FOR ALL, and they are written out one by one
-- rather than driven through the loop below - both so the narrowing is visible
-- to a reader, and so tests/unit/rls-coverage.test.ts can see the table names
-- as literal ALTER TABLE statements.
--
-- Why they are singled out: a policy only filters access a grant already
-- permits, and `authenticated` currently holds no privilege on any table in
-- public, so none of this executes today. It is insurance against one future
-- event - somebody running a blanket GRANT across the schema. Postgres ACLs
-- have no DENY, so a REVOKE cannot prevent that; the POLICY is the only
-- statement here that survives it. Narrowing these five means such a grant
-- degrades to read exposure rather than "any member may rewrite any
-- colleague's privileges".
--
-- organizations and organization_settings are in the list for entitlement
-- reasons: subscription and trial fields on the first, and the `integrations`
-- JSON on the second, which holds roleAccessOverrides, two_factor_required and
-- session_timeout_minutes.
--
-- Mirrored by prisma/migrations/20260826091000_p0b_narrow_privilege_table_policies.
-- tests/unit/privilege-table-policies.test.ts fails the build if any of the five
-- ever reappears in a FOR ALL policy anywhere under prisma/.
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organizations FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.organizations FROM authenticated;
DROP POLICY IF EXISTS organization_member_access ON public.organizations;
CREATE POLICY organization_member_access
ON public.organizations
FOR SELECT
TO authenticated
USING (public.is_organization_member(id));

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organization_memberships FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.organization_memberships FROM authenticated;
DROP POLICY IF EXISTS tenant_member_access ON public.organization_memberships;
CREATE POLICY tenant_member_access
ON public.organization_memberships
FOR SELECT
TO authenticated
USING (public.is_organization_member(organization_id));

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.users FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM authenticated;
DROP POLICY IF EXISTS tenant_member_access ON public.users;
CREATE POLICY tenant_member_access
ON public.users
FOR SELECT
TO authenticated
USING (public.is_organization_member(organization_id));

ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_access FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_access FROM authenticated;
DROP POLICY IF EXISTS tenant_member_access ON public.user_access;
CREATE POLICY tenant_member_access
ON public.user_access
FOR SELECT
TO authenticated
USING (public.is_organization_member(organization_id));

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organization_settings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.organization_settings FROM authenticated;
DROP POLICY IF EXISTS tenant_member_access ON public.organization_settings;
CREATE POLICY tenant_member_access
ON public.organization_settings
FOR SELECT
TO authenticated
USING (public.is_organization_member(organization_id));

-- ---------------------------------------------------------------------------
-- Everything else stays FOR ALL. These are operational tables - a member who
-- can read them can already act on them through the application, so a narrower
-- policy would buy nothing while breaking the mental model that this loop
-- applies one uniform rule.
--
-- The five privilege tables above were deliberately REMOVED from this array.
-- Do not add them back. Do not add the authorization tables either
-- (roles, permissions, role_permissions, role_templates,
-- role_template_permissions, membership_roles, membership_permissions,
-- authorization_audit): membership_permissions in particular is a table whose
-- every row means "this member holds this permission", and this policy's
-- WITH CHECK asks only whether the writer is a member of the organization -
-- which they are. Any member could grant themselves anything in it.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tenant_table TEXT;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'halls',
    'event_types',
    'events',
    'booking_reservations',
    'menu_items',
    'menu_item_services',
    'event_menus',
    'event_menu_lines',
    'packages',
    'add_ons',
    'kitchen_workers',
    'kitchen_item_statuses',
    'kitchen_standalone_events',
    'kitchen_standalone_item_statuses',
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
    'notification_preferences',
    'clients',
    'today_notes',
    'dining_plans',
    'hall_map_presets',
    'hall_map_shape_library_items',
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

-- Same shape as newsletter_subscribers, and for the same reason: a public form
-- writes it through POST /api/support/contact using the privileged Prisma
-- connection, and nothing ever reads it from a browser. No policy is granted,
-- so only service_role and the owner can see it.
--
-- This one was missed. The table was added in migration
-- 20260807183000_add_contact_support_requests, six hours after
-- support_tickets - which carries its own RLS block - and it reached neither
-- the tenant array above nor a block of its own. It holds submitter names,
-- email addresses, company and free-text messages.
-- tests/unit/rls-coverage.test.ts now fails the build if a table is ever added
-- to the Prisma schema without landing somewhere in this file.
ALTER TABLE public.contact_support_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contact_support_requests FROM anon, authenticated;

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
