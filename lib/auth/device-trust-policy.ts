/**
 * WHEN A DEVICE IS TRUSTED, AND WHAT THAT TRUST IS WORTH.
 *
 * Pure, and free of `server-only`, because three places have to agree on it
 * exactly: the server's refusal (lib/authz/authorize.ts), the session sync that
 * tells the browser what it owes (POST /api/auth/session), and the tests.
 *
 *   trusted - the owner confirmed this browser with the code emailed to their
 *             account, it has not been removed, and that confirmation is less
 *             than DEVICE_TRUST_DAYS old. The period is FIXED from the
 *             confirmation: using the device does not extend it. When it ends
 *             the browser is verified again exactly like a new one.
 *
 *   MFA remembered - a trusted device on which the authenticator code was
 *             entered during the current trust period. A sign-in there does
 *             not ask for the code again. It never applies where the
 *             organization REQUIRES two-factor authentication - that rule is
 *             in `mfaObligation` (lib/auth/mfa.ts), not here.
 *
 * Neither replaces the password. The email code confirms a device; it is never
 * a substitute for the authenticator.
 */

export const DEVICE_TRUST_DAYS = 30;
export const DEVICE_TRUST_TTL_MS = DEVICE_TRUST_DAYS * 24 * 60 * 60 * 1000;

type TrustRow = {
  confirmedAt: Date | null;
  revokedAt: Date | null;
  /** Null on a row confirmed before expiry existed; see `trustExpiry`. */
  trustExpiresAt?: Date | null;
};

export function deviceTrustExpiresAt(confirmedAt: Date) {
  return new Date(confirmedAt.getTime() + DEVICE_TRUST_TTL_MS);
}

/**
 * When this device's trust ends, or null when it was never confirmed.
 *
 * A confirmed row with no `trustExpiresAt` was confirmed by code that predates
 * expiry. It gets the standard period from its confirmation rather than being
 * trusted forever - the backfill in 20261008120000_device_trust_expiry gives
 * the rows that existed then a grace period instead.
 */
export function trustExpiry(row: TrustRow): Date | null {
  if (!row.confirmedAt) return null;

  return row.trustExpiresAt ?? deviceTrustExpiresAt(row.confirmedAt);
}

export function isDeviceTrusted(
  row: TrustRow | null | undefined,
  now: Date
): boolean {
  if (!row?.confirmedAt || row.revokedAt) return false;

  return (trustExpiry(row) as Date).getTime() > now.getTime();
}

/**
 * True when a sign-in on this device need not enter the authenticator code.
 *
 * `mfaVerifiedAt` must not predate the account's current authenticator: a
 * factor set up after this device last cleared one has never been entered
 * here, and replacing the authenticator has to be felt on every device.
 */
export function isMfaRememberedOnDevice(input: {
  device: (TrustRow & { mfaVerifiedAt?: Date | null }) | null | undefined;
  mfaEnrolledAt: Date | null;
  now: Date;
}): boolean {
  const { device, mfaEnrolledAt, now } = input;

  if (!device?.mfaVerifiedAt || !mfaEnrolledAt) return false;
  if (!isDeviceTrusted(device, now)) return false;

  return device.mfaVerifiedAt.getTime() >= mfaEnrolledAt.getTime();
}
