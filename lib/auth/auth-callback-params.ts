// Deliberately not a "use client" module. The parsing and copy below are shared
// with app/auth/confirm/route.ts, and a "use client" module imported from a
// route handler resolves to client reference proxies rather than the real
// functions - isAuthCallbackType would exist at build time and throw at request
// time. Nothing here touches React or the DOM outside a typeof window guard, so
// it is safe on both sides and client importers still get it bundled.
const authCallbackTypes = [
  "invite",
  "recovery",
  "signup",
  "magiclink",
  "email_change"
] as const;

/** The `type` of an email link, once it is known to be one we support. */
export type EmailAuthLinkType = (typeof authCallbackTypes)[number];

export type AuthCallbackType = EmailAuthLinkType | null;

export type AuthCallbackParams = {
  type: AuthCallbackType;
  errorCode: string | null;
  errorDescription: string | null;
  next: string | null;
};

const emptyParams: AuthCallbackParams = {
  type: null,
  errorCode: null,
  errorDescription: null,
  next: null
};

/**
 * Exported so /auth/confirm can validate `type` before handing it to
 * verifyOtp. That parameter arrives straight off the query string, so it is
 * attacker-controlled - narrow it against this list rather than casting.
 */
export function isAuthCallbackType(
  value: string | null | undefined
): value is EmailAuthLinkType {
  return Boolean(value && authCallbackTypes.includes(value as EmailAuthLinkType));
}

export function parseAuthCallbackParams(href: string): AuthCallbackParams {
  let url: URL;

  try {
    url = new URL(href);
  } catch {
    return emptyParams;
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const read = (key: string) =>
    url.searchParams.get(key) ?? hashParams.get(key);
  const type = read("type");

  return {
    type: isAuthCallbackType(type) ? type : null,
    errorCode: read("error_code"),
    errorDescription: read("error_description") ?? read("error") ?? null,
    next: url.searchParams.get("next")
  };
}

/**
 * Supabase reports a token that has passed its expiry, and one that was already
 * spent, with the same `otp_expired` code. A single-use link can be consumed by
 * a mail provider's link scanner before the recipient ever clicks it, so treat
 * both as "ask for a fresh invitation" rather than "retry this link".
 */
export function isExpiredLinkError(params: AuthCallbackParams) {
  return params.errorCode === "otp_expired";
}

/**
 * Ours, not GoTrue's. With Supabase's default "Secure email change" the first
 * confirmation returns `{ user, session: null }` and `error: null` - a success
 * that starts no session. Treating that as a win and redirecting to /dashboard
 * bounces the user back to login with nothing to explain it.
 */
export const CONFIRMATION_PENDING_ERROR_CODE = "confirmation_pending";

/**
 * Supabase drops `type` from the URL when it reports an error, so the message
 * cannot name the flow the link came from and has to cover both.
 */
export function describeAuthCallbackError(params: AuthCallbackParams) {
  if (isExpiredLinkError(params)) {
    return "This link has expired or was already used. Ask an administrator for a new invitation, or request a new password reset link.";
  }

  if (params.errorCode === CONFIRMATION_PENDING_ERROR_CODE) {
    return "Your email was confirmed, but you are not signed in yet. If you are changing your email address, open the confirmation link sent to the other address too. Otherwise, sign in to continue.";
  }

  return (
    params.errorDescription ??
    "This sign-in link could not be verified. Ask an administrator to send you a new invitation."
  );
}

let snapshot: AuthCallbackParams | null = null;

/**
 * Reads the auth parameters out of the current URL, from the query string or
 * the fragment. The fragment is the one that matters here: it never reaches the
 * server, so it is the only way a page can see the `#error=...&error_code=...`
 * that Supabase attaches when it rejects a link itself.
 *
 * Call this from a render body or module scope - never from an effect. The
 * Supabase browser client still has detectSessionInUrl on, so its constructor
 * asynchronously reads and strips the fragment, and every
 * createSupabaseBrowserClient() call happens in an effect or an event handler,
 * which is strictly after the first render.
 *
 * The result is memoized so it survives a soft navigation to /set-password,
 * where the hash is already gone.
 */
export function readAuthCallbackParams(): AuthCallbackParams {
  if (typeof window === "undefined") {
    return emptyParams;
  }

  snapshot ??= parseAuthCallbackParams(window.location.href);
  return snapshot;
}

export function isPasswordSetupFlow(type: AuthCallbackType) {
  return type === "invite" || type === "recovery";
}
