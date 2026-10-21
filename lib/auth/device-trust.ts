import "server-only";

import type { Prisma } from "@prisma/client";

import {
  generateDeviceSecret,
  hashDeviceSecret
} from "@/lib/auth/device-identity";
import {
  DEVICE_TRUST_DAYS,
  deviceTrustExpiresAt,
  isDeviceTrusted,
  trustExpiry
} from "@/lib/auth/device-trust-policy";
import {
  issueSecurityCode,
  verifySecurityCode,
  withdrawSecurityCode,
  type IssueResult,
  type VerifyResult
} from "@/lib/auth/security-codes";
import {
  deviceConfirmationEmail,
  deviceRemovalCodeEmail,
  sendSecurityEmail
} from "@/lib/auth/security-emails";
import { describeUserAgent } from "@/lib/auth/session-record";
import { log } from "@/lib/logging/context";

/**
 * KNOWN, CONFIRMED AND TRUSTED DEVICES.
 *
 *   known     - this browser has been seen for this person (a row exists).
 *   confirmed - they confirmed it with the code emailed to their account.
 *   trusted   - confirmed, not removed, and inside the fixed trust period
 *               (lib/auth/device-trust-policy.ts). This is what the device
 *               gate reads. An expired device is verified again like a new one.
 *   primary   - the first device seen; what "sign out on untrusted devices"
 *               preserves (`trustedAt`). Unrelated to the gate.
 *
 * Trust never replaces the password, and never replaces the second factor
 * where the organization requires one. It is unrelated to a trusted MFA
 * factor (lib/auth/mfa-trust.ts).
 *
 * ONE EMAIL PER NEW DEVICE, not one per page load. The session sync runs every
 * minute; only the sighting that CREATES (or revives a removed) device row
 * sends mail. Resending is an explicit request from the person.
 */

type DeviceClient = {
  userDevice: Prisma.UserDeviceDelegate;
  emailSecurityCode: Prisma.EmailSecurityCodeDelegate;
};

export type DeviceState = {
  /** Our row id - safe to show; never the hash or the secret. */
  id: string;
  /** This browser had been seen for this person before this request. */
  known: boolean;
  primary: boolean;
  /** Confirmed at some point and not removed - possibly since expired. */
  confirmed: boolean;
  /** Confirmed and inside the trust period: what the device gate reads. */
  trusted: boolean;
  trustExpiresAt: Date | null;
  /** Untrusted, and a confirmation code was emailed for THIS sign-in. */
  pendingConfirmation: boolean;
};

type Sighting = {
  userId: string;
  organizationId: string;
  /** The `session_id` claim; the code is bound to it. Null: no email is sent. */
  sessionId: string | null;
  /** From the cookie, already format-checked. Null: a new identity is minted. */
  secret: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  owner: { email: string; name: string };
  /**
   * May a confirmation email be sent now? False while the session still owes
   * its second factor: the order is password, then 2FA, then this device - so
   * somebody who has only the password does not get as far as the email.
   */
  notify: boolean;
  now?: Date;
};

function place(row: {
  city: string | null;
  region: string | null;
  country: string | null;
}) {
  return [row.city, row.region, row.country].filter(Boolean).join(", ") || null;
}

/** Everything a removal or a fresh confirmation resets. */
const TRUST_RESET = {
  trustedAt: null,
  confirmedAt: null,
  trustExpiresAt: null,
  mfaVerifiedAt: null
} as const;

/**
 * Record that this browser was seen for this person, and email a confirmation
 * the first time.
 *
 * Returns `newSecret` only when a fresh identity had to be minted - the caller
 * plants it in the cookie and nowhere else.
 */
