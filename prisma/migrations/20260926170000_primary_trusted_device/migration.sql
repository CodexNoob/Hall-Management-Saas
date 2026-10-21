-- Keep email confirmation separate from the one device protected by
-- "sign out everywhere". Preserve every former trusted device's confirmation,
-- while assigning primary status to each person's earliest recorded device.
ALTER TABLE "user_devices"
  ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "confirmed_at" TIMESTAMP(3);

UPDATE "user_devices"
   SET "confirmed_at" = "trusted_at"
 WHERE "trusted_at" IS NOT NULL;

WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "user_id"
           ORDER BY "first_seen_at", "created_at", "id"
         ) AS position
    FROM "user_devices"
)
UPDATE "user_devices" AS device
   SET "is_primary" = TRUE
  FROM ranked
 WHERE device."id" = ranked."id"
   AND ranked.position = 1;

UPDATE "user_devices"
   SET "trusted_at" = NULL
 WHERE "trusted_at" IS NOT NULL
   AND "is_primary" = FALSE;

CREATE UNIQUE INDEX "user_devices_one_primary_per_user_idx"
  ON "user_devices"("user_id")
  WHERE "is_primary" = TRUE;

-- Concurrent first sightings are serialized in the database. The first row
-- for a user becomes primary; later rows remain ordinary confirmed devices.
CREATE FUNCTION public.set_first_user_device_primary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."user_id"::text, 0));

  IF NOT EXISTS (
    SELECT 1
      FROM public."user_devices"
     WHERE "user_id" = NEW."user_id"
       AND "is_primary" = TRUE
  ) THEN
    NEW."is_primary" := TRUE;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "user_devices_assign_primary_before_insert"
BEFORE INSERT ON public."user_devices"
FOR EACH ROW
EXECUTE FUNCTION public.set_first_user_device_primary();

ALTER TABLE "user_sessions"
  ADD COLUMN "device_id" UUID;

CREATE INDEX "user_sessions_device_id_idx"
  ON "user_sessions"("device_id");

ALTER TABLE "user_sessions"
  ADD CONSTRAINT "user_sessions_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "user_devices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
