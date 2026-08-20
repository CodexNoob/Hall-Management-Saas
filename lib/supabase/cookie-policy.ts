/**
 * The single owner of Supabase auth-cookie lifetime rules.
 *
 * The browser client, the server client and the proxy all import this module so
 * the three can never disagree about a cookie's Max-Age. A disagreement is not
 * a crash - it is a user who is silently signed out early, or a "Remember me"
 * window that quietly renews forever.
 *
 * MUST stay dependency-free. It is imported by `proxy.ts`, which runs on every
 * navigation, and by a "use client" module - so it cannot reach `server-only`,
 * `next/headers`, `@/lib/env` (getEnv throws), or anything touching
 * `@/lib/prisma`.
 */

export const REMEMBER_AUTH_DAYS = 30;
export const REMEMBER_AUTH_COOKIE = "event-core.auth.remember";
export const REMEMBER_UNTIL_COOKIE = "event-core.auth.rememberUntil";
export const ACTIVE_ORGANIZATION_COOKIE = "event-core.activeOrg";

/**
 * Mirrors the `eventCoreDesktopApp` localStorage flag. The proxy runs before
 * any client code and cannot read localStorage, so without this mirror the
 * Electron shell would be bounced to the web sign-in page instead of
 * /login?desktop=1.
 */
export const DESKTOP_APP_COOKIE = "event-core.desktopApp";

const SECONDS_PER_DAY = 24 * 60 * 60;
export const REMEMBER_AUTH_DURATION_MS =
  REMEMBER_AUTH_DAYS * SECONDS_PER_DAY * 1000;
const REMEMBER_AUTH_DURATION_S = REMEMBER_AUTH_DAYS * SECONDS_PER_DAY;

/**
 * Matches @supabase/ssr's own DEFAULT_COOKIE_OPTIONS.maxAge (400 days, the
 * browser ceiling from rfc6265bis). Used when no preference was ever recorded,
 * which is the cookie equivalent of the old localStorage default.
 */
const DEFAULT_AUTH_COOKIE_MAX_AGE_S = 400 * SECONDS_PER_DAY;

/**
 * `sb-<ref>-auth-token`, its `.0`/`.1` chunks (@supabase/ssr splits at 3180
 * bytes), and the PKCE code verifier.
 */
export function isSupabaseAuthCookieName(name: string) {
  return /^sb-.+-auth-token(\.\d+|-code-verifier)?$/.test(name);
}

/**
 * The session-bearing subset of the above: the token cookie and its chunks, but
 * NOT the PKCE code verifier.
 *
 * The verifier is written *before* a session exists and outlives the redirect
 * to the OAuth provider, so a caller asking "is this browser signed in?" would
 * read it as yes for the whole round trip - and again for anyone who abandoned
 * a social sign-in halfway.
 *
 * `isSupabaseAuthCookieName` keeps matching it on purpose: sign-out and the
 * remember-window sweep must clear the verifier too.
 */
export function isSupabaseSessionCookieName(name: string) {
  return /^sb-.+-auth-token(\.\d+)?$/.test(name);
}

/**
 * Transliterated from the old shouldPersistAuthSession(): persist unless the
 * preference is *exactly* "false", so an ABSENT preference persists.
 *
 * This default is load-bearing. features/auth/components/signup-card.tsx
 * never calls setAuthSessionPersistence, so every trial sign-up arrives with no
 * preference at all. Treating absent as "session cookie" would sign out every
 * new owner the moment they close the browser.
 */
export function shouldPersistAuthSession(remember: string | undefined) {
  return remember !== "false";
}

/**
 * Transliterated from the old isRememberedAuthSessionExpired(): the 30-day
 * ceiling applies only when the user *explicitly* ticked Remember me, never to
 * the absent-preference default.
 */
export function isRememberWindowExpired(
  remember: string | undefined,
  rememberUntil: string | undefined,
  now = Date.now()
) {
  if (remember !== "true") return false;

  const expiresAt = Number(rememberUntil);
  return Number.isFinite(expiresAt) && expiresAt > 0 && now >= expiresAt;
}