export async function registerDeviceSighting(
  client: DeviceClient,
  input: Sighting
): Promise<{ device: DeviceState; newSecret: string | null }> {
  const now = input.now ?? new Date();
  const newSecret = input.secret ? null : generateDeviceSecret();
  const deviceHash = hashDeviceSecret(input.secret ?? (newSecret as string));
  const seen = {
    lastSeenAt: now,
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
    // Keep a location an earlier request resolved, as the session list does.
    ...(input.city ? { city: input.city } : {}),
    ...(input.region ? { region: input.region } : {}),
    ...(input.country ? { country: input.country } : {})
  };

  const existing = await client.userDevice.findUnique({
    // Scoped by user: the same browser is a different device for each person.
    where: { userId_deviceHash: { userId: input.userId, deviceHash } }
  });

  let row;
  let isNew = false;

  if (!existing) {
    row = await client.userDevice.create({
      data: {
        userId: input.userId,
        deviceHash,
        firstSeenAt: now,
        city: input.city,
        region: input.region,
        country: input.country,
        ...seen
      }
    });
    isNew = true;
  } else if (existing.revokedAt) {
    // Removed from My Account and back again: new, untrusted, confirmed again.
    row = await client.userDevice.update({
      where: { id: existing.id },
      data: {
        ...seen,
        ...TRUST_RESET,
        revokedAt: null,
        confirmationSentAt: null
      }
    });
    isNew = true;
  } else {
    row = await client.userDevice.update({
      where: { id: existing.id },
      data: seen
    });
  }

  if (isNew) {
    // userId only: the hash and the secret never reach a log line.
    log.info(
      { userId: input.userId, revived: Boolean(existing) },
      "device_first_seen"
    );
  }

  const confirmed = Boolean(row.confirmedAt) && !row.revokedAt;
  const trusted = isDeviceTrusted(row, now);
  let pendingConfirmation = false;

  /**
   * ONE EMAIL PER SIGN-IN, not one per page load. The sync runs every minute
   * while the gate is up; it emails only when no code has gone out for THIS
   * session yet. A new sign-in on the same unconfirmed browser is a new
   * session, so it gets a fresh code without anybody pressing "resend" - and
   * the per-device cooldown and hourly cap still bound it.
   */
  try {
    // Untrusted covers expired: a device past its trust period is confirmed
    // again exactly like a new one.
    if (!trusted && input.sessionId) {
      // Unspent codes only: a code already used (the device was confirmed and
      // later removed) says nothing about whether THIS confirmation was sent.
      const latest = await client.emailSecurityCode.findFirst({
        where: {
          userId: input.userId,
          purpose: "DEVICE_TRUST",
          deviceId: row.id,
          consumedAt: null
        },
        orderBy: { createdAt: "desc" },
        select: { sessionId: true }
      });

      pendingConfirmation = latest?.sessionId === input.sessionId;

      if (!pendingConfirmation && input.notify) {
        if (confirmed) {
          // Once per sign-in, not per page load: only here, where a code is
          // about to be sent for this session.
          log.info({ userId: input.userId }, "device_trust_expired");
        }

        const sent = await sendDeviceConfirmation(client, {
          userId: input.userId,
          organizationId: input.organizationId,
          sessionId: input.sessionId,
          device: row,
          owner: input.owner,
          now
        });

        pendingConfirmation = sent.status === "sent";
      }
    }
  } catch (confirmationError) {
    // Keep the newly minted device identity so a code-send failure cannot
    // strand the primary row without the cookie needed to confirm it. The
    // gate remains active and the browser can explicitly retry sending.
    log.warn(
      { userId: input.userId, err: String(confirmationError) },
      "device_confirmation_failed"
    );
  }

  return {
    device: {
      id: row.id,
      known: !isNew,
      primary: row.isPrimary,
      confirmed,
      trusted,
      trustExpiresAt: confirmed ? trustExpiry(row) : null,
      pendingConfirmation
    },
    newSecret
  };
}

/**
 * Issue a DEVICE_TRUST code for this device and email it. Used on first sight
 * and for "resend". The per-device cooldown and the per-person hourly cap from
 * lib/auth/security-codes.ts apply.
 */
