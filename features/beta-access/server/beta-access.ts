import "server-only";

import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logging/context";
import { notifyBetaAccessRequested } from "@/features/beta-access/server/beta-access-notifications";

/**
 * The beta queue: who has asked to open an Event Core account, and whether they
 * may.
 *
 * Registration used to provision an organization, an owner membership and a
 * free trial on first sign-in. While Event Core is in beta it records a request
 * instead, and nothing is provisioned until somebody approves it.
 *
 * This module is the only reader and writer of `beta_access_requests`, and
 * `provisionOwner()` is its only caller - the one place that both records a
 * request and consults the decision.
 *
 * ONE CALLER ON PURPOSE, and specifically one that needs a session. An earlier
 * version also recorded from POST /api/beta-access/requests, called by the
 * sign-up form between `supabase.auth.signUp` and email confirmation. That
 * announced an address before anybody had proven they could read mail at it, so
 * the queue collected registrations that were never confirmed and the approval
 * inbox heard about every one of them. Recording only from a path that cannot
 * run without a session means an entry in this table is always an address
 * somebody has confirmed - by opening the link, or by arriving through Google,
 * which has verified it already.
 *
 * `recordAndNotifyBetaAccessRequest` is idempotent, which is what lets it run on
 * every sign-in attempt rather than only the first.
 */

export const BETA_ACCESS_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED"
] as const;

export type BetaAccessStatus = (typeof BETA_ACCESS_STATUSES)[number];

export function isBetaAccessStatus(value: unknown): value is BetaAccessStatus {
  return BETA_ACCESS_STATUSES.includes(value as BetaAccessStatus);
}

/** How the applicant registered, when the recording path can tell. */
export type BetaSignupMethod = "email_password" | "google";

/**
 * The address as one canonical string, however it was typed.
 *
 * Lower-cased and trimmed, and NOTHING MORE. Stripping dots or `+tags` would be
 * a policy about which addresses are the same person that the rest of the app
 * does not hold - `findUserForProfile` matches `users.email` verbatim - and two
 * different notions of identity between this gate and provisioning is exactly
 * the kind of gap somebody walks through.
 */
export function normalizeBetaEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Addresses admitted the moment they register.
 *
 * Deliberately its own variable rather than a reuse of `TESTER_BYPASS_EMAILS`,
 * which waives PAYMENT. Not paying and being allowed to create a tenant are
 * different powers; one list holding both means granting either one grants the
 * other by accident. Empty unless configured, so the default posture is that
 * everybody waits for a human.
 */
export function betaAutoApproveEmails(): string[] {
  return (process.env.BETA_ACCESS_AUTO_APPROVE_EMAILS ?? "")
    .split(",")
    .map((entry) => normalizeBetaEmail(entry))
    .filter(Boolean);
}

export function isAutoApprovedBetaEmail(email: string) {
  return betaAutoApproveEmails().includes(normalizeBetaEmail(email));
}

export type RecordedBetaAccessRequest = {
  email: string;
  status: BetaAccessStatus;
  signupMethod: BetaSignupMethod | null;
  requestedAt: Date;
  /**
   * Whether this call opened the request rather than finding one.
   *
   * The notification keys off it: re-registering must not mail the team again,
   * both because it is noise and because the sign-up form would otherwise be an
   * unauthenticated way for anyone to send repeated messages to that inbox.
   */
  isNew: boolean;
};

const REQUEST_FIELDS = {
  email: true,
  status: true,
  signupMethod: true,
  requestedAt: true,
  supabaseAuthId: true
} as const;

type RequestRow = {
  email: string;
  status: string;
  signupMethod: string | null;
  requestedAt: Date;
  supabaseAuthId: string | null;
};

/**
 * The one request for this person, by either key.
 *
 * Identity first, then address - the same precedence `findUserForProfile` uses.
 * Doing it as a single `findFirst` with an OR would let the database choose
 * when both match different rows, which is only stable while that cannot
 * happen.
 */
async function findRequest(
  email: string,
  supabaseAuthId: string | null
): Promise<RequestRow | null> {
  const candidates = await prisma.betaAccessRequest.findMany({
    where: {
      OR: [
        ...(supabaseAuthId ? [{ supabaseAuthId }] : []),
        { email }
      ]
    },
    select: REQUEST_FIELDS
  });

  return (
    (supabaseAuthId
      ? candidates.find(
          (candidate) => candidate.supabaseAuthId === supabaseAuthId
        )
      : undefined) ??
    candidates.find((candidate) => candidate.email === email) ??
    null
  );
}

