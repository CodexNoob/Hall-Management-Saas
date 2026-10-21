-- Trusted devices: noticing a sign-in from somewhere new, and asking the
-- account owner to confirm it from their own inbox.
--
-- KNOWN vs TRUSTED. A device row exists once a browser has been seen for this
-- person (known). `trusted_at` is set only when they enter the code emailed on
-- first sight (trusted). Neither is read by authorization: a trusted device
-- still needs the password and, where it applies, the second factor. This is a
-- signal and a confirmation step, never a way past a control.
--
-- The browser holds a random secret in an httpOnly cookie. Only an HMAC of it
-- is stored here, so a copy of this table cannot be replayed as a device.
--
-- Requires 20260926130000_add_mfa_enrollment_protection (email_security_codes).

CREATE TABLE "user_devices" (
  "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"              UUID NOT NULL,
  "device_hash"          TEXT NOT NULL,
  "first_seen_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trusted_at"           TIMESTAMP(3),
  "revoked_at"           TIMESTAMP(3),
  "confirmation_sent_at" TIMESTAMP(3),
  "user_agent"           TEXT,
  "ip_address"           TEXT,
  "city"                 TEXT,
  "region"               TEXT,
  "country"              TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- One row per person per browser. The same browser for two people is two rows:
-- trust is per user.
CREATE UNIQUE INDEX "user_devices_user_id_device_hash_key"
  ON "user_devices"("user_id", "device_hash");

-- My Account's list: this person's devices, most recently seen first.
CREATE INDEX "user_devices_user_id_last_seen_at_idx"
  ON "user_devices"("user_id", "last_seen_at");

ALTER TABLE "user_devices"
  ADD CONSTRAINT "user_devices_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- A DEVICE_TRUST code names the device it confirms, so a code sent for one
-- browser can never confirm another.
ALTER TABLE "email_security_codes" ADD COLUMN "device_id" UUID;

CREATE INDEX "email_security_codes_device_id_idx"
  ON "email_security_codes"("device_id");

ALTER TABLE "email_security_codes"
  ADD CONSTRAINT "email_security_codes_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "user_devices"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Application-only, like user_sessions: deny-all RLS, no browser grants.
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_devices FROM anon, authenticated;
