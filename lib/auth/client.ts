"use client";

import type { Provider } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function syncSignedInUser(accessToken: string) {
  const response = await fetch("/api/auth/sync-user", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to sync the signed-in user with the Hall Management database.");
  }
}

export async function signInWithOAuthProvider(provider: Extract<Provider, "google" | "azure">) {
  const supabase = createSupabaseBrowserClient();
  const redirectTo = `${window.location.origin}/auth/callback`;

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
