"use client";

import type { Provider } from "@supabase/supabase-js";
import {
  clearAuthSessionCookies,
  createSupabaseBrowserClient,
  setActiveOrganizationCookie
} from "@/lib/supabase/browser";
import { isAuthSessionResponse } from "@/lib/auth/session-context";
import {
  ORGANIZATION_SIGNUP_INTENT,
  OWNER_INTENT_PARAM
} from "@/lib/auth/owner-signup";
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

/**
 * A refusal from /api/auth/session, carrying the status and the machine-readable
 * code the route now returns. Thrown instead of a bare Error so callers can tell
 * "this account may not be here" from "the request failed".
 */
export class AuthSessionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "AuthSessionError";
  }
}

/**
 * Whether the refusal is one that retrying can never clear.
 *
 * This distinction is load-bearing rather than cosmetic. A rejected account
 * still holds a perfectly valid Supabase session - Google authenticated the
 * person, we simply have no seat for them - and proxy.ts sends anyone holding a
 * session away from /login. Leaving that session in place strands them on the
 * dashboard's error card with a "Try again" that cannot succeed and no route
 * back to sign-in short of clearing cookies. So a terminal refusal must end the
 * Supabase session too; a 500 or a dropped connection must not.
 */
export function isTerminalAuthSessionError(
  error: unknown
): error is AuthSessionError {
  return (
    error instanceof AuthSessionError &&
    (error.status === 401 || error.status === 403)
  );
}

const AUTH_SESSION_CACHE_KEY = "hms.authSession";
const AUTH_SESSION_SUBJECT_KEY = "hms.authSession.subject";
const AUTH_SESSION_FETCHED_AT_KEY = "hms.authSession.fetchedAt";
const SESSION_FETCH_TIMEOUT_MS = 12000;
const SESSION_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

let fetchInFlight: {
  subject: string | null;
  promise: Promise<AuthSessionResponse>;
} | null = null;

/**
 * THE CACHE IS OBSERVABLE, and this is the half that was missing.
 *
 * `cacheAuthSession` wrote to localStorage and stopped there. Nothing could
 * notice, so a session refetched after an administrator granted a role updated
 * the storage and left every rendered component showing what it read at mount -
 * which is why the only way to see a new permission was to sign out and back in.
 *
 * Deliberately a listener set rather than a React context. This module is
 * imported from places that are not components at all (the fetch wrapper, the
 * realtime sync), and they have to be able to publish a change without one.
 */
const authSessionListeners = new Set<() => void>();

/**
 * A snapshot with a STABLE IDENTITY, which `useSyncExternalStore` requires.
 *
 * `getCachedAuthSession` parses the JSON on every call and therefore returns a
 * new object every time. Handing that to `useSyncExternalStore` is an infinite
 * render loop: React compares snapshots by reference, sees a different one each
 * pass, and re-renders forever. So the parsed value is held here and replaced
 * only when the underlying string actually differs.
 */
let snapshot: { raw: string | null; value: AuthSessionResponse | null } = {
  raw: null,
  value: null
};

function notifyAuthSessionListeners() {
  // The snapshot is invalidated rather than recomputed: the listeners are about
  // to read it, and recomputing here would parse the payload even when nothing
  // is currently subscribed.
  snapshot = { raw: null, value: null };

  for (const listener of authSessionListeners) listener();
}

/**
 * Subscribe to cached-session changes. Returns the unsubscribe function, in the
 * shape `useSyncExternalStore` expects.
 *
 * Also listens for `storage`, so a second tab that refetches after a permission
 * change updates this one too - the event does not fire in the tab that wrote
 * it, which is why the in-process listener set above exists as well.
 */
export function subscribeToAuthSession(listener: () => void) {
  authSessionListeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === AUTH_SESSION_CACHE_KEY) {
      snapshot = { raw: null, value: null };
      listener();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    authSessionListeners.delete(listener);

    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** The reference-stable snapshot. Never call this to READ - use it to SUBSCRIBE. */
export function getAuthSessionSnapshot(): AuthSessionResponse | null {
  if (typeof window === "undefined") return null;

  const raw =
    window.localStorage.getItem(AUTH_SESSION_CACHE_KEY) ??
    window.sessionStorage.getItem(AUTH_SESSION_CACHE_KEY);

  if (snapshot.raw === raw) return snapshot.value;

  snapshot = { raw, value: getCachedAuthSession() };

  return snapshot.value;
}

/** The server-render snapshot. There is no browser storage, so there is nothing. */
export function getAuthSessionServerSnapshot(): AuthSessionResponse | null {
  return null;
}

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

  // Everything reading permissions re-renders from here. Last, so a listener
  // that reads the cache synchronously sees the value that was just written.
  notifyAuthSessionListeners();
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
  notifyAuthSessionListeners();
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
        code?: string;
      } | null;
      throw new AuthSessionError(
        payload?.error ??
          "Unable to sync the signed-in user with the Hall Management database.",
        response.status,
        payload?.code
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

/**
 * "Continue with Google" signs in an identity we know and creates an account for
 * one we do not - the same button on both /login and /signup, because Google
 * draws no such distinction and neither does self-serve sign-up. A first Google
 * sign-in is therefore the OAuth twin of the /signup form, and gets what that
 * form gets: an organization and a trial.
 *
 * The two pages used to differ, and it read as broken. Password sign-in gets
 * away with the asymmetry because "no such account" is obvious at the form; an
 * OAuth round trip *succeeds*, so refusing it afterwards looks like a bug rather
 * than a policy.
 *
 * The flag still travels as a parameter rather than being assumed by the
 * callback, because /auth/callback also serves email links - invitations,
 * recovery, email changes - and none of those may provision anything.
 */
export async function signInWithOAuthProvider(
  provider: Extract<Provider, "google">,
  returnPath: string = MVP_LANDING_ROUTE
) {
  const supabase = createSupabaseBrowserClient();
  // Built with URL rather than concatenated: there are two parameters now, and
  // `next` is a path that carries its own encoding needs.
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", returnPath);
  callback.searchParams.set(OWNER_INTENT_PARAM, ORGANIZATION_SIGNUP_INTENT);

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callback.toString(),
      // Google signs the browser straight back in with whichever account it saw
      // last, with no prompt at all. That is the wrong default here: an invited
      // employee is expected under one work address, and anyone signed into a
      // personal account first would be authenticated as the wrong person -
      // which now means a second organization of their own rather than an error.
      // Choosing the account is the one thing that prevents it.
      queryParams: { prompt: "select_account" }
    }
  });

  if (error) {
    throw error;
  }
}
