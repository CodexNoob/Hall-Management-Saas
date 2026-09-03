import "server-only";

import { log } from "@/lib/logging/context";
import type {
  BetaAccessStatus,
  BetaSignupMethod
} from "@/features/beta-access/server/beta-access";

/**
 * Tells the Event Core team somebody has asked for beta access.
 *
 * Beta notifications use Brevo's transactional-email API. Supabase may use
 * the same Brevo account over SMTP for authentication mail, but its stored
 * SMTP credentials are not exposed to this application, so the application
 * receives its own `BREVO_API_KEY`. The recipient is its own variable,
 * `BETA_APPROVAL_EMAIL`, rather than `SUPPORT_EMAIL`:
 * these are different jobs going to possibly different people, and an address
 * that must never be hardcoded is easier to keep un-hardcoded when it has a
 * name of its own.
 *
 * NEVER CALLED INSIDE A TRANSACTION, and never allowed to fail a request. The
 * row commits first; this runs after and reports its own failure. A support
 * inbox that missed a message costs the team a glance at the queue; a
 * rolled-back registration costs an applicant who may not come back.
 */

const SIGNUP_METHOD_LABELS: Record<BetaSignupMethod, string> = {
  email_password: "Email and password",
  google: "Google"
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    };
    return entities[character] ?? character;
  });
}

async function sendEmail({
  to,
  subject,
  html
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.SUPPORT_EMAIL_FROM;

  if (!apiKey || !from) return false;

  const senderMatch = from.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  const sender = senderMatch
    ? {
        email: senderMatch[2].trim(),
        ...(senderMatch[1].trim() ? { name: senderMatch[1].trim() } : {})
      }
    : { email: from.trim() };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html
    })
  });

  if (!response.ok) {
    throw new Error(`Beta access email failed (${response.status}).`);
  }

  return true;
}

export type BetaAccessNotification = {
  email: string;
  signupMethod: BetaSignupMethod | null;
  requestedAt: Date;
  status: BetaAccessStatus;
};

/**
 * Returns whether the team was actually mailed, and throws nothing.
 *
 * The caller decides whether to stamp `notified_at` from this, so "no recipient
 * configured" and "Brevo refused it" are both plainly false rather than a
 * claim recorded on the row that nobody can check.
 */
export async function notifyBetaAccessRequested(
  request: BetaAccessNotification
): Promise<boolean> {
  const to = process.env.BETA_APPROVAL_EMAIL;

  if (!to) {
    // Not an error. A deployment with no approval address has nowhere to send
    // this, and the request is still safely in the queue.
    log.warn(
      { email: request.email },
      "beta_access_notification_skipped_no_recipient"
    );
    return false;
  }

  const method = request.signupMethod
    ? SIGNUP_METHOD_LABELS[request.signupMethod]
    : "Not recorded";
  // ISO 8601 in UTC. The team reads this in several places, and an unqualified
  // local time is ambiguous about whose clock produced it.
  const requestedAt = request.requestedAt.toISOString();

  try {
    return await sendEmail({
      to,
      // Named as what it is, so it is filterable and cannot be mistaken for a
      // support ticket.
      subject: `New Event Core beta-access request: ${request.email}`,
      html: [
        "<h2>New Event Core beta-access request</h2>",
        "<p>Somebody has registered for an owner account and is waiting for approval. No organization, membership or trial has been created for them.</p>",
        `<p><strong>Applicant email:</strong> ${escapeHtml(request.email)}</p>`,
        `<p><strong>Signup method:</strong> ${escapeHtml(method)}</p>`,
        `<p><strong>Requested at:</strong> ${escapeHtml(requestedAt)} (UTC)</p>`,
        `<p><strong>Current status:</strong> ${escapeHtml(request.status)}</p>`,
        "<p>Approve with <code>npm run beta:approve -- &lt;email&gt;</code>, or reject with <code>npm run beta:reject -- &lt;email&gt;</code>. See docs/beta-access.md.</p>"
      ].join("")
    });
  } catch (error) {
    // Logged through the structured logger, never rethrown - see the note at
    // the top of this file.
    log.error(
      {
        email: request.email,
        err:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "NonError", message: String(error) }
      },
      "beta_access_notification_failed"
    );

    return false;
  }
}
