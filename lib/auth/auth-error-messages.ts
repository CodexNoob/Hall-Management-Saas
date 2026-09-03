const INCORRECT_CREDENTIALS = "Incorrect email or password. Please try again.";
const EMAIL_NOT_CONFIRMED =
  "Please confirm your email address before signing in.";
const RATE_LIMITED = "Too many attempts. Please wait a moment and try again.";
const ACCOUNT_DISABLED =
  "This account has been disabled. Contact your organization administrator.";
const GENERIC_SIGN_IN_FAILURE = "Unable to sign in. Please try again.";
const EMAIL_ALREADY_REGISTERED =
  "An account with this email already exists. Please sign in instead.";
const WEAK_PASSWORD =
  "That password is too weak. Use at least 8 characters, including a letter and a number.";
const INVALID_EMAIL = "Please enter a valid email address.";
const SIGN_UP_DISABLED =
  "New accounts are not being accepted right now. Please contact support.";
const EMAIL_SEND_COOLDOWN =
  "We just sent an email to this address. Please wait a minute before trying again.";
const EMAIL_SEND_RATE_LIMITED =
  "We are temporarily unable to send confirmation emails. Please try again in a little while.";
const EMAIL_NOT_AUTHORIZED =
  "We are unable to send a confirmation email to this address. This is a problem on our end, not yours - please contact support.";
const GENERIC_SIGN_UP_FAILURE = "Unable to create your account. Please try again.";

export const AUTH_ERROR_MESSAGES = {
  incorrectCredentials: INCORRECT_CREDENTIALS,
  emailNotConfirmed: EMAIL_NOT_CONFIRMED,
  rateLimited: RATE_LIMITED,
  accountDisabled: ACCOUNT_DISABLED,
  genericSignInFailure: GENERIC_SIGN_IN_FAILURE,
  emailAlreadyRegistered: EMAIL_ALREADY_REGISTERED,
  weakPassword: WEAK_PASSWORD,
  invalidEmail: INVALID_EMAIL,
  signUpDisabled: SIGN_UP_DISABLED,
  emailSendCooldown: EMAIL_SEND_COOLDOWN,
  emailSendRateLimited: EMAIL_SEND_RATE_LIMITED,
  emailNotAuthorized: EMAIL_NOT_AUTHORIZED,
  genericSignUpFailure: GENERIC_SIGN_UP_FAILURE
} as const;

const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: INCORRECT_CREDENTIALS,
  invalid_grant: INCORRECT_CREDENTIALS,
  email_not_confirmed: EMAIL_NOT_CONFIRMED,
  over_request_rate_limit: RATE_LIMITED,
  over_email_send_rate_limit: RATE_LIMITED,
  user_banned: ACCOUNT_DISABLED
};

const SIGN_UP_MESSAGES_BY_CODE: Record<string, string> = {
  user_already_exists: EMAIL_ALREADY_REGISTERED,
  email_exists: EMAIL_ALREADY_REGISTERED,
  weak_password: WEAK_PASSWORD,
  email_address_invalid: INVALID_EMAIL,
  validation_failed: INVALID_EMAIL,
  signup_disabled: SIGN_UP_DISABLED,
  email_provider_disabled: SIGN_UP_DISABLED,
  over_request_rate_limit: RATE_LIMITED
};

/**
 * The three ways GoTrue refuses to mail a confirmation link. Two of them share
 * the `over_email_send_rate_limit` code and are told apart only by the message,
 * so this has to be consulted before the code map short-circuits - and before
 * the "email address" substring test below, which would otherwise flatten an
 * unauthorized address into "please enter a valid email address" and send the
 * owner hunting for a typo that is not there.
 *
 * - "For security purposes, you can only request this after 51 seconds."
 *   The per-address cooldown. Waiting really does clear it, so the copy may
 *   say so.
 * - "Email rate limit exceeded" / a bare `over_email_send_rate_limit`.
 *   The project-wide hourly quota, spent by *any* address. Telling the owner
 *   to wait a minute and retry is wrong twice over, which is why this no
 *   longer shares copy with the cooldown above.
 * - `email_address_not_authorized`.
 *   Supabase's built-in mail service refusing every address that is not a
 *   member of the Supabase organization. No amount of retrying clears it; the
 *   project needs custom SMTP. See docs/supabase-auth-configuration.md §7.
 */
function getEmailDeliveryMessage(code: string, normalized: string) {
  if (
    code === "email_address_not_authorized" ||
    normalized.includes("not authorized")
  ) {
    return EMAIL_NOT_AUTHORIZED;
  }

  if (normalized.includes("security purposes")) {
    return EMAIL_SEND_COOLDOWN;
  }

  if (
    code === "over_email_send_rate_limit" ||
    normalized.includes("email rate limit")
  ) {
    return EMAIL_SEND_RATE_LIMITED;
  }

  return null;
}

