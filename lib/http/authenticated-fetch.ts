"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getCachedSyncedUser } from "@/lib/auth/client";

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
  const activeOrganizationId = getCachedSyncedUser()?.activeOrganizationId;

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

  return fetch(input, { ...init, headers });
}
