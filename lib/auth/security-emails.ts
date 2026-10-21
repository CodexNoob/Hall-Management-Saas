import "server-only";

import { escapeHtml, sendTransactionalEmail } from "@/lib/email/send";
import { log } from "@/lib/logging/context";

/**
 * The emails account security sends: the verification code, and the two
 * alerts. English only, like the rest of the transactional mail.
 *
 * NOTHING HERE IS LOGGED BUT THE KIND AND THE OUTCOME. Never the address, the
 * subject, the body - and never the code, which is in the body.
 */

export type SecurityEmailKind =
  | "mfa_enrollment_code"
  | "mfa_enabled"
  | "mfa_untrusted_removed"
  | "device_confirmation"
  | "device_removal_code"
  | "device_removed"
  | "session_signed_out";

export type SecurityEmailOutcome = "sent" | "unconfigured" | "failed";

function layout(heading: string, paragraphs: string[]) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17202a;line-height:1.5">
<h2 style="margin:0 0 12px">${heading}</h2>
${paragraphs.map((text) => `<p style="margin:0 0 12px">${text}</p>`).join("\n")}
<p style="margin:16px 0 0;color:#6a7483;font-size:12px">Event Core security notice. You cannot reply to this email.</p>
</body></html>`;
}

export function enrollmentCodeEmail(input: { name: string; code: string }) {
  return {
    subject: `${input.code} is your Event Core verification code`,
    html: layout("Verify it's you", [
      `Hi ${escapeHtml(input.name)},`,
      `Your verification code to set up two-factor authentication is:`,
      `<strong style="font-size:24px;letter-spacing:6px">${escapeHtml(input.code)}</strong>`,
      `It expires in 10 minutes and works once.`,
      `If you did not try to set up two-factor authentication, someone may know your password. Change it now from My Account.`
    ])
  };
}

export function mfaEnabledEmail(input: { name: string }) {
  return {
    subject: "Two-factor authentication was turned on",
    html: layout("Two-factor authentication is on", [
      `Hi ${escapeHtml(input.name)},`,
      `An authenticator app was just set up on your Event Core account. From now on, signing in needs a code from that app.`,
      `If this was not you, change your password immediately and contact your administrator.`
    ])
  };
}

export function untrustedFactorEmail(input: { name: string }) {
  return {
    subject: "Security alert: an authenticator was removed from your account",
    html: layout("An unverified authenticator was removed", [
      `Hi ${escapeHtml(input.name)},`,
      `An authenticator app was added to your Event Core account without the email verification step, so we removed it.`,
      `If you were setting up two-factor authentication yourself, the setup took too long or was interrupted - start it again from My Account.`,
      `If it was not you, someone knows your password. Change it now and tell your administrator.`
    ])
  };
}

/**
 * "A new device signed in to your account" - with the code that confirms it.
 *
 * Only approximate, non-secret details: the browser as the device reported
 * it, the place the edge resolved (city/region/country - never the IP), and
 * the time in UTC.
 */
export function deviceConfirmationEmail(input: {
  name: string;
  code: string;
  device: string | null;
  place: string | null;
  when: Date;
}) {
  return {
    subject: "New sign-in to your Event Core account - confirm this device",
    html: layout("Is this you signing in?", [
      `Hi ${escapeHtml(input.name)},`,
      `Your Event Core account was just signed in from a device we have not seen before:`,
      [
        `<strong>Device:</strong> ${escapeHtml(input.device ?? "Unknown browser")}`,
        `<strong>Approximate location:</strong> ${escapeHtml(input.place ?? "Unknown")}`,
        `<strong>Time:</strong> ${escapeHtml(input.when.toUTCString())}`
      ].join("<br>"),
      `If this was you, confirm the device by entering this code in Event Core:`,
      `<strong style="font-size:24px;letter-spacing:6px">${escapeHtml(input.code)}</strong>`,
      `It expires in 10 minutes and works once.`,
      `<strong>If this was not you, reset your password and contact your administrator.</strong>`
    ])
  };
}

/**
 * "Confirm removing a device" - the code that authorizes removing ONE named
 * device from the account. Names the device so the owner knows which one they
 * are approving.
 */
export function deviceRemovalCodeEmail(input: {
  name: string;
  code: string;
  device: string | null;
}) {
  return {
    subject: `${input.code} is your code to remove a device`,
    html: layout("Confirm removing a device", [
      `Hi ${escapeHtml(input.name)},`,
      `Someone signed in to your Event Core account asked to remove this device:`,
      `<strong>Device:</strong> ${escapeHtml(input.device ?? "Unknown browser")}`,
      `Enter this code in Event Core to remove it:`,
      `<strong style="font-size:24px;letter-spacing:6px">${escapeHtml(input.code)}</strong>`,
      `It expires in 10 minutes and works once.`,
      `<strong>If this was not you, do not share this code. Change your password and contact your administrator.</strong>`
    ])
  };
}

/** After the fact: a device was removed and signed out. */
export function deviceRemovedEmail(input: {
  name: string;
  device: string | null;
  when: Date;
}) {
  return {
    subject: "A device was removed from your Event Core account",
    html: layout("A device was removed", [
      `Hi ${escapeHtml(input.name)},`,
      `This device was removed from your Event Core account and signed out:`,
      [
        `<strong>Device:</strong> ${escapeHtml(input.device ?? "Unknown browser")}`,
        `<strong>Time:</strong> ${escapeHtml(input.when.toUTCString())}`
      ].join("<br>"),
      `To use Event Core on it again, it will need to be verified as a new device.`,
      `<strong>If you did not do this, change your password and contact your administrator.</strong>`
    ])
  };
}

/**
 * One of the person's sessions was signed out from another of their devices.
 * The device stays trusted - only that sign-in ended - which the email says,
 * so "signed out" is not read as "removed".
 */
export function sessionSignedOutEmail(input: {
  name: string;
  device: string | null;
  by: string | null;
  when: Date;
}) {
  return {
    subject: "A device was signed out of your Event Core account",
    html: layout("A device was signed out", [
      `Hi ${escapeHtml(input.name)},`,
      `One of your sessions was signed out from another device:`,
      [
        `<strong>Signed out:</strong> ${escapeHtml(input.device ?? "Unknown browser")}`,
        `<strong>Signed out from:</strong> ${escapeHtml(input.by ?? "Unknown browser")}`,
        `<strong>Time:</strong> ${escapeHtml(input.when.toUTCString())}`
      ].join("<br>"),
      `That device can sign in again with your password. To stop it being trusted, remove it from My Account.`,
      `<strong>If you did not do this, change your password and contact your administrator.</strong>`
    ])
  };
}

/**
 * Send one, and report how it went instead of throwing. A security alert that
 * fails to send must never undo the security decision it describes.
 */
export async function sendSecurityEmail(
  kind: SecurityEmailKind,
  to: string,
  email: { subject: string; html: string }
): Promise<SecurityEmailOutcome> {
  try {
    const accepted = await sendTransactionalEmail({ to, ...email });

    if (!accepted) {
      log.warn({ kind }, "security_email_provider_not_configured");
      return "unconfigured";
    }

    log.info({ kind }, "security_email_sent");
    return "sent";
  } catch (error) {
    log.warn({ kind, err: String(error) }, "security_email_failed");
    return "failed";
  }
}
