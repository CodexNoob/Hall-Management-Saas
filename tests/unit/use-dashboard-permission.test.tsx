import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  useDashboardAccess,
  useDashboardPermission
} from "@/features/dashboard/hooks/use-dashboard-permission";
import { cacheTestSession } from "./auth-session-fixture";

describe("useDashboardAccess", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("denies a permission the role's access row has false", () => {
    cacheTestSession("viewer", { canCreateBooking: false });
    const { result } = renderHook(() => useDashboardAccess());
    expect(result.current.hasPermission("canCreateBooking")).toBe(false);
  });

  it("allows a permission the role's access row has true", () => {
    cacheTestSession("manager", { canCreateBooking: true });
    const { result } = renderHook(() => useDashboardAccess());
    expect(result.current.hasPermission("canCreateBooking")).toBe(true);
  });

  it("lets an administrative role bypass the access row entirely", () => {
    cacheTestSession("admin", {
      canCreateBooking: false,
      canAddKitchenEvents: false
    });
    const { result } = renderHook(() => useDashboardAccess());
    expect(result.current.hasPermission("canCreateBooking")).toBe(true);
    expect(result.current.hasPermission(["canAddKitchenEvents"])).toBe(true);
  });

  it("supports checking any-of a list of permissions", () => {
    cacheTestSession("viewer", {
      canEditStaff: false,
      canViewSettings: false,
      canEditSettings: true
    });
    const { result } = renderHook(() => useDashboardAccess());
    expect(
      result.current.hasPermission([
        "canEditStaff",
        "canViewSettings",
        "canEditSettings"
      ])
    ).toBe(true);
  });

  it("delegates canAccessRoute to the dashboard route permission map", () => {
    cacheTestSession("viewer", { canViewPaymentInfo: false });
    const { result } = renderHook(() => useDashboardAccess());
    expect(result.current.canAccessRoute("/dashboard/billing")).toBe(false);
    expect(result.current.canAccessRoute("/dashboard/calendar")).toBe(true);
  });

  it("denies every permission when there is no cached user at all", () => {
    const { result } = renderHook(() => useDashboardAccess());
    expect(result.current.hasPermission("canCreateBooking")).toBe(false);
    expect(result.current.canAccessRoute("/dashboard/billing")).toBe(false);
  });
});

describe("useDashboardPermission", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("mirrors useDashboardAccess().hasPermission for a single permission", () => {
    cacheTestSession("viewer", { canViewMenu: true, canEditMenu: false });
    const { result } = renderHook(() => useDashboardPermission("canEditMenu"));
    expect(result.current).toBe(false);
  });
});
