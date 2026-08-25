"use client";

import type { Provider } from "@supabase/supabase-js";
import {
  clearAuthSessionCookies,
  createSupabaseBrowserClient,
  setActiveOrganizationCookie
} from "@/lib/supabase/browser";
import { isAuthSessionResponse } from "@/lib/auth/session-context";
import { MVP_LANDING_ROUTE } from "@/lib/ui/mvp-features";

// The response shape is owned by lib/auth/session-context.ts, which is also what
// the route serializes through. Re-exported rather than restated so the two
// cannot drift - they did, three ways, before that module existed.
export type {
  SessionUser,
  SessionOrganization,
  AuthSessionResponse
} from "@/lib/auth/session-context";

import type { AuthSessionResponse } from "@/lib/auth/session-context";

const AUTH_SESSION_CACHE_KEY = "hms.authSession";
const AUTH_SESSION_SUBJECT_KEY = "hms.authSession.subject";
const AUTH_SESSION_FETCHED_AT_KEY = "hms.authSession.fetchedAt";
const SESSION_FETCH_TIMEOUT_MS = 12000;
const SESSION_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

let fetchInFlight: {
  subject: string | null;
  promise: Promise<AuthSessionResponse>;
} | null = null;

function getAccessTokenSubject(accessToken: string) {
  try {
    const encodedPayload = accessToken.split(".")[1];
    if (!encodedPayload) return null;

    const normalizedPayload = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(normalizedPayload)) as {
      sub?: unknown;
    };

    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function cacheAuthSession(
  authSession: AuthSessionResponse,
  subject?: string | null
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = JSON.stringify(authSession);
  window.localStorage.setItem(AUTH_SESSION_CACHE_KEY, payload);
  window.sessionStorage.setItem(AUTH_SESSION_CACHE_KEY, payload);
  window.localStorage.setItem(AUTH_SESSION_FETCHED_AT_KEY, String(Date.now()));
  // Written here rather than at the two call sites, so the cookie the server
  // scopes by cannot drift from the cached value the client renders from.
  setActiveOrganizationCookie(authSession.activeOrganizationId);

  if (subject) {
    window.localStorage.setItem(AUTH_SESSION_SUBJECT_KEY, subject);
  }
}

export function setActiveOrganization(organizationId: string) {
  const authSession = getCachedAuthSession();

  if (
    !authSession?.organizations.some(
      (organization) => organization.id === organizationId
    )
  ) {
    throw new Error("You do not have access to that organization.");
  }

  cacheAuthSession({ ...authSession, activeOrganizationId: organizationId });
}

export function getCachedAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSyncData =
    window.localStorage.getItem(AUTH_SESSION_CACHE_KEY) ??
    window.sessionStorage.getItem(AUTH_SESSION_CACHE_KEY);

  if (!rawSyncData) {
    return null;
  }

  try {
    const authSession = JSON.parse(rawSyncData) as unknown;
    return isAuthSessionResponse(authSession) ? authSession : null;
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_CACHE_KEY);
    window.sessionStorage.removeItem(AUTH_SESSION_CACHE_KEY);
    window.localStorage.removeItem(AUTH_SESSION_SUBJECT_KEY);
    window.localStorage.removeItem(AUTH_SESSION_FETCHED_AT_KEY);
    return null;
  }
}

export function clearCachedAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_CACHE_KEY);
  window.sessionStorage.removeItem(AUTH_SESSION_CACHE_KEY);
  window.localStorage.removeItem(AUTH_SESSION_SUBJECT_KEY);
  window.localStorage.removeItem(AUTH_SESSION_FETCHED_AT_KEY);
  // Only the organization hint. The Remember me preference is deliberately left
  // alone: this also runs on a transient sync failure, and wiping the
  // preference there would silently downgrade a 30-day session.
  setActiveOrganizationCookie(null);
}

/**
 * The single sign-out path. Both call sites used to inline this, and only the
 * Supabase half - which left `event-core.auth.remember`,
 * `event-core.auth.rememberUntil` and `event-core.activeOrg` behind for the
 * next person to sign in on the same browser.
 *
 * `scope: "local"` ends this device's session only. Revoking every session for
 * the account is a separate, deliberate action in the security settings panel.
 */
export async function signOutCurrentSession() {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) throw error;

  clearCachedAuthSession();
  clearAuthSessionCookies();
}

export function fetchAuthSession(
  accessToken: string,
  options: { force?: boolean } = {}
) {
  const subject = getAccessTokenSubject(accessToken);
  const cachedUser = getCachedAuthSession();
  const cachedSubject = window.localStorage.getItem(AUTH_SESSION_SUBJECT_KEY);
  const cachedAt = Number(
    window.localStorage.getItem(AUTH_SESSION_FETCHED_AT_KEY) ?? 0
  );
  const cacheIsFresh =
    cachedAt > 0 && Date.now() - cachedAt < SESSION_CACHE_MAX_AGE_MS;

  if (
    !options.force &&
    cachedUser &&
    cacheIsFresh &&
    subject &&
    cachedSubject === subject
  ) {
    return Promise.resolve(cachedUser);
  }

  if (fetchInFlight && fetchInFlight.subject === subject) {
    return fetchInFlight.promise;
  }

  const promise = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      SESSION_FETCH_TIMEOUT_MS
    );

    const response = await fetch("/api/auth/session", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }).finally(() => window.clearTimeout(timeoutId));

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(
        payload?.error ??
          "Unable to sync the signed-in user with the Hall Management database."
      );
    }

    const authSession = (await response.json()) as AuthSessionResponse;
    cacheAuthSession(authSession, subject);
    return authSession;
  })();

  fetchInFlight = { subject, promise };
  const clearInFlight = () => {
    if (fetchInFlight?.promise === promise) {
      fetchInFlight = null;
    }
  };
  void promise.then(clearInFlight, clearInFlight);

  return promise;
}

/**
 * Records that the signed-in user now owns a password of their own. The password
 * itself is changed client-side through supabase.auth.updateUser, which the
 * server cannot observe, so it has to be told separately.
 */
export async function markPasswordSet(accessToken: string) {
  const response = await fetch("/api/auth/password-set", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      payload?.error ??
        "Your password was saved, but your account could not be updated."
    );
  }
}

export async function signInWithOAuthProvider(
  provider: Extract<Provider, "google" | "azure">,
  returnPath: string = MVP_LANDING_ROUTE
) {
  const supabase = createSupabaseBrowserClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo
    }
  });

  if (error) {
    throw error;
  }
}