/**
 * Max-Age in seconds for a Supabase auth cookie, or `undefined` for a session
 * cookie (the cookie equivalent of the old sessionStorage branch).
 *
 *   preference absent -> long-lived  (old behaviour: localStorage, no ceiling)
 *   "true"            -> seconds remaining in the 30-day window
 *   "false"           -> undefined   (old behaviour: sessionStorage)
 *
 * The "true" branch returns a SHRINKING window on purpose. Supabase rewrites
 * the auth cookie on every token refresh, so returning a flat 30 days would
 * renew the window forever and "Remember me for 30 days" would quietly become
 * "remember me indefinitely".
 */
export function authCookieMaxAge(
  remember: string | undefined,
  rememberUntil: string | undefined,
  now = Date.now()
): number | undefined {
  if (remember === "false") return undefined;
  if (remember !== "true") return DEFAULT_AUTH_COOKIE_MAX_AGE_S;

  const expiresAt = Number(rememberUntil);

  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    return REMEMBER_AUTH_DURATION_S;
  }

  // rememberUntil is stamped client-side, so a skewed clock could otherwise ask
  // for a window far beyond policy. Clamp to the 30-day ceiling in both
  // directions rather than honouring it.
  const remaining = Math.floor((expiresAt - now) / 1000);
  return Math.max(0, Math.min(remaining, REMEMBER_AUTH_DURATION_S));
}

export function nextRememberUntil(now = Date.now()) {
  return String(now + REMEMBER_AUTH_DURATION_MS);
}

/**
 * The preference cookies must expire alongside the auth cookie they govern. A
 * surviving `rememberUntil` from a previous session would sign a fresh session
 * out early.
 */
export function preferenceCookieMaxAge(remember: boolean) {
  return remember ? REMEMBER_AUTH_DURATION_S : undefined;
}

export type AuthCookieAttributes = {
  path: "/";
  sameSite: "lax";
  secure: boolean;
  httpOnly: false;
  maxAge?: number;
};

/**
 * Attributes for every Supabase auth cookie we write.
 *
 * `sameSite: "lax"` is required, not a preference: the OAuth return from the
 * provider and every emailed confirmation/invite/recovery link are cross-site
 * top-level GETs, and "strict" would withhold both the session cookie and the
 * PKCE code verifier on exactly those navigations.
 *
 * `httpOnly: false` is likewise forced - createBrowserClient reads these through
 * document.cookie, so making them HttpOnly breaks sign-in, MFA and sign-out.
 * Exposure to XSS is therefore unchanged from the previous localStorage
 * implementation; this migration is not a hardening of that surface.
 *
 * `domain` is deliberately never set. A host-only cookie is what makes Vercel
 * preview deployments work, and *.vercel.app is a public suffix, so a domain
 * cookie would be rejected outright.
 *
 * `secure` is passed in from the live request protocol, NEVER derived from
 * NODE_ENV: `next build && next start` over http sets NODE_ENV=production, and
 * Playwright drives http://127.0.0.1:3000. A Secure cookie is silently dropped
 * there, which yields an empty storageState and a pile of opaque e2e failures.
 */
export function authCookieAttributes(
  isSecure: boolean,
  maxAge: number | undefined
): AuthCookieAttributes {
  const base = {
    path: "/",
    sameSite: "lax",
    secure: isSecure,
    httpOnly: false
  } as const;

  return maxAge === undefined ? { ...base } : { ...base, maxAge };
}

/**
 * Merges our lifetime policy onto the options @supabase/ssr supplies for a
 * single cookie write.
 *
 * Three cases, and getting any of them wrong is a real bug:
 *  - deletion (auth-js signals it with an empty value): force Max-Age=0, or the
 *    lifetime below turns a sign-out into a 30-day empty cookie that lingers.
 *  - session cookie: BOTH maxAge and expires must go. `maxAge: undefined` alone
 *    does not produce a session cookie if an `expires` survives the spread.
 *  - persistent: drop `expires` so Max-Age is the single source of truth.
 */
export function mergeAuthCookieOptions<T extends Record<string, unknown>>(
  options: T,
  value: string,
  isSecure: boolean,
  maxAge: number | undefined
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...options,
    ...authCookieAttributes(isSecure, undefined)
  };

  delete merged.expires;

  if (value === "") {
    merged.maxAge = 0;
  } else if (maxAge !== undefined) {
    merged.maxAge = maxAge;
  } else {
    delete merged.maxAge;
  }

  return merged;
}
