BEGIN;

CREATE TABLE IF NOT EXISTS public.hall_map_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hall_id UUID NOT NULL REFERENCES public.halls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objects JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hall_map_presets_organization_hall_name_key
    UNIQUE (organization_id, hall_id, name)
);

CREATE INDEX IF NOT EXISTS hall_map_presets_organization_hall_updated_at_idx
  ON public.hall_map_presets (organization_id, hall_id, updated_at);

ALTER TABLE public.dining_plans
  ADD COLUMN IF NOT EXISTS hall_map_preset_id UUID
  REFERENCES public.hall_map_presets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dining_plans_hall_map_preset_id_idx
  ON public.dining_plans (hall_map_preset_id);

ALTER TABLE public.hall_map_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_member_access ON public.hall_map_presets;
CREATE POLICY tenant_member_access
ON public.hall_map_presets
FOR ALL
TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));

COMMIT;
