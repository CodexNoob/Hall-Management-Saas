"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REMEMBER_AUTH_COOKIE,
  REMEMBER_AUTH_DAYS,
  REMEMBER_UNTIL_COOKIE,
  authCookieAttributes,
  authCookieMaxAge,
  isSupabaseAuthCookieName,
  mergeAuthCookieOptions,
  nextRememberUntil,
  preferenceCookieMaxAge
} from "@/lib/supabase/cookie-policy";

export { REMEMBER_AUTH_DAYS };

// Typed as SupabaseClient rather than ReturnType<typeof createBrowserClient>:
// createBrowserClient is an overloaded declaration, so ReturnType resolves
// against its deprecated overload and silently widens the client's members to
// `any` - which turns callers like the MFA panel's listFactors() into implicit
// any and loses every downstream type check.
let browserClient: SupabaseClient | null = null;

function isSecureOrigin() {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

/**
 * Symmetric with the `cookie` package's defaults, which is what @supabase/ssr
 * uses for its own document.cookie fallback and what Next.js uses on the server:
 * the value is percent-encoded, the name is not. Diverging here would make a
 * cookie written in the browser unreadable by the server client.
 */
function readCookies() {
  if (typeof document === "undefined") return [];

  return document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf("=");

      if (separator < 0) {
        return { name: entry, value: "" };
      }

      const name = entry.slice(0, separator);
      const rawValue = entry.slice(separator + 1);

      try {
        return { name, value: decodeURIComponent(rawValue) };
      } catch {
        return { name, value: rawValue };
      }
    });
}

function readCookie(name: string) {
  return readCookies().find((cookie) => cookie.name === name)?.value;
}

function writeCookie(name: string, value: string, maxAge: number | undefined) {
  if (typeof document === "undefined") return;

  const attributes = authCookieAttributes(isSecureOrigin(), maxAge);
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${attributes.path}`,
    "SameSite=Lax"
  ];

  if (attributes.secure) parts.push("Secure");
  if (attributes.maxAge !== undefined) parts.push(`Max-Age=${attributes.maxAge}`);

  document.cookie = parts.join("; ");
}

function currentAuthCookieMaxAge() {
  return authCookieMaxAge(
    readCookie(REMEMBER_AUTH_COOKIE),
    readCookie(REMEMBER_UNTIL_COOKIE)
  );
}

/**
 * Still called immediately BEFORE the sign-in call, exactly as it was
 * (features/auth/components/login-card.tsx:152 and :183): it decides the
 * lifetime of the auth cookie Supabase is about to write.
 *
 * Where the previous implementation moved `sb-*-auth-token` between
 * localStorage and sessionStorage, this writes a preference cookie that the
 * browser client, the server client and proxy.ts all consult - then re-stamps
 * any auth cookie that already exists, so toggling the checkbox takes effect on
 * a session that is already open. That re-stamp is the direct analogue of the
 * old storage-migration loop.
 */
export function setAuthSessionPersistence(remember: boolean) {
  if (typeof document === "undefined") return;

  const preferenceMaxAge = preferenceCookieMaxAge(remember);
  const rememberUntil = remember ? nextRememberUntil() : null;

  writeCookie(REMEMBER_AUTH_COOKIE, String(remember), preferenceMaxAge);

  if (rememberUntil) {
    writeCookie(REMEMBER_UNTIL_COOKIE, rememberUntil, preferenceMaxAge);
  } else {
    writeCookie(REMEMBER_UNTIL_COOKIE, "", 0);
  }

  const maxAge = authCookieMaxAge(String(remember), rememberUntil ?? undefined);

  for (const cookie of readCookies()) {
    if (isSupabaseAuthCookieName(cookie.name)) {
      writeCookie(cookie.name, cookie.value, maxAge);
    }
  }
}

// isRememberedAuthSessionExpired() lived here and was called from the dashboard
// guard, once on mount and again every 60 seconds. proxy.ts now enforces the
// 30-day ceiling on every navigation, before any component mounts, and the auth
// cookie's own Max-Age expires it in the browser regardless. Keeping a second
// client-side copy of the rule would only give it somewhere to drift.

function getSupabaseBrowserConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment."
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserConfig();

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: readCookies,
      setAll(cookiesToSet) {
        // Resolved per write, NOT once at construction. createBrowserClient
        // memoises a singleton and returns it for every later call, ignoring the
        // options passed in - so a `cookieOptions` lifetime captured here would
        // go stale the moment Remember me is toggled, and the checkbox would
        // silently do nothing.
        const maxAge = currentAuthCookieMaxAge();
        const secure = isSecureOrigin();

        for (const { name, value, options } of cookiesToSet) {
          const merged = mergeAuthCookieOptions(
            options as Record<string, unknown>,
            value,
            secure,
            maxAge
          );

          writeCookie(name, value, merged.maxAge as number | undefined);
        }
      }
    }
  });

  return browserClient;
}
