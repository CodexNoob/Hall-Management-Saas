BEGIN;

INSERT INTO public.clients (id, organization_id, name, email, phone, status, tags, created_at, updated_at)
SELECT gen_random_uuid(), source.organization_id, source.client_name, source.email, source.phone, 'Active', ARRAY[]::TEXT[], NOW(), NOW()
FROM (
  SELECT
    organization_id,
    client_name,
    MAX(NULLIF(email, '')) AS email,
    MAX(NULLIF(phone, '')) AS phone
  FROM public.events
  WHERE deleted = false AND BTRIM(client_name) <> ''
  GROUP BY organization_id, client_name
) AS source
WHERE NOT EXISTS (
  SELECT 1
  FROM public.clients AS existing
  WHERE existing.organization_id = source.organization_id
    AND LOWER(existing.name) = LOWER(source.client_name)
);

UPDATE public.events AS event
SET client_id = client.id
FROM public.clients AS client
WHERE event.client_id IS NULL
  AND client.organization_id = event.organization_id
  AND LOWER(client.name) = LOWER(event.client_name);

UPDATE public.invoices AS invoice
SET client_id = event.client_id
FROM public.events AS event
WHERE invoice.client_id IS NULL
  AND invoice.event_id = event.id
  AND invoice.organization_id = event.organization_id;

UPDATE public.invoices AS invoice
SET client_id = client.id
FROM public.clients AS client
WHERE invoice.client_id IS NULL
  AND client.organization_id = invoice.organization_id
  AND LOWER(client.name) = LOWER(invoice.client_name);

UPDATE public.payment_transactions AS payment
SET client_id = event.client_id
FROM public.events AS event
WHERE payment.client_id IS NULL
  AND payment.event_id = event.id
  AND payment.organization_id = event.organization_id;

UPDATE public.stored_files AS file
SET client_id = event.client_id
FROM public.events AS event
WHERE file.client_id IS NULL
  AND file.event_id = event.id
  AND file.organization_id = event.organization_id;

UPDATE public.activity_logs AS log
SET client_id = event.client_id
FROM public.events AS event
WHERE log.client_id IS NULL
  AND log.event_id = event.id
  AND log.organization_id = event.organization_id;

COMMIT;
