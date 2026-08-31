-- Which hall a blocked range closes.
--
-- A blocked range used to close the date for the whole organization. That is
-- the wrong shape for a venue with more than one hall: a wedding hall taken out
-- of service for a week says nothing about the room next door, and blocking the
-- date everywhere was the only way to say it.
--
-- Nullable, and deliberately so, even though the API now requires a hall on
-- every range it creates. Rows written before this column existed closed the
-- whole venue, and there is no honest hall to assign them to - reading NULL as
-- "every hall" keeps them meaning exactly what they meant when they were saved.
-- Making the column NOT NULL would mean deleting somebody's saved closures to
-- satisfy a constraint, which is not a trade this migration is willing to make.
ALTER TABLE "holiday_blocked_dates"
    ADD COLUMN IF NOT EXISTS "hall_id" UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.holiday_blocked_dates'::regclass
          AND conname = 'holiday_blocked_dates_hall_id_fkey'
    ) THEN
        -- ON DELETE CASCADE, unlike the coordinator column's SET NULL. A range
        -- exists to close one hall; with the hall gone there is nothing left for
        -- it to close, and a surviving row would silently become a venue-wide
        -- block under the NULL reading above.
        ALTER TABLE "holiday_blocked_dates"
            ADD CONSTRAINT "holiday_blocked_dates_hall_id_fkey"
            FOREIGN KEY ("hall_id")
            REFERENCES "halls"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
    END IF;
END
$$;

-- The question every reader asks: is this hall closed on this date. The
-- organization-wide index stays for the month grid, which still greys a day
-- when any hall is blocked on it.
CREATE INDEX IF NOT EXISTS "holiday_blocked_dates_org_hall_range_idx"
    ON "holiday_blocked_dates" ("organization_id", "hall_id", "start_date", "end_date");
