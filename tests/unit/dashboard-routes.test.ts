import { describe, expect, it } from "vitest";
import {
  canAccessDashboardRoute,
  getRequiredDashboardPermission
} from "@/lib/auth/dashboard-routes";
import { accessForRole } from "@/lib/auth/permissions";

describe("canAccessDashboardRoute", () => {
  const viewerAccess = accessForRole("viewer");

  it("blocks the viewer role from billing, staff, and settings", () => {
    expect(canAccessDashboardRoute("/dashboard/billing", viewerAccess, "viewer")).toBe(false);
    expect(canAccessDashboardRoute("/dashboard/staff", viewerAccess, "viewer")).toBe(false);
    expect(canAccessDashboardRoute("/dashboard/settings", viewerAccess, "viewer")).toBe(false);
  });

  it("allows the viewer role into every page it already has access to", () => {
    expect(canAccessDashboardRoute("/dashboard", viewerAccess, "viewer")).toBe(true);
    expect(canAccessDashboardRoute("/dashboard/calendar", viewerAccess, "viewer")).toBe(true);
    expect(canAccessDashboardRoute("/dashboard/events", viewerAccess, "viewer")).toBe(true);
    expect(canAccessDashboardRoute("/dashboard/kitchen", viewerAccess, "viewer")).toBe(true);
    expect(canAccessDashboardRoute("/dashboard/menu", viewerAccess, "viewer")).toBe(true);
    expect(canAccessDashboardRoute("/dashboard/dining-manager", viewerAccess, "viewer")).toBe(true);
    expect(canAccessDashboardRoute("/dashboard/hall-room-map", viewerAccess, "viewer")).toBe(true);
    expect(canAccessDashboardRoute("/dashboard/files", viewerAccess, "viewer")).toBe(true);
  });

  it("lets owner and admin roles bypass the map entirely", () => {
    expect(canAccessDashboardRoute("/dashboard/billing", viewerAccess, "owner")).toBe(true);
    expect(canAccessDashboardRoute("/dashboard/staff", null, "admin")).toBe(true);
    expect(canAccessDashboardRoute("/dashboard/settings", null, "administrator")).toBe(true);
  });

  it("treats trailing slashes and nested sub-routes as the same route", () => {
    expect(canAccessDashboardRoute("/dashboard/billing/", viewerAccess, "viewer")).toBe(false);
    expect(
      canAccessDashboardRoute("/dashboard/billing/invoices/123", viewerAccess, "viewer")
    ).toBe(false);
  });

  it("allows unmapped routes by default so unrelated pages are unaffected", () => {
    expect(canAccessDashboardRoute("/dashboard/does-not-exist", viewerAccess, "viewer")).toBe(
      true
    );
    expect(canAccessDashboardRoute(null, viewerAccess, "viewer")).toBe(true);
  });

  it("matches the real permission each backing API route enforces", () => {
    expect(getRequiredDashboardPermission("/dashboard/billing")).toBe("canViewPaymentInfo");
    expect(getRequiredDashboardPermission("/dashboard/settings")).toBe("canViewSettings");
    expect(getRequiredDashboardPermission("/dashboard/staff")).toEqual([
      "canEditStaff",
      "canViewSettings",
      "canEditSettings"
    ]);
  });
});