/**
 * Copy for the two refusals that end a session outright, keyed by the code
 * `/api/auth/session` returns (lib/auth/errors.ts).
 *
 * Restated here rather than passed through the URL from the server: the login
 * page reads the reason off its own query string, so carrying prose would let
 * anyone put arbitrary text on a sign-in form. Only a code from this table
 * renders, and everything else renders nothing.
 */
const REJECTION_MESSAGES_BY_REASON: Record<string, string> = {
  invitation_required:
    "No employee account was found for that email. Ask your organization administrator for an invitation, then sign in with the address they invited.",
  account_deactivated:
    "This account has been deactivated. Ask your organization administrator to restore it."
};

export function getAuthRejectionMessage(reason: string | null | undefined) {
  if (!reason) return null;

  return REJECTION_MESSAGES_BY_REASON[reason] ?? null;
}

type AuthErrorLike = {
  code?: unknown;
  status?: unknown;
  message?: unknown;
};

function readAuthErrorLike(error: unknown): AuthErrorLike {
  if (typeof error === "string") {
    return { message: error };
  }

  if (typeof error === "object" && error !== null) {
    return error as AuthErrorLike;
  }

  return {};
}

/**
 * Turns a Supabase auth failure (or any thrown sign-in error) into copy that is
 * safe to show an employee. Supabase surfaces developer-facing strings such as
 * "Invalid login credentials", which should never reach the login form.
 */
export function getAuthErrorMessage(
  error: unknown,
  fallback: string = GENERIC_SIGN_IN_FAILURE
): string {
  const { code, status, message } = readAuthErrorLike(error);

  if (typeof code === "string") {
    const mappedByCode = MESSAGES_BY_CODE[code];

    if (mappedByCode) {
      return mappedByCode;
    }
  }

  const rawMessage = typeof message === "string" ? message.trim() : "";
  const normalized = rawMessage.toLowerCase();

  // Checked before `status` because the message is the more specific signal:
  // an unconfirmed email and a bad password both come back as HTTP 400.
  if (normalized) {
    if (
      normalized.includes("invalid login credentials") ||
      normalized.includes("invalid credentials")
    ) {
      return INCORRECT_CREDENTIALS;
    }

    if (normalized.includes("email not confirmed")) {
      return EMAIL_NOT_CONFIRMED;
    }

    if (normalized.includes("rate limit")) {
      return RATE_LIMITED;
    }
  }

  if (typeof status === "number") {
    if (status === 429) {
      return RATE_LIMITED;
    }

    if (status === 400 || status === 422) {
      return INCORRECT_CREDENTIALS;
    }
  }

  // Preserves genuinely useful server copy, e.g. the /api/auth/session 403
  // "No employee account was found for this email..." message.
  return rawMessage || fallback;
}

/**
 * The sign-up counterpart. Deliberately not `getAuthErrorMessage`: that one
 * treats HTTP 400/422 as bad credentials, which is the wrong story for sign-up,
 * where the same status covers an already-registered address, a rejected
 * password, and a malformed email.
 */
export function getSignUpErrorMessage(
  error: unknown,
  fallback: string = GENERIC_SIGN_UP_FAILURE
): string {
  const { code, status, message } = readAuthErrorLike(error);
  const rawMessage = typeof message === "string" ? message.trim() : "";
  const normalized = rawMessage.toLowerCase();

  const deliveryFailure = getEmailDeliveryMessage(
    typeof code === "string" ? code : "",
    normalized
  );

  if (deliveryFailure) {
    return deliveryFailure;
  }

  if (typeof code === "string") {
    const mappedByCode = SIGN_UP_MESSAGES_BY_CODE[code];

    if (mappedByCode) {
      return mappedByCode;
    }
  }

  if (normalized) {
    if (
      normalized.includes("already registered") ||
      normalized.includes("already been registered") ||
      normalized.includes("already exists") ||
      normalized.includes("user already")
    ) {
      return EMAIL_ALREADY_REGISTERED;
    }

    if (normalized.includes("password")) {
      return WEAK_PASSWORD;
    }

    if (
      normalized.includes("invalid email") ||
      normalized.includes("email address") ||
      normalized.includes("unable to validate email")
    ) {
      return INVALID_EMAIL;
    }

    if (normalized.includes("rate limit")) {
      return RATE_LIMITED;
    }

    if (normalized.includes("signups not allowed") || normalized.includes("signup is disabled")) {
      return SIGN_UP_DISABLED;
    }
  }

  if (typeof status === "number" && (status === 429 || status === 422)) {
    return status === 429 ? RATE_LIMITED : INVALID_EMAIL;
  }

  // Keeps actionable server copy rather than flattening it to generic text.
  return rawMessage || fallback;
}
