ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

UPDATE public.organizations
SET subscription_status = 'active'
WHERE subscription_status IS NULL;

CREATE INDEX IF NOT EXISTS organizations_subscription_status_idx
  ON public.organizations (subscription_status);

CREATE INDEX IF NOT EXISTS organizations_trial_ends_at_idx
  ON public.organizations (trial_ends_at);
