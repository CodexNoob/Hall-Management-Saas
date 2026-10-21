import "server-only";

import { log } from "@/lib/logging/context";
import { trackedFetch } from "@/lib/logging/outbound";

/**
 * EVERY EMAIL THIS APPLICATION SENDS GOES THROUGH HERE.
 *
 * WHY THIS FILE EXISTS. The email layer had grown three copies of "post some
 * HTML to a provider": one in `support-notifications.ts` against Resend, one in
 * `beta-access-notifications.ts` against Brevo, and a third in the notification
 * sender against Resend again. Two providers for one job means two dashboards,
 * two sending reputations, two places bounces land - and, because only the
 * Brevo key was ever configured, it meant support tickets and booking
 * notifications silently sent nothing while beta emails went out fine. Nothing
 * failed; the senders checked for a key they did not have and returned.
 *
 * BREVO, because it is the one the account actually has. The choice matters
 * less than there being one: deliverability is a property of a sending domain
 * and a warmed-up reputation, and splitting it across two providers halves both
 * while doubling what has to be configured.
 *
 * THROUGH `trackedFetch`, per AGENTS.md - which the Brevo sender was not doing.
 * A bare `fetch` to a partner is a call with no duration, no status and no
 * attribution at the moment it is the thing making requests slow.
 *
 * NOTHING IDENTIFYING IS LOGGED. Not the address, not the subject, not the
 * body. `trackedFetch` logs neither the URL nor the payload, and the lines here
 * carry counts and statuses only.
 */

export type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
  /** Where a reply should go, when that is not the sending address. */
  replyTo?: string;
};

/**
 * Brevo wants the sender split into name and address; the environment variable
 * holds the usual `Name <address@example.com>` form.
 *
 * A value with no angle brackets is treated as a bare address, which is what an
 * operator who typed one would expect.
 */
function parseSender(from: string) {
  const match = from.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);

  if (!match) return { email: from.trim() };

  const name = match[1].trim();

  return { email: match[2].trim(), ...(name ? { name } : {}) };
}

/**
 * Send one email. Returns whether the provider accepted it.
 *
 * NEVER THROWS FOR A CONFIGURATION PROBLEM, and does throw for a refusal. The
 * distinction is deliberate: "no provider configured" is a deployment state
 * that a venue may legitimately be in, and it should not turn every booking
 * into an error - while "the provider rejected this" is something the caller
 * may want to retry or record, so it is raised rather than swallowed here.
 * Callers that must not fail their own mutation catch it; see
 * `lib/notifications/send.ts`.
 */
export async function sendTransactionalEmail(
  email: TransactionalEmail
): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.SUPPORT_EMAIL_FROM;

  if (!apiKey || !from) {
    // Info rather than warn: a venue running without an email provider should
    // not see a warning on every action. `configured` names WHICH half is
    // missing without putting either value in the log.
    log.info(
      { hasKey: Boolean(apiKey), hasSender: Boolean(from) },
      "email_provider_not_configured"
    );

    return false;
  }

  const response = await trackedFetch(
    { vendor: "brevo", operation: "smtp.email" },
    "https://api.brevo.com/v3/smtp/email",
    {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: parseSender(from),
        to: [{ email: email.to }],
        subject: email.subject,
        htmlContent: email.html,
        ...(email.replyTo ? { replyTo: { email: email.replyTo } } : {})
      })
    }
  );

  if (!response.ok) {
    // The status, never the recipient. A provider error message can echo the
    // request back, and that request contains an address.
    throw new Error(`Email send failed (${response.status}).`);
  }

  return true;
}

/**
 * Escape text that came from a person, for insertion into HTML.
 *
 * Shared because all three senders had their own copy, and a client name is
 * free text somebody typed: "Brown & Sons" has to survive, and a name
 * containing a tag must not become one.
 */
export function escapeHtml(value: string) {
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
