"use client";

import { fetchAuthSession } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * "Go and ask the server what I may do now."
 *
 * THE ONE PLACE THE SESSION IS RE-READ. Realtime says a row moved, a tab
 * regains focus, a poll comes round - and all three end here, because all three
 * are the same question.
 *
 * NAMED FOR PERMISSIONS, USED FOR THE WHOLE SESSION. It began as the
 * authorization refresh, and the session now also carries the organization's
 * regional settings - language, timezone, date format, time format. Those
 * change for the same reasons, arrive on the same response and land in the same
 * reactive store, so one refetch serves both. A second mechanism beside it
 * would be a second thing to keep in step, and the whole point of putting the
 * settings on the session was to avoid that.
 *
 * Nothing that calls this passes a permission or a format in; the
 * answer comes from `POST /api/auth/session`, which recomputes the set on the
 * server from the privilege tables. A realtime payload is a signal, never a
 * source (and the tables that hold the actual grants are unreadable to the
 * browser by design - see prisma/supabase-rls.sql).
 *
 * The refreshed session is written to the observable cache in
 * `lib/auth/client.ts`, so every component subscribed through
 * `useDashboardAccess` re-renders against the new set. That is the whole
 * delivery mechanism: nothing here knows about the sidebar.
 */

/**
 * The shortest gap between two refreshes.
 *
 * Realtime delivers one event per changed row, so an administrator saving a
 * role with eleven permissions produces eleven bumps of `permissions_epoch` and
 * eleven events. Without this, each would be its own round trip - and each
 * would write the cache, re-render every subscriber, and do it again. A
 * refresh loop is the specific failure this guards against.
 */
const MIN_REFRESH_INTERVAL_MS = 2_000;

/**
 * How often to ask anyway.
 *
 * The belt to realtime's braces, and it matters more than it looks: realtime is
 * OFF by default in development (`NEXT_PUBLIC_ENABLE_REALTIME_SYNC`), the
 * socket can drop, and a laptop that was asleep missed everything. Sixty
 * seconds is one request a minute per open dashboard - cheap next to somebody
 * being told to sign out and back in.
 */
const POLL_INTERVAL_MS = 60_000;

let lastRefreshAt = 0;
let inFlight: Promise<void> | null = null;
let stopFallbacks: (() => void) | null = null;

/**
 * Re-read the session, unless one just happened.
 *
 * `force` skips the interval and is for the cases where being current matters
 * more than being frugal - a tab coming back to the foreground, where the user
 * is about to look at the screen.
 */
export async function refreshAuthorization(
  options: { force?: boolean } = {}
): Promise<void> {
  // Already asking. Every caller waits on the same answer rather than starting
  // a second identical request.
  if (inFlight) return inFlight;

  const since = Date.now() - lastRefreshAt;

  if (!options.force && since < MIN_REFRESH_INTERVAL_MS) return;

  inFlight = (async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      // Signed out, or the token could not be read. Not an error worth
      // surfacing: there is no session to refresh, and something else is
      // already handling that.
      if (error || !accessToken) return;

      await fetchAuthSession(accessToken, { force: true });
      lastRefreshAt = Date.now();
    } catch {
      /*
       * Swallowed on purpose, and the reasoning is the same as the epoch check
       * in lib/http/authenticated-fetch.ts: this runs in the background, behind
       * whatever the user is actually doing. A failed refresh means the hints
       * on screen stay as they were for another minute until the poll comes
       * round - it never means a request the user made should fail, and it must
       * never throw into a render.
       *
       * The refusal that matters is the API's, and that is unaffected: every
       * protected route re-decides server-side regardless of what this browser
       * believes.
       */
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * The fallbacks, for every event realtime did not deliver.
 *
 * Three reasons an event goes missing, and this covers all of them: realtime is
 * disabled in development by default, the websocket can drop without anybody
 * noticing, and a sleeping laptop receives nothing at all.
 *
 * Idempotent - calling it twice does not install two sets of listeners, which
 * would double every request. Returns the teardown.
 */
export function startAuthorizationRefreshFallbacks(): () => void {
  if (stopFallbacks) return stopFallbacks;
  if (typeof window === "undefined") return () => undefined;

  // Forced: somebody looking at the tab again is exactly when a stale sidebar
  // is about to be acted on, so this is the moment worth spending a request.
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;

    void refreshAuthorization({ force: true });
  };

  // Not forced, and not while the tab is in the background: a dashboard nobody
  // is reading should not poll.
  const poll = () => {
    if (document.visibilityState !== "visible") return;

    void refreshAuthorization();
  };

  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  const timer = window.setInterval(poll, POLL_INTERVAL_MS);

  stopFallbacks = () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    window.clearInterval(timer);
    stopFallbacks = null;
  };

  return stopFallbacks;
}

/** Test seam: forget when the last refresh happened. */
export function resetAuthorizationRefreshState() {
  lastRefreshAt = 0;
  inFlight = null;
  stopFallbacks?.();
  stopFallbacks = null;
}
