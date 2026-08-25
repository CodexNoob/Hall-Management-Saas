import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  useAccess,
  useDashboardAccess
} from "@/features/dashboard/hooks/use-dashboard-permission";
import {
  cacheTestSession,
  cacheTestSessionForStarterRole,
  starterPermissionsExcept
} from "./auth-session-fixture";

/**
 * The client hint layer.
 *
 * There is no administrative bypass to test any more, and its absence is the
 * assertion that matters most here: the old hook answered `true` for any key at
 * all if the membership role looked administrative, so a session whose access
 * row said otherwise was silently overruled. An Owner now holds keys the same
 * way everybody else does.
 */

describe("useDashboardAccess", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("allows a key the session carries", () => {
    cacheTestSession(["booking.create"]);
    const { result } = renderHook(() => useDashboardAccess());

    expect(result.current.hasPermission("booking.create")).toBe(true);
  });

  it("denies a key the session does not carry", () => {
    cacheTestSession(["event.read"]);
    const { result } = renderHook(() => useDashboardAccess());

    expect(result.current.hasPermission("booking.create")).toBe(false);
  });

  it("has no administrative bypass", () => {
    // An Administrator missing one key is missing it. The old hook answered
    // `true` here purely on the strength of the role string.
    cacheTestSession(
      starterPermissionsExcept("administrator", ["booking.create"])
    );
    const { result } = renderHook(() => useDashboardAccess());

    expect(result.current.hasPermission("booking.create")).toBe(false);
    expect(result.current.hasPermission("event.read")).toBe(true);
  });

  it("treats a list as any-of", () => {
    cacheTestSession(["settings.read"]);
    const { result } = renderHook(() => useDashboardAccess());

    expect(
      result.current.hasPermission(["staff.read", "settings.read"])
    ).toBe(true);
  });

  it("treats hasEveryPermission as all-of", () => {
    cacheTestSession(["settings.read"]);
    const { result } = renderHook(() => useDashboardAccess());

    expect(
      result.current.hasEveryPermission(["staff.read", "settings.read"])
    ).toBe(false);
    expect(result.current.hasEveryPermission(["settings.read"])).toBe(true);
  });

  it("delegates canAccessRoute to the route map", () => {
    cacheTestSessionForStarterRole("viewer");
    const { result } = renderHook(() => useDashboardAccess());

    expect(result.current.canAccessRoute("/dashboard/billing")).toBe(false);
    expect(result.current.canAccessRoute("/dashboard/calendar")).toBe(true);
  });

  it("denies everything when there is no cached session", () => {
    const { result } = renderHook(() => useDashboardAccess());

    expect(result.current.hasPermission("booking.create")).toBe(false);
    expect(result.current.canAccessRoute("/dashboard/billing")).toBe(false);
    expect(result.current.permissions).toEqual([]);
  });

  it("exposes the scope hint and the epoch", () => {
    cacheTestSession(["event.read"], {
      epoch: 42,
      scope: { hallIds: ["hall-a"], eventTypeIds: "all" }
    });
    const { result } = renderHook(() => useDashboardAccess());

    expect(result.current.epoch).toBe(42);
    expect(result.current.scope).toEqual({
      hallIds: ["hall-a"],
      eventTypeIds: "all"
    });
  });

  it("falls back to an unrestricted scope with no session", () => {
    const { result } = renderHook(() => useDashboardAccess());

    expect(result.current.scope).toEqual({
      hallIds: "all",
      eventTypeIds: "all"
    });
  });

  it("rejects a payload cached before the RBAC cutover", () => {
    // The old shape carried a 23-boolean `access` object and no keys. Reading it
    // as "holds nothing" would be a silent, total lockout on first load after a
    // deploy; the guard rejects it so the session is refetched instead.
    window.localStorage.setItem(
      "hms.authSession",
      JSON.stringify({
        user: { id: "user-1", role: "owner" },
        access: { canViewHome: true },
        mustSetPassword: false,
        mustCompleteOnboarding: false,
        activeOrganizationId: "org-1",
        organizations: []
      })
    );

    const { result } = renderHook(() => useDashboardAccess());

    expect(result.current.permissions).toEqual([]);
  });
});

describe("useAccess", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is the single-key form of hasPermission", () => {
    cacheTestSession(["menu.read"]);

    expect(renderHook(() => useAccess("menu.read")).result.current).toBe(true);
    expect(renderHook(() => useAccess("menu.update")).result.current).toBe(
      false
    );
  });
});
