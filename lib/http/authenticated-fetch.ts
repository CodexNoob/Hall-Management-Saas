"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getCachedAuthSession } from "@/lib/auth/client";

/**
 * Kept as a module and a signature rather than deleted, so the ~73 call sites
 * do not have to move.
 *
 * The `Authorization: Bearer` header is gone: the session now travels as a
 * cookie that the browser attaches to every same-origin request by itself, and
 * `lib/auth/server-auth.ts` reads it from there. Sending the token by hand as
 * well would just be a second copy of the same credential.
 *
 * The session check stays. It is not what authenticates the request any more -
 * the server does that - but it turns an expired session into one actionable
 * error at the call site instead of a 401 that each of the ~73 callers would
 * have to interpret for itself.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const headers = new Headers(init.headers);
  const activeOrganizationId = getCachedAuthSession()?.activeOrganizationId;

  // Still sent, and still wins over the cookie on the server. An explicit
  // header is unambiguous where the cookie is ambient, and removing it in the
  // same change that introduced the cookie resolver would silently rescope
  // every multi-organization user if the cookie were ever missing or stale.
  if (activeOrganizationId) {
    headers.set("X-Organization-Id", activeOrganizationId);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, { ...init, headers });

  await refreshSessionIfEpochAdvanced(response, data.session.access_token);

  return response;
}

/**
 * How a revoked permission takes effect without a sign-out.
 *
 * Every authorization-aware response carries the epoch its verdict was computed
 * under. If the server has moved past what this browser's cached session was
 * built from, the hints on screen are stale - so refetch the session, which is
 * one comparison here and one request at most per change.
 *
 * The response is peeked at through a CLONE. Reading the original body would
 * consume the stream the caller is about to read, and every one of the ~73 call
 * sites would get an empty payload.
 *
 * Deliberately best-effort: a failure here must never turn a successful request
 * into an error at the call site. The worst case is a browser that keeps showing
 * a button whose 403 it will discover on click, which is exactly what the
 * server-side re-decide exists to catch.
 */
async function refreshSessionIfEpochAdvanced(
  response: Response,
  accessToken: string
) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return;
  }

  try {
    const cached = getCachedAuthSession();
    if (!cached) return;

    const payload = (await response.clone().json()) as { epoch?: unknown };

    if (typeof payload.epoch !== "number" || payload.epoch <= cached.epoch) {
      return;
    }

    const { fetchAuthSession } = await import("@/lib/auth/client");
    await fetchAuthSession(accessToken, { force: true });
  } catch {
    // See the note above: never escalate a stale hint into a failed request.
  }
}
