"use client";

const authCallbackTypes = [
  "invite",
  "recovery",
  "signup",
  "magiclink",
  "email_change"
] as const;

export type AuthCallbackType = (typeof authCallbackTypes)[number] | null;

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

function isAuthCallbackType(value: string | null): value is AuthCallbackType {
  return Boolean(
    value && authCallbackTypes.includes(value as (typeof authCallbackTypes)[number])
  );
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
 * Supabase drops `type` from the URL when it reports an error, so the message
 * cannot name the flow the link came from and has to cover both.
 */
export function describeAuthCallbackError(params: AuthCallbackParams) {
  if (isExpiredLinkError(params)) {
    return "This link has expired or was already used. Ask an administrator for a new invitation, or request a new password reset link.";
  }

  return (
    params.errorDescription ??
    "This sign-in link could not be verified. Ask an administrator to send you a new invitation."
  );
}

let snapshot: AuthCallbackParams | null = null;

/**
 * Supabase's browser client uses the default implicit flow with
 * detectSessionInUrl, so its constructor asynchronously reads and then strips
 * `#access_token=...&type=recovery` from the URL. Call this from a render body
 * or module scope - never from an effect - because every
 * createSupabaseBrowserClient() call happens in an effect or an event handler,
 * which is strictly after the first render.
 *
 * The result is memoized so it survives the soft navigation from
 * /auth/callback to /set-password, where the hash is already gone.
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