/**
 * Record a request for this person, or return the one already on file.
 *
 * `upsert` rather than find-then-create for the write: two tabs submitting at
 * once would both find nothing and both try to create, and the loser of that
 * race would see a unique-constraint 500 on a form that had actually worked.
 */
export async function recordBetaAccessRequest(input: {
  email: string;
  signupMethod?: BetaSignupMethod | null;
  supabaseAuthId?: string | null;
}): Promise<RecordedBetaAccessRequest> {
  const email = normalizeBetaEmail(input.email);
  const supabaseAuthId = input.supabaseAuthId ?? null;
  const existing = await findRequest(email, supabaseAuthId);

  if (existing) {
    // Claim the request for this identity the first time an authenticated one
    // turns up. It is what makes the second key work at all: the public form
    // writes the row before Supabase has issued a session, so without this the
    // id would stay NULL forever and only the address would ever match.
    if (supabaseAuthId && !existing.supabaseAuthId) {
      await prisma.betaAccessRequest
        .update({ where: { email: existing.email }, data: { supabaseAuthId } })
        .catch((error: unknown) => {
          // Not fatal: the address still identifies them, so a failure here
          // costs the second key and not the decision.
          log.error(
            { email: existing.email, reason: String(error) },
            "beta_access_identity_claim_failed"
          );
        });
    }

    return { ...toRecord(existing), isNew: false };
  }

  // An allowlisted address is admitted the moment it asks. The row still
  // exists, so the queue stays a complete record of who was let in and when.
  const status: BetaAccessStatus = isAutoApprovedBetaEmail(email)
    ? "APPROVED"
    : "PENDING";

  const created = await prisma.betaAccessRequest.upsert({
    where: { email },
    update: {},
    create: {
      email,
      supabaseAuthId,
      status,
      signupMethod: input.signupMethod ?? null,
      ...(status === "APPROVED"
        ? {
            decidedAt: new Date(),
            decidedBy: "BETA_ACCESS_AUTO_APPROVE_EMAILS"
          }
        : {})
    },
    select: REQUEST_FIELDS
  });

  // `upsert` cannot report which branch it took, and the race above is the only
  // way `created` is not ours - so the read decides `isNew`. At worst a genuine
  // race sends one duplicate notification, which is a far better failure than a
  // request nobody hears about.
  return { ...toRecord(created), isNew: true };
}

function toRecord(row: RequestRow) {
  if (!isBetaAccessStatus(row.status)) {
    // The database CHECK constraint makes this unreachable, which is exactly
    // why it is worth saying out loud if it ever happens: the gate reads
    // anything that is not APPROVED as a refusal, so a corrupt status locks
    // somebody out silently instead of erroring.
    log.error(
      { email: row.email, status: row.status },
      "beta_access_status_unrecognized"
    );
  }

  return {
    email: row.email,
    status: (isBetaAccessStatus(row.status)
      ? row.status
      : "PENDING") as BetaAccessStatus,
    signupMethod: (row.signupMethod as BetaSignupMethod | null) ?? null,
    requestedAt: row.requestedAt
  };
}

/**
 * Record the request, then tell the team - in that order, never the reverse.
 *
 * The write commits before a byte goes to Brevo, and the send happens outside
 * any transaction. That ordering is the whole of the delivery-failure
 * requirement: a mail outage can lose a notification and never a request, and
 * `notified_at` is stamped only if the mail actually went, so the row never
 * claims something that did not happen.
 */
export async function recordAndNotifyBetaAccessRequest(input: {
  email: string;
  signupMethod?: BetaSignupMethod | null;
  supabaseAuthId?: string | null;
}): Promise<RecordedBetaAccessRequest> {
  const request = await recordBetaAccessRequest(input);

  // Only a NEW pending request is announced. An auto-approved address has no
  // decision for the team to make, and a duplicate has already been announced.
  if (!request.isNew || request.status !== "PENDING") {
    return request;
  }

  const notified = await notifyBetaAccessRequested({
    email: request.email,
    signupMethod: request.signupMethod,
    requestedAt: request.requestedAt,
    status: request.status
  });

  if (notified) {
    await prisma.betaAccessRequest
      .update({
        where: { email: request.email },
        data: { notifiedAt: new Date() }
      })
      .catch((error: unknown) => {
        // Swallowed for the same reason the send is: the request is already
        // recorded, and losing the stamp costs the team a duplicate glance at
        // the queue rather than costing an applicant.
        log.error(
          { email: request.email, reason: String(error) },
          "beta_access_notified_at_write_failed"
        );
      });
  }

  return request;
}
