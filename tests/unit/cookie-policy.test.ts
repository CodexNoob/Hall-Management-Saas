import { describe, expect, it } from "vitest";
import {
  REMEMBER_AUTH_DAYS,
  authCookieMaxAge,
  isRememberWindowExpired,
  isSupabaseAuthCookieName,
  isSupabaseSessionCookieName,
  mergeAuthCookieOptions,
  nextRememberUntil,
  preferenceCookieMaxAge,
  shouldPersistAuthSession
} from "@/lib/supabase/cookie-policy";

const NOW = 1_700_000_000_000;
const DAY_S = 24 * 60 * 60;
const REMEMBER_WINDOW_S = REMEMBER_AUTH_DAYS * DAY_S;

describe("auth cookie lifetime policy", () => {
  it("persists when no preference was ever recorded", () => {
    // The load-bearing default. The old storage adapter persisted unless the
    // preference was exactly "false", and the trial sign-up form never records
    // one at all - so treating absent as a session cookie would sign out every
    // new owner as soon as they closed the browser.
    expect(shouldPersistAuthSession(undefined)).toBe(true);
    expect(authCookieMaxAge(undefined, undefined, NOW)).toBe(400 * DAY_S);
  });

  it("treats an explicit opt-out as a session cookie", () => {
    expect(shouldPersistAuthSession("false")).toBe(false);
    expect(authCookieMaxAge("false", undefined, NOW)).toBeUndefined();
    expect(authCookieMaxAge("false", String(NOW + 1000), NOW)).toBeUndefined();
  });

  it("returns the remaining window, not a flat 30 days, once remembered", () => {
    // Supabase rewrites the auth cookie on every refresh. A flat Max-Age would
    // renew the window forever and turn "remember me for 30 days" into
    // "remember me indefinitely".
    const rememberUntil = String(NOW + 10 * DAY_S * 1000);

    expect(authCookieMaxAge("true", rememberUntil, NOW)).toBe(10 * DAY_S);
    expect(authCookieMaxAge("true", rememberUntil, NOW + 4 * DAY_S * 1000)).toBe(
      6 * DAY_S
    );
  });

  it("falls back to the full window when rememberUntil is missing or junk", () => {
    expect(authCookieMaxAge("true", undefined, NOW)).toBe(REMEMBER_WINDOW_S);
    expect(authCookieMaxAge("true", "not-a-number", NOW)).toBe(REMEMBER_WINDOW_S);
    expect(authCookieMaxAge("true", "0", NOW)).toBe(REMEMBER_WINDOW_S);
  });

  it("clamps a skewed client clock in both directions", () => {
    // rememberUntil is stamped client-side, so a wrong clock must not be able to
    // buy more than the policy window or a negative Max-Age.
    expect(authCookieMaxAge("true", String(NOW + 900 * DAY_S * 1000), NOW)).toBe(
      REMEMBER_WINDOW_S
    );
    expect(authCookieMaxAge("true", String(NOW - DAY_S * 1000), NOW)).toBe(0);
  });

  it("applies the 30-day ceiling only to an explicit opt-in", () => {
    const past = String(NOW - 1000);

    expect(isRememberWindowExpired("true", past, NOW)).toBe(true);
    expect(isRememberWindowExpired("true", String(NOW + 1000), NOW)).toBe(false);
    // An absent or opted-out preference has no ceiling to expire.
    expect(isRememberWindowExpired(undefined, past, NOW)).toBe(false);
    expect(isRememberWindowExpired("false", past, NOW)).toBe(false);
  });

  it("expires the preference cookies alongside the session they govern", () => {
    expect(preferenceCookieMaxAge(true)).toBe(REMEMBER_WINDOW_S);
    expect(preferenceCookieMaxAge(false)).toBeUndefined();
    expect(Number(nextRememberUntil(NOW))).toBe(NOW + REMEMBER_WINDOW_S * 1000);
  });
});

describe("supabase auth cookie names", () => {
  it("matches the token, its chunks and the PKCE verifier", () => {
    expect(isSupabaseAuthCookieName("sb-abcdef-auth-token")).toBe(true);
    expect(isSupabaseAuthCookieName("sb-abcdef-auth-token.0")).toBe(true);
    expect(isSupabaseAuthCookieName("sb-abcdef-auth-token.11")).toBe(true);
    expect(isSupabaseAuthCookieName("sb-abcdef-auth-token-code-verifier")).toBe(
      true
    );
  });

  it("does not match unrelated cookies", () => {
    expect(isSupabaseAuthCookieName("event-core.auth.remember")).toBe(false);
    expect(isSupabaseAuthCookieName("event-core.activeOrg")).toBe(false);
    expect(isSupabaseAuthCookieName("sb-auth-token")).toBe(false);
  });

  /**
   * The verifier is written before a session exists and survives the whole
   * redirect to the OAuth provider. Counting it as a session would show the
   * marketing navbar's "Dashboard" CTA to anyone who started a social sign-in
   * and walked away.
   */
  it("excludes the PKCE verifier from the session-bearing subset", () => {
    expect(isSupabaseSessionCookieName("sb-abcdef-auth-token")).toBe(true);
    expect(isSupabaseSessionCookieName("sb-abcdef-auth-token.0")).toBe(true);
    expect(
      isSupabaseSessionCookieName("sb-abcdef-auth-token-code-verifier")
    ).toBe(false);
    expect(isSupabaseSessionCookieName("event-core.activeOrg")).toBe(false);
  });
});

describe("cookie option merging", () => {
  const supabaseOptions = {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: false,
    maxAge: 400 * DAY_S,
    expires: new Date(NOW)
  };

  it("forces Max-Age=0 for a deletion regardless of the remembered window", () => {
    // auth-js signals removal with an empty value. Letting the lifetime through
    // would turn a sign-out into a 30-day empty cookie that lingers in the jar.
    const merged = mergeAuthCookieOptions(
      supabaseOptions,
      "",
      true,
      REMEMBER_WINDOW_S
    );

    expect(merged.maxAge).toBe(0);
    expect(merged.expires).toBeUndefined();
  });

  it("drops both maxAge and expires for a session cookie", () => {
    // `maxAge: undefined` alone is not enough - a surviving `expires` would make
    // the cookie persistent anyway.
    const merged = mergeAuthCookieOptions(
      supabaseOptions,
      "token-value",
      true,
      undefined
    );

    expect(merged.maxAge).toBeUndefined();
    expect("maxAge" in merged).toBe(false);
    expect("expires" in merged).toBe(false);
  });

  it("keeps Max-Age as the single source of truth when persisting", () => {
    const merged = mergeAuthCookieOptions(
      supabaseOptions,
      "token-value",
      true,
      1234
    );

    expect(merged.maxAge).toBe(1234);
    expect("expires" in merged).toBe(false);
  });

  it("never sets HttpOnly, and takes Secure from the caller's origin", () => {
    // HttpOnly would break the browser client, which reads these through
    // document.cookie. Secure must follow the live protocol so Playwright's
    // http://127.0.0.1:3000 does not silently drop the cookie.
    const secure = mergeAuthCookieOptions(supabaseOptions, "v", true, 60);
    const insecure = mergeAuthCookieOptions(supabaseOptions, "v", false, 60);

    expect(secure.httpOnly).toBe(false);
    expect(secure.secure).toBe(true);
    expect(insecure.secure).toBe(false);
    expect(secure.sameSite).toBe("lax");
    expect(secure.path).toBe("/");
  });
});
