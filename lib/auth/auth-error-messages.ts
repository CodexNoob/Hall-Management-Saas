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
const EMAIL_SEND_RATE_LIMITED =
  "We just sent an email to this address. Please wait a minute before trying again.";
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
  emailSendRateLimited: EMAIL_SEND_RATE_LIMITED,
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
  over_email_send_rate_limit: EMAIL_SEND_RATE_LIMITED,
  over_request_rate_limit: RATE_LIMITED
};

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

  if (typeof code === "string") {
    const mappedByCode = SIGN_UP_MESSAGES_BY_CODE[code];

    if (mappedByCode) {
      return mappedByCode;
    }
  }

  const rawMessage = typeof message === "string" ? message.trim() : "";
  const normalized = rawMessage.toLowerCase();

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

    // Email-send throttling is its own message: "wait a minute" is actionable,
    // whereas the generic rate-limit copy reads like the account was rejected.
    if (
      normalized.includes("email rate limit") ||
      normalized.includes("security purposes")
    ) {
      return EMAIL_SEND_RATE_LIMITED;
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
