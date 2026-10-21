-- Trusted devices expire, and a trusted device can remember the authenticator.
--
-- ADDITIVE ONLY. Two nullable columns and a backfill; nothing is dropped and no
-- device, session or MFA factor is removed or revoked.
--
--   trust_expires_at - when this browser's trust ends. Fixed from the email
--                      confirmation (30 days, lib/auth/device-trust-policy.ts);
--                      using the device does not extend it. After it, the
--                      browser is verified again like a new one.
--   mfa_verified_at  - when the authenticator code was last entered on this
--                      device during its current trust period. A sign-in on a
--                      trusted device with this set skips the code - never in
--                      an organization that requires two-factor authentication.
--
-- The device gate reads `confirmed_at` + `trust_expires_at`, not `trusted_at`.
-- `trusted_at` keeps its existing meaning: the primary device that "sign out on
-- untrusted devices" preserves.
--
-- Requires 20260926160000_add_trusted_devices and
-- 20260926170000_primary_trusted_device.

ALTER TABLE "user_devices"
  ADD COLUMN "trust_expires_at" TIMESTAMP(3),
  ADD COLUMN "mfa_verified_at" TIMESTAMP(3);

-- BACKFILL: nobody loses a device they already confirmed.
--
-- Every device confirmed when this runs keeps its trust for a full period from
-- NOW rather than from its original confirmation, so the deploy itself does not
-- send anybody back to the email code. `mfa_verified_at` stays NULL: an
-- authenticator user is asked for their code exactly as often as before until
-- they enter it once on that device, after which it is remembered.
UPDATE "user_devices"
   SET "trust_expires_at" = NOW() + INTERVAL '30 days'
 WHERE "confirmed_at" IS NOT NULL
   AND "revoked_at" IS NULL
   AND "trust_expires_at" IS NULL;
