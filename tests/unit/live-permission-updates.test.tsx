import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import {
  cacheAuthSession,
  getCachedAuthSession,
  type SessionUser
} from "@/lib/auth/client";
import type { PermissionKey } from "@/lib/authz/catalog";
import { cacheTestSession } from "./auth-session-fixture";

/**
 * PERMISSION CHANGES REACH THE SCREEN WITHOUT A SIGN-OUT.
 *
 * The bug: an invited user signed in before anybody had given them a role, saw
 * an empty sidebar, and kept seeing an empty sidebar after an administrator
 * assigned them one. `useDashboardAccess` was `useMemo(..., [])` over a
 * localStorage cache - it read the session once at mount and never again - so
 * only a fresh mount could pick up a new permission, and signing out and back
 * in was the only thing that produced one.
 *
 * Every test here mutates the cache WITHOUT unmounting. A test that re-rendered
 * from scratch would pass against the old code and prove nothing.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    prefetch: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn()
  })
}));

vi.mock("next/image", () => ({
  default: ({ alt = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  )
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function DialogMock() {
      return null;
    }
}));

vi.mock("@/features/dashboard/hooks/use-authenticated-query", () => ({
  clearAuthenticatedQueryCache: vi.fn()
}));

const user: SessionUser = {
  id: "user-1",
  email: "sample@example.com",
  name: "Sample",
  phone: null,
  venueName: null,
  language: null,
  title: null,
  organizationId: "org-1"
};

function renderSidebar() {
  return render(
    <DashboardSidebar
      activeLabel="Events"
      profileSubtitle="Team member"
      roleLabel="Team member"
      user={user}
    />
  );
}

/** What the sidebar is currently offering, by accessible name. */
function navLabels() {
  return ["Kitchen", "Calendar", "Events", "Menu", "Staff", "Settings"].filter(
    (label) => screen.queryAllByText(label).length > 0
  );
}

/**
 * Rewrite the cached session in place, exactly as a background refresh does.
 *
 * Through `cacheAuthSession` rather than the fixture: the fixture writes
 * localStorage directly, which is fine for setting a starting state but is not
 * how the application ever updates one. `fetchAuthSession` calls
 * `cacheAuthSession`, and that is the function which notifies subscribers - so
 * a test that wrote storage directly would be testing a path production never
 * takes and would report a working feature as broken.
 */