export async function sendDeviceConfirmation(
  client: DeviceClient,
  input: {
    userId: string;
    organizationId: string;
    sessionId: string;
    device: {
      id: string;
      userAgent: string | null;
      city: string | null;
      region: string | null;
      country: string | null;
    };
    owner: { email: string; name: string };
    now?: Date;
  }
): Promise<
  | { status: "sent"; resendAvailableAt: Date }
  | {
      status: "throttled";
      reason: IssueResult["status"];
      resendAvailableAt: Date;
    }
  | { status: "undelivered" }
> {
  const now = input.now ?? new Date();

  const issued = await issueSecurityCode(client, {
    userId: input.userId,
    organizationId: input.organizationId,
    purpose: "DEVICE_TRUST",
    sessionId: input.sessionId,
    deviceId: input.device.id,
    ipAddress: null,
    userAgent: input.device.userAgent,
    now
  });

  if (issued.status !== "issued") {
    log.info(
      { userId: input.userId, reason: issued.status },
      "device_confirmation_throttled"
    );

    return {
      status: "throttled",
      reason: issued.status,
      resendAvailableAt: issued.resendAvailableAt
    };
  }

  const outcome = await sendSecurityEmail(
    "device_confirmation",
    input.owner.email,
    deviceConfirmationEmail({
      name: input.owner.name,
      code: issued.code,
      device:
        describeUserAgent(input.device.userAgent) ?? input.device.userAgent,
      place: place(input.device),
      when: now
    })
  );

  if (outcome !== "sent") {
    // The code stays unusable in practice (nobody has it) and expires in ten
    // minutes; the device simply stays unconfirmed. Resend can try again.
    return { status: "undelivered" };
  }

  await client.userDevice.update({
    where: { id: input.device.id },
    data: { confirmationSentAt: now }
  });

  return { status: "sent", resendAvailableAt: issued.resendAvailableAt };
}

/**
 * The device row for THIS browser, for this person - or null when the cookie
 * is missing, malformed, unknown, or the device was removed.
 */
export async function findCurrentDevice(
  client: Pick<DeviceClient, "userDevice">,
  userId: string,
  secret: string | null
) {
  if (!secret) return null;

  const row = await client.userDevice.findUnique({
    where: {
      userId_deviceHash: { userId, deviceHash: hashDeviceSecret(secret) }
    }
  });

  return row && !row.revokedAt ? row : null;
}

/**
 * Confirm THIS browser with the emailed code: it is trusted for the fixed
 * period from now. Wrong: the attempt limit applies.
 *
 * `mfaVerified` - this session cleared the authenticator (`aal2`). Only then
 * does the device remember it; a confirmation made without the factor resets
 * any memory of an earlier one, so a new trust period never inherits it.
 */
export async function confirmDevice(
  client: DeviceClient,
  input: {
    userId: string;
    deviceId: string;
    sessionId: string;
    code: string;
    mfaVerified?: boolean;
    now?: Date;
  }
): Promise<VerifyResult> {
  const now = input.now ?? new Date();
  const device = await client.userDevice.findFirst({
    where: { id: input.deviceId, userId: input.userId, revokedAt: null },
    select: { isPrimary: true }
  });

  if (!device) return { status: "missing" };

  const result = await verifySecurityCode(client, {
    userId: input.userId,
    purpose: "DEVICE_TRUST",
    sessionId: input.sessionId,
    deviceId: input.deviceId,
    code: input.code,
    now
  });

  if (result.status !== "verified") return result;

  const updated = await client.userDevice.updateMany({
    where: { id: input.deviceId, userId: input.userId, revokedAt: null },
    data: {
      confirmedAt: now,
      trustExpiresAt: deviceTrustExpiresAt(now),
      mfaVerifiedAt: input.mfaVerified ? now : null,
      trustedAt: device.isPrimary ? now : null
    }
  });

  if (updated.count === 0) return { status: "missing" };

  // A device code is not a grant - it is used up the moment it is accepted.
  await client.emailSecurityCode.updateMany({
    where: {
      userId: input.userId,
      purpose: "DEVICE_TRUST",
      deviceId: input.deviceId,
      consumedAt: null
    },
    data: { consumedAt: now }
  });

  log.info(
    {
      userId: input.userId,
      primary: device.isPrimary,
      mfaRemembered: Boolean(input.mfaVerified),
      trustDays: DEVICE_TRUST_DAYS
    },
    "device_trusted"
  );

  return result;
}

