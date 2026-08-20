"use client";

import { useEffect, useState } from "react";
import { hasAuthSessionCookie } from "@/lib/supabase/browser";

/**
 * "pending" is a real state, not a placeholder for false.
 *
 * The marketing pages are prerendered, so the server has no session to render
 * against and the first client render must match that markup or React discards
 * the tree with a hydration mismatch. Callers therefore get "pending" on the
 * server and on the first paint, and the answer one effect later - which is
 * synchronous cookie reading, so a single frame, with no network in between.
 */
export type AuthPresence = "pending" | "authenticated" | "anonymous";

function read(): AuthPresence {
  return hasAuthSessionCookie() ? "authenticated" : "anonymous";
}

/**
 * Whether the visitor to a public page is signed in, for deciding what to offer
 * them - never for deciding what they may see.
 *
 * This is a cookie sniff (see `hasAuthSessionCookie`), so it is advisory by
 * construction: it is trivially forgeable and it is not authorization. Every
 * page it guards is public, and the destination it points at is gated by
 * proxy.ts and by the dashboard's own checks.
 */
export function useAuthPresence(): AuthPresence {
  const [presence, setPresence] = useState<AuthPresence>("pending");

  useEffect(() => {
    const resolve = () => setPresence(read());

    resolve();

    // Signing out in another tab, or backing onto this page from the dashboard
    // after signing out there. The latter can be served from the bfcache with
    // the old React state intact, and `pageshow` is the only event that fires
    // for it.
    const onVisibility = () => {
      if (document.visibilityState === "visible") resolve();
    };

    window.addEventListener("focus", resolve);
    window.addEventListener("pageshow", resolve);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", resolve);
      window.removeEventListener("pageshow", resolve);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return presence;
}
