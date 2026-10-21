import "server-only";

import { recordActivity, type ActivityActor } from "@/lib/audit/activity-log";
import { consumeEnrollmentGrant } from "@/lib/auth/security-codes";
import {
  mfaEnabledEmail,
  sendSecurityEmail,
  untrustedFactorEmail
} from "@/lib/auth/security-emails";
import { log } from "@/lib/logging/context";
import { trackOutbound } from "@/lib/logging/outbound";
import { prisma } from "@/lib/prisma";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * WHICH AUTHENTICATORS COUNT.
 *
 * Supabase will enroll a TOTP factor for any session that holds the password,
 * and a factor whose first code was accepted is `verified` there - which proves
 * somebody holds the secret, not that the ACCOUNT OWNER put it there. Before
 * this, that was enough: a stolen password on an account without 2FA let the
 * thief attach their own authenticator, satisfy a "2FA required" policy with
 * it, and lock the real owner out.
 *
 * Now a verified factor counts only when it is in `mfa_trusted_factors`, and it
 * only gets there one way: while THIS Supabase session holds a live enrollment
 * grant - which needs a code from the account's own inbox (see
 * lib/auth/security-codes.ts). A verified factor with no grant behind it is
 * removed through the admin API, the owner is emailed, and it is recorded.
 *
 * Run from both places that already hold the user's fresh factor list: the
 * enrolment callback (`POST /api/me/mfa`) and the session sync. The sync is what
 * catches a factor attached by calling Supabase directly, outside our UI - and
 * it also trusts a legitimate one if its poll lands between the browser
 * verifying the factor and the browser reporting it, since the grant is keyed
 * to the session rather than to which route asks.
 *
 * FAILS SAFE IN ONE DIRECTION ONLY. If anything here throws, nothing is
 * deleted and nothing new is trusted; the caller keeps the mirror as it was.
 */

export type FactorSnapshot = {
  id: string;
  status: string;
  factor_type?: string;
  created_at?: string;
};

export type ReconcileResult = {
  /** Verified TOTP factors Supabase holds. */
  verified: number;
  /** At least one of them is trusted - what enforcement reads. */
  trusted: boolean;
  newlyTrusted: number;
  removedUntrusted: number;
};

export async function reconcileMfaFactors(input: {
  userId: string;
  supabaseAuthId: string;
  factors: readonly FactorSnapshot[] | undefined;
  /** The `session_id` claim of the caller's token. Null means no grant can apply. */
  sessionId: string | null;
  audit: ActivityActor;
  owner: { email: string; name: string };
  now?: Date;
}): Promise<ReconcileResult> {
  const now = input.now ?? new Date();
  const verified = (input.factors ?? []).filter(
    (factor) =>
      factor.status === "verified" &&
      (factor.factor_type === undefined || factor.factor_type === "totp")
  );

  // The overwhelmingly common case - no 2FA at all - costs no query.
  if (verified.length === 0) {
    return { verified: 0, trusted: false, newlyTrusted: 0, removedUntrusted: 0 };
  }

  const known = await prisma.mfaTrustedFactor.findMany({
    where: { userId: input.userId, factorId: { in: verified.map((f) => f.id) } },
    select: { factorId: true }
  });
  const trustedIds = new Set(known.map((row) => row.factorId));

  // Newest first: if a grant is live, it belongs to the factor just enrolled,
  // not to some older one that has been sitting there.
  const unknown = verified
    .filter((factor) => !trustedIds.has(factor.id))
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  let newlyTrusted = 0;
  const untrusted: FactorSnapshot[] = [];

  for (const factor of unknown) {
    const granted =
      newlyTrusted === 0 &&
      input.sessionId !== null &&
      (await consumeEnrollmentGrant(prisma, {
        userId: input.userId,
        sessionId: input.sessionId,
        now
      }));

    if (granted) {
      await prisma.mfaTrustedFactor.upsert({
        where: { factorId: factor.id },
        update: {},
        create: {
          userId: input.userId,
          factorId: factor.id,
          source: "email_verified",
          trustedAt: now
        }
      });
      trustedIds.add(factor.id);
      newlyTrusted += 1;
      continue;
    }

    // Lost a race rather than lacking a grant? Another request may have just
    // spent the grant on THIS factor. Deleting a factor another request just
    // trusted would be the worst outcome here, so look once more.
    const trustedMeanwhile = await prisma.mfaTrustedFactor.findUnique({
      where: { factorId: factor.id },
      select: { id: true }
    });

    if (trustedMeanwhile) {
      trustedIds.add(factor.id);
      continue;
    }

    untrusted.push(factor);
  }

  let removedUntrusted = 0;

  if (untrusted.length > 0) {
    const admin = createSupabaseServiceClient().auth.admin;

    for (const factor of untrusted) {
      try {
        const { error } = await trackOutbound(
          { vendor: "supabase", operation: "auth.admin.mfa.deleteFactor" },
          () =>
            admin.mfa.deleteFactor({ id: factor.id, userId: input.supabaseAuthId })
        );

        if (error) throw error;
        removedUntrusted += 1;
      } catch (removeError) {
        // Still NOT trusted - enforcement ignores it either way. It only stays
        // attached, and the next sync tries again.
        log.error(
          { userId: input.userId, err: String(removeError) },
          "mfa_untrusted_factor_not_removed"
        );
      }
    }

    // A decision worth reconstructing: somebody attached an authenticator
    // without the owner's inbox. userId only; no factor secret exists here.
    log.warn(
      { userId: input.userId, detected: untrusted.length, removed: removedUntrusted },
      "mfa_untrusted_factor_detected"
    );

    await recordQuietly(input.audit, {
      action: "auth.mfa.untrusted_removed",
      message: `An authenticator was added to ${input.owner.name}'s account without email verification and was removed.`
    });
    await sendSecurityEmail(
      "mfa_untrusted_removed",
      input.owner.email,
      untrustedFactorEmail({ name: input.owner.name })
    );
  }

  if (newlyTrusted > 0) {
    log.info({ userId: input.userId }, "mfa_factor_trusted");
    await recordQuietly(input.audit, {
      action: "auth.mfa.enabled",
      message: `${input.owner.name} turned on two-factor authentication.`
    });
    await sendSecurityEmail(
      "mfa_enabled",
      input.owner.email,
      mfaEnabledEmail({ name: input.owner.name })
    );
  }

  return {
    verified: verified.length,
    trusted: verified.some((factor) => trustedIds.has(factor.id)),
    newlyTrusted,
    removedUntrusted
  };
}

/**
 * The factor decision is already made and applied at Supabase; a failed audit
 * write must not turn that into an error response that misreports it.
 */
async function recordQuietly(
  actor: ActivityActor,
  entry: Parameters<typeof recordActivity>[2]
) {
  try {
    await recordActivity(prisma, actor, entry);
  } catch (auditError) {
    log.warn({ err: String(auditError) }, "mfa_change_not_recorded");
  }
}