/**
 * The authenticator was just cleared (`aal2`) on a device that is already
 * trusted - somebody who set up 2FA after confirming this browser, or whose
 * factor changed. From now on a sign-in here skips the code, until the trust
 * period ends. It does NOT extend that period.
 *
 * Conditional on the device still being trusted at write time, so a removal
 * racing this cannot be undone by it.
 */
export async function recordDeviceMfaVerified(
  client: Pick<DeviceClient, "userDevice">,
  input: { userId: string; deviceId: string; now?: Date }
) {
  const now = input.now ?? new Date();
  const { count } = await client.userDevice.updateMany({
    where: {
      id: input.deviceId,
      userId: input.userId,
      revokedAt: null,
      confirmedAt: { not: null },
      trustExpiresAt: { gt: now }
    },
    data: { mfaVerifiedAt: now }
  });

  if (count > 0) log.info({ userId: input.userId }, "device_mfa_remembered");

  return count > 0;
}

/** This person's devices for My Account. Never includes the hash. */
export async function listDevices(
  client: Pick<DeviceClient, "userDevice">,
  userId: string,
  currentDeviceId: string | null,
  now: Date = new Date()
) {
  const rows = await client.userDevice.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      userAgent: true,
      city: true,
      region: true,
      country: true,
      firstSeenAt: true,
      lastSeenAt: true,
      isPrimary: true,
      confirmedAt: true,
      trustExpiresAt: true,
      revokedAt: true
    }
  });

  return rows.map((row) => ({
    id: row.id,
    device: describeUserAgent(row.userAgent) ?? row.userAgent,
    city: row.city,
    region: row.region,
    country: row.country,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    primary: row.isPrimary,
    confirmed: Boolean(row.confirmedAt),
    trusted: isDeviceTrusted(row, now),
    trustExpiresAt: trustExpiry(row),
    current: row.id === currentDeviceId
  }));
}

/**
 * Remove a device - it loses its trust and any remembered authenticator, and
 * if that browser returns it starts over as a new, unconfirmed device. Takes
 * effect on that browser's next request: `resolveUserActor` reads the row on
 * every call. Scoped by user: an id belonging to somebody else matches nothing.
 */
export async function revokeDevice(
  client: Pick<DeviceClient, "userDevice">,
  input: { userId: string; deviceId: string; now?: Date }
) {
  const { count } = await client.userDevice.updateMany({
    where: { id: input.deviceId, userId: input.userId, revokedAt: null },
    data: {
      ...TRUST_RESET,
      revokedAt: input.now ?? new Date()
    }
  });

  if (count > 0) log.info({ userId: input.userId }, "device_revoked");

  return count > 0;
}

/**
 * REMOVING A DEVICE NEEDS A CODE FROM THE ACCOUNT'S OWN INBOX.
 *
 * Bound to the person, this session, the DEVICE_REMOVAL purpose and the ONE
 * target device: a code issued to remove the laptop can never remove the
 * phone, cannot be used from another session, and cannot be used to confirm a
 * device. Ten minutes, five attempts, one live code per device, a cooldown and
 * an hourly cap - lib/auth/security-codes.ts.
 *
 * NOT DELIVERED, NOT LIVE. If the provider does not accept the email, the code
 * is withdrawn at once: nobody holds it, and the removal cannot proceed on it.
 */
