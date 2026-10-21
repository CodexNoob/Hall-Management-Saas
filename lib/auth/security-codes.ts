import "server-only";

import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { getEnv } from "@/lib/env";

/**
 * What a code is FOR. The column is text; this is the closed list.
 *
 *   MFA_ENROLLMENT - becomes a grant that lets a new authenticator be trusted.
 *   DEVICE_TRUST   - confirms one browser (`deviceId`) as the owner's own.
 *   DEVICE_REMOVAL - authorizes removing ONE device (`deviceId`) from the
 *                    Devices list. Spent the moment it is accepted.
 */
export type SecurityCodePurpose =
  | "MFA_ENROLLMENT"
  | "DEVICE_TRUST"
  | "DEVICE_REMOVAL";

/**
 * One-time codes emailed to the account's own address, and the short-lived
 * GRANT a correct code turns into.
 *
 * The grant is the whole point. Supabase will enroll an authenticator for any
 * session holding the password, so "the user set this up" has to be proved
 * some other way - and "they could read their own email, in this session, in
 * the last few minutes" is that proof. lib/auth/mfa-trust.ts only trusts a new
 * factor while a grant for the same Supabase session is live, and spends it.
 *
 * NEVER LOG OR RETURN A CODE except to the email that carries it. The row
 * holds an HMAC, keyed with a server secret and salted with the row id: a
 * leaked table is not a list of live codes, and without the key six digits
 * cannot be tried offline.
 */

export const SECURITY_CODE_TTL_MS = 10 * 60_000;
export const SECURITY_CODE_MAX_ATTEMPTS = 5;
export const SECURITY_CODE_RESEND_COOLDOWN_MS = 60_000;
export const SECURITY_CODE_MAX_SENDS_PER_HOUR = 5;
export const ENROLLMENT_GRANT_TTL_MS = 15 * 60_000;

const HOUR_MS = 60 * 60_000;

type CodeClient = { emailSecurityCode: Prisma.EmailSecurityCodeDelegate };

function hashingKey() {
  const env = getEnv();
  // SESSION_SECRET is the application's own; the Supabase service key is a
  // server-only secret every deployment of this app already has. Either keeps
  // the HMAC unguessable. Neither means misconfiguration, and failing loudly
  // beats hashing with a constant.
  const key =
    env.SESSION_SECRET ?? env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("No server secret is configured for security codes.");
  }

  return key;
}

export function generateSecurityCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * HMAC-SHA256 under the server's secret. The one keyed hash for secrets this
 * app stores a fingerprint of - email codes here, device secrets in
 * lib/auth/device-identity.ts.
 */
export function serverHmac(value: string) {
  return createHmac("sha256", hashingKey()).update(value).digest("hex");
}

export function hashSecurityCode(id: string, code: string) {
  return serverHmac(`${id}:${code}`);
}

function hashesMatch(stored: string, candidate: string) {
  const left = Buffer.from(stored, "hex");
  const right = Buffer.from(candidate, "hex");

  return left.length === right.length && timingSafeEqual(left, right);
}

/** "a•••@example.com" - enough for the owner to recognise, little for anyone else. */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");

  if (!local || !domain) return "your email";

  return `${local.slice(0, 1)}•••@${domain}`;
}

export type IssueResult =
  | { status: "cooldown" | "hourly_limit"; resendAvailableAt: Date }
  | {
      status: "issued";
      id: string;
      /** For the email and nothing else. */
      code: string;
      expiresAt: Date;
      resendAvailableAt: Date;
    };

/**
 * A fresh code, unless this person asked for one too recently.
 *
 * Issuing SPENDS every outstanding code and grant for the purpose - there is
 * only ever one live code, so an older email in the inbox stops working, and
 * starting over really does start over.
 */
