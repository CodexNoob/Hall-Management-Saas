const INCORRECT_CREDENTIALS = "Incorrect email or password. Please try again.";
const EMAIL_NOT_CONFIRMED =
  "Please confirm your email address before signing in.";
const RATE_LIMITED = "Too many attempts. Please wait a moment and try again.";
const ACCOUNT_DISABLED =
  "This account has been disabled. Contact your organization administrator.";
const GENERIC_SIGN_IN_FAILURE = "Unable to sign in. Please try again.";

export const AUTH_ERROR_MESSAGES = {
  incorrectCredentials: INCORRECT_CREDENTIALS,
  emailNotConfirmed: EMAIL_NOT_CONFIRMED,
  rateLimited: RATE_LIMITED,
  accountDisabled: ACCOUNT_DISABLED,
  genericSignInFailure: GENERIC_SIGN_IN_FAILURE
} as const;

const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: INCORRECT_CREDENTIALS,
  invalid_grant: INCORRECT_CREDENTIALS,
  email_not_confirmed: EMAIL_NOT_CONFIRMED,
  over_request_rate_limit: RATE_LIMITED,
  over_email_send_rate_limit: RATE_LIMITED,
  user_banned: ACCOUNT_DISABLED
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

  // Preserves genuinely useful server copy, e.g. the /api/auth/sync-user 403
  // "No employee account was found for this email..." message.
  return rawMessage || fallback;
}