export async function sendDeviceRemovalCode(
  client: DeviceClient,
  input: {
    userId: string;
    organizationId: string;
    sessionId: string;
    device: { id: string; userAgent: string | null };
    owner: { email: string; name: string };
    now?: Date;
  }
): Promise<
  | { status: "sent"; resendAvailableAt: Date; expiresAt: Date }
  | {
      status: "throttled";
      reason: IssueResult["status"];
      resendAvailableAt: Date;
    }
  | { status: "undelivered" }
> {
  const issued = await issueSecurityCode(client, {
    userId: input.userId,
    organizationId: input.organizationId,
    purpose: "DEVICE_REMOVAL",
    sessionId: input.sessionId,
    deviceId: input.device.id,
    ipAddress: null,
    userAgent: null,
    now: input.now
  });

  if (issued.status !== "issued") {
    log.info(
      { userId: input.userId, reason: issued.status },
      "device_removal_code_throttled"
    );

    return {
      status: "throttled",
      reason: issued.status,
      resendAvailableAt: issued.resendAvailableAt
    };
  }

  const outcome = await sendSecurityEmail(
    "device_removal_code",
    input.owner.email,
    deviceRemovalCodeEmail({
      name: input.owner.name,
      code: issued.code,
      device: describeUserAgent(input.device.userAgent) ?? input.device.userAgent
    })
  );

  if (outcome !== "sent") {
    await withdrawSecurityCode(client, issued.id);
    log.warn({ userId: input.userId, outcome }, "device_removal_code_withdrawn");

    return { status: "undelivered" };
  }

  return {
    status: "sent",
    resendAvailableAt: issued.resendAvailableAt,
    expiresAt: issued.expiresAt
  };
}

/**
 * Check a removal code for THIS session and THIS device. Right: the code is
 * spent on the spot - it is an authorization for one act, never a grant that
 * lingers - and the caller may remove the device. Wrong: the attempt limit
 * applies. Nothing here revokes anything.
 */
export async function verifyDeviceRemovalCode(
  client: Pick<DeviceClient, "emailSecurityCode">,
  input: {
    userId: string;
    sessionId: string;
    deviceId: string;
    code: string;
    now?: Date;
  }
): Promise<VerifyResult> {
  const now = input.now ?? new Date();
  const result = await verifySecurityCode(client, {
    userId: input.userId,
    purpose: "DEVICE_REMOVAL",
    sessionId: input.sessionId,
    deviceId: input.deviceId,
    code: input.code,
    now
  });

  if (result.status === "verified") {
    // Spent: no grant window, no second use, and no older code for this
    // device left alive either.
    await client.emailSecurityCode.updateMany({
      where: {
        userId: input.userId,
        purpose: "DEVICE_REMOVAL",
        deviceId: input.deviceId,
        consumedAt: null
      },
      data: { consumedAt: now }
    });
  } else if (result.status === "invalid" || result.status === "locked") {
    log.warn(
      { userId: input.userId, status: result.status },
      "device_removal_code_rejected"
    );
  }

  return result;
}

/**
 * Remove EVERY device of this person's - the primary included. "Sign out all
 * devices": each browser, this one too, is new again and must be verified
 * from scratch (authenticator if set up, then the email code). `isPrimary`
 * stays on its row - it only marks which device "sign out untrusted devices"
 * keeps, and a removed device has no trust for that to keep.
 */
export async function revokeAllDevices(
  client: Pick<DeviceClient, "userDevice">,
  input: { userId: string; now?: Date }
) {
  const { count } = await client.userDevice.updateMany({
    where: { userId: input.userId, revokedAt: null },
    data: {
      ...TRUST_RESET,
      revokedAt: input.now ?? new Date()
    }
  });

  log.info({ userId: input.userId, count }, "devices_revoked");

  return count;
}
