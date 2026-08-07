CREATE TABLE "api_rate_limit_buckets" (
    "id" TEXT NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 1,
    "window_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_rate_limit_buckets_expires_at_idx"
ON "api_rate_limit_buckets"("expires_at");

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

REVOKE ALL ON FUNCTION public.is_organization_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_organization_member(UUID) TO authenticated;

ALTER TABLE public.api_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_rate_limit_buckets FROM anon, authenticated;

DO $$
DECLARE
  tenant_table TEXT;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'bank_connections',
    'bank_transactions',
    'hall_map_presets'
  ]
  LOOP
    IF to_regclass(format('public.%I', tenant_table)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tenant_table);
      EXECUTE format('DROP POLICY IF EXISTS tenant_member_access ON public.%I', tenant_table);
      EXECUTE format(
        'CREATE POLICY tenant_member_access ON public.%I FOR ALL TO authenticated USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id))',
        tenant_table
      );
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tenant_table);
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.newsletter_subscribers FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.prevent_activity_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'activity logs are append-only';
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.activity_logs') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS activity_logs_append_only ON public.activity_logs';
    EXECUTE 'CREATE TRIGGER activity_logs_append_only BEFORE UPDATE OR DELETE ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_activity_log_mutation()';
    EXECUTE 'REVOKE ALL ON TABLE public.activity_logs FROM anon';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public.activity_logs FROM authenticated';
  END IF;
  IF to_regclass('public.payment_provider_webhook_events') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.payment_provider_webhook_events FROM anon, authenticated';
  END IF;
END;
$$;
