BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Give the two development halls meaningful limits. Production halls remain
-- nullable until an administrator sets their real fire-code capacity.
UPDATE public.halls
SET capacity = CASE
  WHEN id = '11111111-1111-4111-8111-111111111111'::uuid THEN 400
  WHEN id = '22222222-2222-4222-8222-222222222222'::uuid THEN 250
  ELSE capacity
END
WHERE capacity IS NULL
  AND id IN (
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid
  );

UPDATE public.events
SET
  booking_status = CASE
    WHEN lower(event_status) = 'confirmed' THEN 'CONFIRMED'
    WHEN lower(event_status) IN ('hold', 'on hold') THEN 'TENTATIVE_HOLD'
    WHEN lower(event_status) = 'completed' THEN 'COMPLETED'
    WHEN lower(event_status) = 'cancelled' THEN 'CANCELLED'
    ELSE 'INQUIRY'
  END,
  starts_at = COALESCE(starts_at, event_date::timestamp + TIME '18:00'),
  ends_at = COALESCE(ends_at, event_date::timestamp + TIME '23:00'),
  setup_starts_at = COALESCE(setup_starts_at, event_date::timestamp + TIME '16:00'),
  cleanup_ends_at = COALESCE(cleanup_ends_at, event_date::timestamp + INTERVAL '1 day'),
  hold_expires_at = CASE
    WHEN lower(event_status) IN ('hold', 'on hold')
      THEN COALESCE(hold_expires_at, CURRENT_TIMESTAMP + INTERVAL '24 hours')
    ELSE NULL
  END
WHERE starts_at IS NULL
   OR ends_at IS NULL
   OR setup_starts_at IS NULL
   OR cleanup_ends_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_reservations_no_overlap'
  ) THEN
    ALTER TABLE public.booking_reservations
      ADD CONSTRAINT booking_reservations_no_overlap
      EXCLUDE USING gist (
        organization_id WITH =,
        hall_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (active = true);
  END IF;
END;
$$;

INSERT INTO public.booking_reservations (
  id, organization_id, event_id, hall_id, starts_at, ends_at, active, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  event.organization_id,
  event.id,
  occupied_hall.hall_id,
  event.setup_starts_at,
  event.cleanup_ends_at,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM public.events AS event
CROSS JOIN LATERAL (
  SELECT event.hall_id AS hall_id
  UNION
  SELECT connected_id::uuid
  FROM public.halls AS primary_hall,
       unnest(primary_hall.connected_hall_ids) AS connected_id
  WHERE primary_hall.id = event.hall_id
    AND primary_hall.organization_id = event.organization_id
    AND connected_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  UNION
  SELECT inverse_hall.id
  FROM public.halls AS inverse_hall
  WHERE inverse_hall.organization_id = event.organization_id
    AND event.hall_id::text = ANY(inverse_hall.connected_hall_ids)
) AS occupied_hall
INNER JOIN public.halls AS valid_hall
  ON valid_hall.id = occupied_hall.hall_id
 AND valid_hall.organization_id = event.organization_id
WHERE event.deleted = false
  AND event.booking_status IN ('TENTATIVE_HOLD', 'CONFIRMED')
  AND event.setup_starts_at IS NOT NULL
  AND event.cleanup_ends_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.booking_reservations AS existing_reservation
    WHERE existing_reservation.event_id = event.id
      AND existing_reservation.hall_id = occupied_hall.hall_id
  )
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.validate_booking_reservation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  booking_event public.events%ROWTYPE;
  booking_hall public.halls%ROWTYPE;
  attendee_count integer;
  blocked_label text;
BEGIN
  IF NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'Reservation end must be after its start' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO booking_event FROM public.events WHERE id = NEW.event_id;
  SELECT * INTO booking_hall FROM public.halls WHERE id = NEW.hall_id;
  IF booking_event.organization_id IS DISTINCT FROM NEW.organization_id
     OR booking_hall.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Reservation organization does not match its event and hall' USING ERRCODE = '23514';
  END IF;

  IF NEW.active THEN
    SELECT blocked.label INTO blocked_label
    FROM public.holiday_blocked_dates AS blocked
    WHERE blocked.organization_id = NEW.organization_id
      AND blocked.is_blocked = true
      AND booking_event.event_date BETWEEN blocked.start_date AND blocked.end_date
    LIMIT 1;
    IF blocked_label IS NOT NULL THEN
      RAISE EXCEPTION 'Booking date is blocked: %', blocked_label USING ERRCODE = '23514';
    END IF;

    attendee_count := booking_event.couples_count * 2
      + booking_event.men_count + booking_event.ladies_count
      + booking_event.boys_count + booking_event.girls_count + booking_event.kids_count;
    IF NEW.hall_id = booking_event.hall_id
       AND booking_hall.capacity IS NOT NULL
       AND attendee_count > booking_hall.capacity THEN
      RAISE EXCEPTION 'Booking exceeds hall capacity' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_booking_reservation_trigger ON public.booking_reservations;
CREATE TRIGGER validate_booking_reservation_trigger
BEFORE INSERT OR UPDATE ON public.booking_reservations
FOR EACH ROW EXECUTE FUNCTION public.validate_booking_reservation();

ALTER TABLE public.booking_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_member_access ON public.booking_reservations;
CREATE POLICY tenant_member_access
ON public.booking_reservations
FOR ALL TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));

COMMIT;
