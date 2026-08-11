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
  errorDescription: string | null;
  next: string | null;
};

const emptyParams: AuthCallbackParams = {
  type: null,
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
    errorDescription: read("error_description") ?? read("error") ?? null,
    next: url.searchParams.get("next")
  };
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
