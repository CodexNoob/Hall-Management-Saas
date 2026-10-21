import "server-only";

import type { User } from "@supabase/supabase-js";
import type { Prisma } from "@prisma/client";

import type { AssuranceLevel } from "@/lib/auth/identity";

/**
 * Two-factor authentication, on the server side of it.
 *
 * WHERE THE TRUTH LIVES. The factors themselves are Supabase's - they are rows
 * in `auth.mfa_factors`, the TOTP secret never leaves them, and only Supabase
 * can say whether a six-digit code is the right one at this second. Nothing
 * here verifies a code, and nothing here should ever try.
 *
 * What this file owns is the QUESTION every authenticated request has to
 * answer: does this session owe a second factor? That needs two facts, and
 * they come from different places. Whether the session cleared one is in the
 * `aal` claim on the access token, which `resolveAuthIdentity` verifies. But
 * whether a factor exists AT ALL is not in the token - an account with a
 * factor and an account without one both produce `aal1` before the challenge.
 * Asking the Auth server for the factor list on every request would put a
 * round trip on the hottest path in the application, so it is mirrored onto
 * `users.mfa_enrolled_at` and read from there.
 *
 * That mirror is only ever written from a factor list this process just read
 * out of Supabase with the user's own token. A browser saying "I enrolled" is
 * not evidence of anything.
 */

/**
 * True when this Supabase user has a second factor they have finished setting
 * up.
 *
 * `status === "verified"` matters. `enroll()` creates a factor immediately and
 * leaves it unverified until the first code is accepted, so somebody who opens
 * the QR code and closes the tab has a factor row and no working factor.
 * Counting that as enrolled would lock them out of their own account with a
 * secret they never saved.
 */
export function hasVerifiedFactor(user: Pick<User, "factors">): boolean {
  return Boolean(
    user.factors?.some((factor) => factor.status === "verified")
  );
}

/**
 * What this session still owes, if anything.
 *
 * Pure, and takes every input explicitly, because it is the decision the whole
 * feature rests on and it should be readable in one screen and testable
 * without a database.
 *
 * `enrolled` means a TRUSTED factor (lib/auth/mfa-trust.ts), and that is why
 * `aal2` no longer settles it on its own. Supabase grants `aal2` for ANY
 * verified factor - including one somebody attached with a stolen password.
 * An `aal2` session with no trusted factor behind it is treated exactly like
 * an account with no factor: fine where 2FA is optional (the password alone
 * already got them this far), and sent to protected enrolment where it is
 * required.
 *
 * A null assurance level is read as `aal1`. "The token does not say whether a
 * factor was cleared" and "a factor was not cleared" have to resolve the same
 * way; the alternative is that an unrecognised token shape is a way past the
 * check.
 *
 * `rememberedOnDevice` (lib/auth/device-trust-policy.ts) lets a trusted device
 * on which the code was already entered skip it - but ONLY where 2FA is the
 * person's own choice. Where the organization requires it, every sign-in
 * clears the factor: device trust never stands in for that policy.
 */
export function mfaObligation(input: {
  assuranceLevel: AssuranceLevel | null;
  enrolled: boolean;
  requiredByOrganization: boolean;
  rememberedOnDevice?: boolean;
}): "satisfied" | "challenge" | "enroll" {
  // A trusted factor exists: this session either used a factor or owes the
  // code. An organization that requires 2FA is satisfied by it, and one that
  // does not still honours the factor the person chose to set up.
  if (input.enrolled) {
    if (input.assuranceLevel === "aal2") return "satisfied";
    if (input.rememberedOnDevice && !input.requiredByOrganization) {
      return "satisfied";
    }

    return "challenge";
  }

  // No trusted factor. Only a policy can make that a problem.
  return input.requiredByOrganization ? "enroll" : "satisfied";
}

/**
 * Bring `users.mfa_enrolled_at` into line with what Supabase actually holds -
 * counting only TRUSTED factors; callers pass `reconcileMfaFactors().trusted`.
 *
 * Called from the two places that have already fetched the real user for their
 * own reasons - the session sync and the enrolment callback - so this costs no
 * extra round trip in either.
 *
 * The timestamp is preserved once set rather than rewritten on every sync: it
 * answers "since when", and refreshing it on each dashboard load would turn it
 * into a second, worse copy of `last_seen`. Unenrolling clears it, which is the
 * change that actually matters - a stale `true` here is the one direction that
 * would keep asking somebody for a code they can no longer produce.
 */
export async function syncMfaEnrollment(
  client: { user: Prisma.UserDelegate },
  input: { userId: string; enrolled: boolean; enrolledAt: Date | null }
): Promise<void> {
  const current = await client.user.findUnique({
    where: { id: input.userId },
    select: { mfaEnrolledAt: true }
  });

  if (!current) return;

  const isEnrolled = Boolean(current.mfaEnrolledAt);

  if (isEnrolled === input.enrolled) return;

  await client.user.update({
    where: { id: input.userId },
    data: {
      mfaEnrolledAt: input.enrolled ? (input.enrolledAt ?? new Date()) : null
    }
  });
}
