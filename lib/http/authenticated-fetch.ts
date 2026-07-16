"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getCachedSyncedUser } from "@/lib/auth/client";

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
  headers.set("Authorization", `Bearer ${data.session.access_token}`);

  const activeOrganizationId = getCachedSyncedUser()?.activeOrganizationId;

  if (activeOrganizationId) {
    headers.set("X-Organization-Id", activeOrganizationId);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, { ...init, headers });
}
