BEGIN;

CREATE TABLE IF NOT EXISTS public.dining_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  count_type TEXT NOT NULL DEFAULT 'People',
  adult_count INTEGER NOT NULL DEFAULT 0,
  children_count INTEGER NOT NULL DEFAULT 0,
  men_waiters INTEGER NOT NULL DEFAULT 0,
  women_waiters INTEGER NOT NULL DEFAULT 0,
  tablecloth TEXT,
  washing_time TEXT,
  special_notes TEXT,
  tables JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dining_plans_organization_id_updated_at_idx
  ON public.dining_plans (organization_id, updated_at);

ALTER TABLE public.dining_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_member_access ON public.dining_plans;
CREATE POLICY tenant_member_access
ON public.dining_plans
FOR ALL
TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));

COMMIT;
