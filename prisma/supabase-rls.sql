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
-- THE FOUR IDENTITY TABLES (P0-B).
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
-- statement here that survives it. Narrowing these four means such a grant
-- degrades to read exposure rather than "any member may rewrite any
-- colleague's identity".
--
-- organizations and organization_settings are in the list for entitlement
-- reasons: subscription and trial fields on the first, and the `integrations`
-- JSON on the second, which holds two_factor_required and
-- session_timeout_minutes.
--
-- WAS FIVE. `user_access` was the fifth and is gone - the RBAC migration
-- replaced its 23 boolean columns with `principal_roles` /
-- `principal_permissions`, which are handled far more strictly below: RLS on,
-- everything revoked, and NO POLICY AT ALL. A privilege table gets no policy,
-- not a narrow one.
--
-- Mirrored by prisma/migrations/20260826091000_p0b_narrow_privilege_table_policies.
-- tests/unit/privilege-table-policies.test.ts fails the build if any of these
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
-- The four identity tables above were deliberately REMOVED from this array.
-- Do not add them back.
--
-- DO NOT ADD THE AUTHORIZATION TABLES EITHER, in any form - not FOR ALL, and not
-- the narrowed FOR SELECT the four above carry:
--
--   principals, service_accounts, roles, permissions, role_permissions,
--   principal_roles, principal_permissions, authorization_audit
--
-- All but two of them have an organization_id column, so they pass the
-- mechanical "does it have a tenant column?" test that this array otherwise
-- encodes. The column is there for the composite foreign keys, NOT to opt in.
--
-- principal_permissions is the one to read the policy against. Its every row
-- means "this principal holds this permission", and the WITH CHECK asks only
-- whether the writer belongs to the organization - which they do. Any member
-- could INSERT a row granting themselves anything. FOR SELECT is not sufficient
-- either: it exposes every colleague's grant map, which is the input to a
-- targeted attack rather than a leak of operational data.
--
-- They are handled in the RBAC migration instead: RLS enabled, all privileges
-- revoked from anon and authenticated, and no policy at all.
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

-- The beta queue. Written by a public form and by provisioning through the
-- privileged Prisma connection, read only by the approval script. It holds the
-- email address of everybody who has ever asked for access, so it gets the same
-- no-policy treatment as the two tables above rather than a narrow one.
--
-- Applied by prisma/migrations/20260903140000_beta_access_requests as well.
-- Both, deliberately: the migration protects the table from the moment it
-- exists, and this file stays the one place describing the whole RLS surface.
ALTER TABLE public.beta_access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.beta_access_requests FROM anon, authenticated;

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
