BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

UPDATE public.invoices
SET subtotal_cents = total_cents,
    balance_due_cents = GREATEST(total_cents - amount_paid_cents, 0)
WHERE subtotal_cents = 0 OR balance_due_cents = 0;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS invoice_id UUID,
  ADD COLUMN IF NOT EXISTS payment_schedule_id UUID,
  ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'PAYMENT',
  ADD COLUMN IF NOT EXISTS refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL DEFAULT 1,
  unit_amount_cents INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT invoice_line_items_money_check CHECK (unit_amount_cents >= 0 AND subtotal_cents >= 0 AND discount_cents >= 0 AND tax_cents >= 0 AND total_cents >= 0),
  CONSTRAINT invoice_line_items_quantity_check CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS public.invoice_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'FIXED',
  value DECIMAL(12, 4) NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT invoice_discounts_value_check CHECK (value >= 0 AND amount_cents >= 0)
);

CREATE TABLE IF NOT EXISTS public.invoice_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_type TEXT NOT NULL DEFAULT 'PERCENTAGE',
  rate DECIMAL(9, 6),
  amount_cents INTEGER NOT NULL,
  jurisdiction TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT invoice_taxes_value_check CHECK ((rate IS NULL OR rate >= 0) AND amount_cents >= 0)
);

CREATE TABLE IF NOT EXISTS public.invoice_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL DEFAULT 'INSTALLMENT',
  label TEXT NOT NULL,
  due_date DATE NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  sort_order INTEGER NOT NULL DEFAULT 0,
  paid_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT invoice_payment_schedules_money_check CHECK (amount_cents > 0 AND paid_cents >= 0)
);

CREATE TABLE IF NOT EXISTS public.invoice_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL UNIQUE REFERENCES public.invoices(id) ON DELETE CASCADE,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  refunded_cents INTEGER NOT NULL DEFAULT 0,
  outstanding_cents INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT invoice_balances_money_check CHECK (subtotal_cents >= 0 AND discount_cents >= 0 AND tax_cents >= 0 AND total_cents >= 0 AND paid_cents >= 0 AND refunded_cents >= 0 AND outstanding_cents >= 0)
);

CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  payment_transaction_id UUID NOT NULL REFERENCES public.payment_transactions(id) ON DELETE RESTRICT,
  processed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'PENDING',
  provider TEXT,
  provider_reference TEXT,
  reason TEXT,
  metadata JSONB,
  processed_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payment_refunds_amount_check CHECK (amount_cents > 0)
);

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  payment_transaction_id UUID NOT NULL UNIQUE REFERENCES public.payment_transactions(id) ON DELETE RESTRICT,
  issued_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  receipt_number TEXT NOT NULL,
  issued_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  file_url TEXT,
  file_name TEXT,
  receipt_data JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payment_receipts_number_unique UNIQUE (organization_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS public.payment_provider_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  signature_digest TEXT,
  payload JSONB NOT NULL,
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  received_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP(3),
  error_message TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payment_webhook_event_unique UNIQUE (organization_id, provider, external_event_id),
  CONSTRAINT payment_webhook_attempts_check CHECK (processing_attempts >= 0)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_transactions_invoice_id_fkey') THEN
    ALTER TABLE public.payment_transactions ADD CONSTRAINT payment_transactions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_transactions_payment_schedule_id_fkey') THEN
    ALTER TABLE public.payment_transactions ADD CONSTRAINT payment_transactions_payment_schedule_id_fkey FOREIGN KEY (payment_schedule_id) REFERENCES public.invoice_payment_schedules(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_reference_unique ON public.payment_transactions (organization_id, provider, provider_reference);
CREATE INDEX IF NOT EXISTS payment_transactions_invoice_created_idx ON public.payment_transactions (organization_id, invoice_id, created_at);
CREATE INDEX IF NOT EXISTS payment_transactions_schedule_idx ON public.payment_transactions (organization_id, payment_schedule_id);
CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_sort_idx ON public.invoice_line_items (organization_id, invoice_id, sort_order);
CREATE INDEX IF NOT EXISTS invoice_discounts_invoice_idx ON public.invoice_discounts (organization_id, invoice_id);
CREATE INDEX IF NOT EXISTS invoice_taxes_invoice_idx ON public.invoice_taxes (organization_id, invoice_id);
CREATE INDEX IF NOT EXISTS invoice_payment_schedules_invoice_due_idx ON public.invoice_payment_schedules (organization_id, invoice_id, due_date);
CREATE INDEX IF NOT EXISTS invoice_payment_schedules_status_due_idx ON public.invoice_payment_schedules (organization_id, status, due_date);
CREATE INDEX IF NOT EXISTS invoice_balances_outstanding_idx ON public.invoice_balances (organization_id, outstanding_cents);
CREATE UNIQUE INDEX IF NOT EXISTS payment_refunds_provider_reference_unique ON public.payment_refunds (organization_id, provider, provider_reference);
CREATE INDEX IF NOT EXISTS payment_refunds_invoice_created_idx ON public.payment_refunds (organization_id, invoice_id, created_at);
CREATE INDEX IF NOT EXISTS payment_refunds_transaction_idx ON public.payment_refunds (organization_id, payment_transaction_id);
CREATE INDEX IF NOT EXISTS payment_refunds_status_idx ON public.payment_refunds (organization_id, status);
CREATE INDEX IF NOT EXISTS payment_receipts_invoice_issued_idx ON public.payment_receipts (organization_id, invoice_id, issued_at);
CREATE INDEX IF NOT EXISTS payment_webhook_status_received_idx ON public.payment_provider_webhook_events (organization_id, status, received_at);
CREATE INDEX IF NOT EXISTS payment_webhook_transaction_idx ON public.payment_provider_webhook_events (organization_id, payment_transaction_id);

INSERT INTO public.invoice_balances (organization_id, invoice_id, subtotal_cents, discount_cents, tax_cents, total_cents, paid_cents, refunded_cents, outstanding_cents)
SELECT organization_id, id, subtotal_cents, discount_cents, tax_cents, total_cents, amount_paid_cents, 0, balance_due_cents
FROM public.invoices
ON CONFLICT (invoice_id) DO UPDATE SET
  subtotal_cents = EXCLUDED.subtotal_cents,
  discount_cents = EXCLUDED.discount_cents,
  tax_cents = EXCLUDED.tax_cents,
  total_cents = EXCLUDED.total_cents,
  paid_cents = EXCLUDED.paid_cents,
  outstanding_cents = EXCLUDED.outstanding_cents,
  updated_at = CURRENT_TIMESTAMP;

DO $$
DECLARE tenant_table TEXT;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['invoice_line_items', 'invoice_discounts', 'invoice_taxes', 'invoice_payment_schedules', 'invoice_balances', 'payment_refunds', 'payment_receipts', 'payment_provider_webhook_events']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_access ON public.%I', tenant_table);
    EXECUTE format('CREATE POLICY tenant_member_access ON public.%I FOR ALL TO authenticated USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id))', tenant_table);
  END LOOP;
END;
$$;

COMMIT;