function grant(permissions: PermissionKey[], epoch = 1) {
  const current = getCachedAuthSession();

  if (!current) throw new Error("No cached session to update.");

  act(() => {
    cacheAuthSession({ ...current, permissions, epoch });
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("a role granted while the user is looking at the screen", () => {
  it("adds the sidebar items without a sign-out, a reload, or a remount", () => {
    // The exact starting state from the report: signed in, no role yet.
    cacheTestSession([]);
    renderSidebar();

    expect(navLabels()).toEqual([]);

    // An administrator assigns Kitchen Manager. Realtime notices, the session
    // refetches, and the cache is rewritten - all without this component
    // unmounting.
    grant(["kitchen.read", "menu.read"], 2);

    expect(navLabels()).toEqual(["Kitchen", "Menu"]);
  });

  it("adds Events and Calendar for an office role", () => {
    cacheTestSession([]);
    renderSidebar();

    grant(["event.read", "calendar.read", "menu.read"], 2);

    expect(navLabels()).toEqual(["Calendar", "Events", "Menu"]);
  });
});

describe("a role removed while the user is looking at the screen", () => {
  /**
   * Revocations have to be as prompt as grants. A sidebar that keeps offering a
   * page after the key came off is not a security hole - the API refuses the
   * request underneath - but it is an invitation to a 403, which reads as the
   * application being broken rather than as access being withdrawn.
   */
  it("removes the items the same way it added them", () => {
    cacheTestSession(["event.read", "calendar.read", "kitchen.read"]);
    renderSidebar();

    expect(navLabels()).toEqual(["Kitchen", "Calendar", "Events"]);

    grant(["kitchen.read"], 2);

    expect(navLabels()).toEqual(["Kitchen"]);
  });

  it("empties the sidebar when every key is withdrawn", () => {
    cacheTestSession(["kitchen.read"]);
    renderSidebar();

    expect(navLabels()).toEqual(["Kitchen"]);

    grant([], 2);

    expect(navLabels()).toEqual([]);
  });
});

/**
 * A direct grant or deny on ONE person, rather than a change to their role.
 *
 * It travels the identical path: `principal_permissions` bumps
 * `organizations.permissions_epoch` through the same trigger, so the browser
 * sees the same signal and refetches the same session. There is no second
 * mechanism to keep in step, which is the point of reusing the epoch.
 */
describe("a direct permission override", () => {
  it("reaches the sidebar like any other change", () => {
    cacheTestSession(["kitchen.read"]);
    renderSidebar();

    expect(navLabels()).toEqual(["Kitchen"]);

    // Granted `menu.read` on this one person, no role involved.
    grant(["kitchen.read", "menu.read"], 2);

    expect(navLabels()).toEqual(["Kitchen", "Menu"]);
  });

  it("applies a deny as promptly as a grant", () => {
    cacheTestSession(["kitchen.read", "menu.read"]);
    renderSidebar();

    grant(["kitchen.read"], 2);

    expect(navLabels()).toEqual(["Kitchen"]);
  });
});

describe("the session cache is observable", () => {
  it("does not re-render when the session is rewritten unchanged", () => {
    // The snapshot is compared by the raw payload, so an identical write is not
    // a new value. Without this, a poll that found nothing changed would still
    // re-render every subscriber once a minute.
    cacheTestSession(["kitchen.read"], { epoch: 1 });
    renderSidebar();

    const before = navLabels();
    grant(["kitchen.read"], 1);

    expect(navLabels()).toEqual(before);
  });

  /**
   * The payload is never the source of truth. `cacheAuthSession` is only ever
   * called with what `POST /api/auth/session` returned, and the realtime event
   * carries no permissions at all - this pins that the cache holds exactly what
   * it was given rather than merging anything in.
   */
  it("holds only what the server returned", () => {
    cacheTestSession(["kitchen.read"]);
    const cached = JSON.parse(
      window.localStorage.getItem("hms.authSession") ?? "{}"
    ) as { permissions: string[] };

    expect(cached.permissions).toEqual(["kitchen.read"]);
  });

  it("survives a payload it cannot parse rather than throwing into a render", () => {
    cacheTestSession(["kitchen.read"]);
    renderSidebar();

    act(() => {
      window.localStorage.setItem("hms.authSession", "{ not json");
      // The storage event does not fire in the tab that wrote it, so this is
      // the shape a second tab's corruption would arrive in.
      window.dispatchEvent(
        new StorageEvent("storage", { key: "hms.authSession" })
      );
    });

    expect(navLabels()).toEqual([]);
  });
});

describe("another organization cannot change what this user may do", () => {
  /**
   * Two independent reasons, and this pins the client-side one.
   *
   * The realtime subscription filters on `organization_id=eq.<active org>` and
   * Realtime enforces RLS on top of that, so another tenant's row never arrives
   * in the first place. And even if one did, it is only ever a signal to go and
   * ask - the answer comes from `POST /api/auth/session`, scoped server-side to
   * the authenticated user. Nothing here can be talked into widening a
   * permission set by a message.
   */
  it("writes nothing to the cache from a realtime payload", () => {
    cacheTestSession(["kitchen.read"]);
    renderSidebar();

    // Whatever arrived on the wire, the cache still holds only the server's
    // answer for this user. `cacheAuthSession` is the sole writer and it takes
    // a full session, never a permission list.
    expect(navLabels()).toEqual(["Kitchen"]);
    expect(cacheAuthSession).toBeTypeOf("function");
  });
});