export async function issueSecurityCode(
  client: CodeClient,
  input: {
    userId: string;
    organizationId: string;
    purpose: SecurityCodePurpose;
    sessionId: string;
    /**
     * DEVICE_TRUST and DEVICE_REMOVAL. Scopes the cooldown, the "one live
     * code" rule and verification to this device - confirming the laptop does
     * not cancel the phone's code, and a removal code names the one device it
     * may remove. The hourly cap stays per person, to bound email volume.
     */
    deviceId?: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    now?: Date;
  }
): Promise<IssueResult> {
  const now = input.now ?? new Date();
  const deviceScope = input.deviceId ? { deviceId: input.deviceId } : {};

  const latest = await client.emailSecurityCode.findFirst({
    where: { userId: input.userId, purpose: input.purpose, ...deviceScope },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true }
  });

  if (
    latest &&
    now.getTime() - latest.createdAt.getTime() < SECURITY_CODE_RESEND_COOLDOWN_MS
  ) {
    return {
      status: "cooldown",
      resendAvailableAt: new Date(
        latest.createdAt.getTime() + SECURITY_CODE_RESEND_COOLDOWN_MS
      )
    };
  }

  const recent = await client.emailSecurityCode.findMany({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      createdAt: { gt: new Date(now.getTime() - HOUR_MS) }
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true }
  });

  if (recent.length >= SECURITY_CODE_MAX_SENDS_PER_HOUR) {
    return {
      status: "hourly_limit",
      resendAvailableAt: new Date(recent[0].createdAt.getTime() + HOUR_MS)
    };
  }

  await client.emailSecurityCode.updateMany({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      consumedAt: null,
      ...deviceScope
    },
    data: { consumedAt: now }
  });

  const id = randomUUID();
  const code = generateSecurityCode();
  const expiresAt = new Date(now.getTime() + SECURITY_CODE_TTL_MS);

  await client.emailSecurityCode.create({
    data: {
      id,
      userId: input.userId,
      organizationId: input.organizationId,
      purpose: input.purpose,
      sessionId: input.sessionId,
      deviceId: input.deviceId ?? null,
      codeHash: hashSecurityCode(id, code),
      expiresAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: now
    }
  });

  return {
    status: "issued",
    id,
    code,
    expiresAt,
    resendAvailableAt: new Date(now.getTime() + SECURITY_CODE_RESEND_COOLDOWN_MS)
  };
}

/** A code the provider refused to deliver is withdrawn, so it cannot linger. */
export async function withdrawSecurityCode(client: CodeClient, id: string) {
  await client.emailSecurityCode.updateMany({
    where: { id, consumedAt: null },
    data: { consumedAt: new Date() }
  });
}

export type VerifyResult =
  | { status: "verified"; grantExpiresAt: Date }
  | { status: "invalid"; attemptsLeft: number }
  | { status: "missing" | "expired" | "locked" };

/**
 * Check a code for THIS session. Right: the row becomes a grant. Wrong: one
 * fewer attempt, and at five the code is dead whatever is typed next.
 */
export async function verifySecurityCode(
  client: CodeClient,
  input: {
    userId: string;
    purpose: SecurityCodePurpose;
    sessionId: string;
    /** DEVICE_TRUST: the device being confirmed. A code for another never matches. */
    deviceId?: string | null;
    code: string;
    now?: Date;
  }
): Promise<VerifyResult> {
  const now = input.now ?? new Date();

  const row = await client.emailSecurityCode.findFirst({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      sessionId: input.sessionId,
      ...(input.deviceId ? { deviceId: input.deviceId } : {}),
      consumedAt: null,
      verifiedAt: null
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, codeHash: true, attempts: true, expiresAt: true }
  });

  if (!row) return { status: "missing" };
  if (row.expiresAt <= now) return { status: "expired" };
  if (row.attempts >= SECURITY_CODE_MAX_ATTEMPTS) return { status: "locked" };

  if (hashesMatch(row.codeHash, hashSecurityCode(row.id, input.code))) {
    const grantExpiresAt = new Date(now.getTime() + ENROLLMENT_GRANT_TTL_MS);
    // Conditional, so two simultaneous correct submissions verify once.
    const { count } = await client.emailSecurityCode.updateMany({
      where: { id: row.id, verifiedAt: null, consumedAt: null },
      data: { verifiedAt: now, grantExpiresAt }
    });

    return count === 1 ? { status: "verified", grantExpiresAt } : { status: "missing" };
  }

  const updated = await client.emailSecurityCode.update({
    where: { id: row.id },
    data: { attempts: { increment: 1 } },
    select: { attempts: true }
  });
  const attemptsLeft = Math.max(0, SECURITY_CODE_MAX_ATTEMPTS - updated.attempts);

  return attemptsLeft === 0 ? { status: "locked" } : { status: "invalid", attemptsLeft };
}

/**
 * Spend this session's live enrollment grant, if it has one. True exactly
 * once per grant: the update is conditional on it still being unspent, so two
 * racing callers cannot both trust a factor with it.
 */
export async function consumeEnrollmentGrant(
  client: CodeClient,
  input: { userId: string; sessionId: string; now?: Date }
): Promise<boolean> {
  const now = input.now ?? new Date();

  const { count } = await client.emailSecurityCode.updateMany({
    where: {
      userId: input.userId,
      purpose: "MFA_ENROLLMENT",
      sessionId: input.sessionId,
      verifiedAt: { not: null },
      consumedAt: null,
      grantExpiresAt: { gt: now }
    },
    data: { consumedAt: now }
  });

  return count > 0;
}
