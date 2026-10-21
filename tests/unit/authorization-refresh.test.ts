import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchAuthSession: vi.fn(),
  getSession: vi.fn()
}));

vi.mock("@/lib/auth/client", () => ({
  fetchAuthSession: mocks.fetchAuthSession
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({ auth: { getSession: mocks.getSession } })
}));

import {
  refreshAuthorization,
  resetAuthorizationRefreshState,
  startAuthorizationRefreshFallbacks
} from "@/lib/auth/authorization-refresh";
import { affectsAuthorization, AUTHORIZATION_TABLES } from "@/lib/realtime/table-subscriptions";

/**
 * RE-READING PERMISSIONS, AND NOT RE-READING THEM TOO OFTEN.
 *
 * The refresher is the single place a permission change is turned back into a
 * question for the server. Everything about it is either "ask again" or "do not
 * ask again yet", and both halves matter: without the first, a granted role
 * needs a sign-out; without the second, an administrator saving a role with
 * eleven permissions produces eleven epoch bumps, eleven realtime events and
 * eleven round trips - each of which rewrites the cache and re-renders every
 * subscriber.
 */

const setVisibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  resetAuthorizationRefreshState();
  setVisibility("visible");
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: "token-1" } },
    error: null
  });
  mocks.fetchAuthSession.mockResolvedValue({});
});

afterEach(() => {
  resetAuthorizationRefreshState();
  vi.useRealTimers();
});

describe("refreshAuthorization", () => {
  it("asks the server rather than trusting anything it was handed", () => {
    // The signature takes no permissions, and that is the design: a realtime
    // payload is an invalidation signal, never a source. If this ever grows a
    // parameter carrying a permission set, the security model has changed.
    expect(refreshAuthorization.length).toBeLessThanOrEqual(1);
  });

  it("force-refetches the session", async () => {
    await refreshAuthorization();

    expect(mocks.fetchAuthSession).toHaveBeenCalledWith("token-1", {
      force: true
    });
  });

  /**
   * The refresh-loop guard. Eleven events from one save must not be eleven
   * requests.
   */
  it("collapses a burst into a single request", async () => {
    await refreshAuthorization();
    await refreshAuthorization();
    await refreshAuthorization();

    expect(mocks.fetchAuthSession).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight request between concurrent callers", async () => {
    let release: (value: unknown) => void = () => {};
    mocks.fetchAuthSession.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    const first = refreshAuthorization();
    const second = refreshAuthorization();

    release({});
    await Promise.all([first, second]);

    expect(mocks.fetchAuthSession).toHaveBeenCalledTimes(1);
  });

  it("asks again once the interval has passed", async () => {
    vi.useFakeTimers();
    await refreshAuthorization();
    expect(mocks.fetchAuthSession).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_500);
    await refreshAuthorization();

    expect(mocks.fetchAuthSession).toHaveBeenCalledTimes(2);
  });

  it("honours force, for the moment somebody looks at the tab again", async () => {
    await refreshAuthorization();
    await refreshAuthorization({ force: true });

    expect(mocks.fetchAuthSession).toHaveBeenCalledTimes(2);
  });

  it("does nothing when there is no session to refresh", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await refreshAuthorization();

    expect(mocks.fetchAuthSession).not.toHaveBeenCalled();
  });

  /**
   * This runs behind whatever the user is actually doing. A failure here means
   * the hints on screen stay as they were until the next poll - it must never
   * throw into a render, and it must never fail a request the user made. The
   * refusal that matters is the API's, and that is unaffected.
   */
  it("never throws when the refresh fails", async () => {
    mocks.fetchAuthSession.mockRejectedValue(new Error("network down"));

    await expect(refreshAuthorization()).resolves.toBeUndefined();
  });

  it("retries after a failure instead of latching", async () => {
    // The interval is stamped on SUCCESS, so a failed attempt does not buy two
    // seconds of silence - somebody whose network blipped is not made to wait.
    mocks.fetchAuthSession.mockRejectedValueOnce(new Error("network down"));
    await refreshAuthorization();

    mocks.fetchAuthSession.mockResolvedValue({});
    await refreshAuthorization();

    expect(mocks.fetchAuthSession).toHaveBeenCalledTimes(2);
  });
});

describe("the fallbacks for a missed event", () => {
  /**
   * Three ways an event goes missing, and any one of them puts somebody back to
   * signing out and in: realtime is OFF by default in development
   * (`NEXT_PUBLIC_ENABLE_REALTIME_SYNC`), the websocket can drop unnoticed, and
   * a sleeping laptop receives nothing at all.
   */
  it("refreshes when the tab becomes visible again", async () => {
    startAuthorizationRefreshFallbacks();
    setVisibility("visible");

    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() =>
      expect(mocks.fetchAuthSession).toHaveBeenCalledTimes(1)
    );
  });

  it("refreshes when the window regains focus", async () => {
    startAuthorizationRefreshFallbacks();

    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() =>
      expect(mocks.fetchAuthSession).toHaveBeenCalledTimes(1)
    );
  });

  it("does not refresh when the tab goes to the background", async () => {
    startAuthorizationRefreshFallbacks();
    setVisibility("hidden");

    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mocks.fetchAuthSession).not.toHaveBeenCalled();
  });

  it("polls on an interval while the tab is in front", async () => {
    vi.useFakeTimers();
    startAuthorizationRefreshFallbacks();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(mocks.fetchAuthSession).toHaveBeenCalledTimes(1);
  });

  it("stops polling once torn down", async () => {
    vi.useFakeTimers();
    const stop = startAuthorizationRefreshFallbacks();
    stop();

    await vi.advanceTimersByTimeAsync(180_000);

    expect(mocks.fetchAuthSession).not.toHaveBeenCalled();
  });

  it("installs one set of listeners however many times it is started", async () => {
    // Otherwise a re-render of the layout would double every request, and the
    // next one would double it again.
    startAuthorizationRefreshFallbacks();
    startAuthorizationRefreshFallbacks();
    startAuthorizationRefreshFallbacks();

    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() =>
      expect(mocks.fetchAuthSession).toHaveBeenCalledTimes(1)
    );
  });
});

describe("which tables mean 'your permissions may have changed'", () => {
  it("routes the organization row to an authorization refresh", () => {
    // All three privilege tables bump `organizations.permissions_epoch` through
    // triggers, so this one table covers a role assigned, a role removed, a
    // department moved, a direct override and a role's own permissions edited.
    expect(affectsAuthorization(["organizations"])).toBe(true);
  });

  it("ignores ordinary data changes", () => {
    expect(affectsAuthorization(["events", "dining_plans"])).toBe(false);
  });

  it("subscribes to no privilege table", () => {
    // `principal_roles`, `principal_permissions` and `role_permissions` have
    // RLS on with NO POLICY at all, deliberately. Publishing one would deliver
    // nothing, and giving it a policy so a sidebar could refresh would be
    // inventing read access to the privilege tables.
    for (const table of [
      "principal_roles",
      "principal_permissions",
      "role_permissions",
      "roles"
    ]) {
      expect(AUTHORIZATION_TABLES, table).not.toContain(table);
    }
  });
});
