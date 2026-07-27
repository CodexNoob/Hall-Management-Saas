BEGIN;

CREATE TABLE IF NOT EXISTS public.today_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  operating_date DATE NOT NULL,
  message TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'default',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS today_notes_organization_id_operating_date_created_at_idx
  ON public.today_notes (organization_id, operating_date, created_at);

ALTER TABLE public.today_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_member_access ON public.today_notes;
CREATE POLICY tenant_member_access
ON public.today_notes
FOR ALL
TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));

COMMIT;
