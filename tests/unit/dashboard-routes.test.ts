import { describe, expect, it } from "vitest";
import {
  canAccessDashboardRoute,
  dashboardRoutePermissions,
  getRequiredDashboardPermission
} from "@/lib/auth/dashboard-routes";
import { permissionKeys } from "@/lib/authz/catalog";
import { starterPermissions } from "./auth-session-fixture";

/**
 * The dashboard route map, keyed by PERMISSION rather than by role.
 *
 * There is no bypass here to test any more, and that absence is the point: a
 * role reaching a new page is a data change, so this map only has to answer
 * "which key does this page need".
 */

describe("canAccessDashboardRoute", () => {
  const viewer = starterPermissions("viewer");
  const eventManager = starterPermissions("event-manager");
  const kitchenStaff = starterPermissions("kitchen-staff");
  const owner = starterPermissions("owner");

  it("keeps a Viewer out of billing, staff and access", () => {
    expect(canAccessDashboardRoute("/dashboard/billing", viewer)).toBe(false);
    expect(canAccessDashboardRoute("/dashboard/staff", viewer)).toBe(false);
    expect(canAccessDashboardRoute("/dashboard/access", viewer)).toBe(false);
  });

  it("lets a Viewer into every read-only page", () => {
    for (const route of [
      "/dashboard",
      "/dashboard/calendar",
      "/dashboard/events",
      "/dashboard/kitchen",
      "/dashboard/menu",
      "/dashboard/dining-manager",
      "/dashboard/hall-room-map",
      "/dashboard/files",
      "/dashboard/settings"
    ]) {
      expect(canAccessDashboardRoute(route, viewer), route).toBe(true);
    }
  });

  it("gives an Owner everything - by holding the keys, not by bypassing", () => {
    for (const route of Object.keys(dashboardRoutePermissions)) {
      expect(canAccessDashboardRoute(route, owner), route).toBe(true);
    }
  });

  it("keeps an Event Manager out of staff and access alike", () => {
    // `/dashboard/staff` takes `staff.read` OR `role.read`, and this role holds
    // neither: the directory came off it deliberately (lib/authz/starter-roles.ts),
    // so there is no tab of that page left for it to reach. The sidebar entry
    // goes with it, and `GET /api/staff` refuses the request underneath.
    expect(canAccessDashboardRoute("/dashboard/staff", eventManager)).toBe(
      false
    );
    expect(canAccessDashboardRoute("/dashboard/access", eventManager)).toBe(
      false
    );
  });

  it("still lets an Event Manager run events", () => {
    for (const route of [
      "/dashboard/events",
      "/dashboard/calendar",
      "/dashboard/clients",
      "/dashboard/menu",
      "/dashboard/settings"
    ]) {
      expect(canAccessDashboardRoute(route, eventManager), route).toBe(true);
    }
  });

  it("keeps Kitchen Staff on the kitchen", () => {
    expect(canAccessDashboardRoute("/dashboard/kitchen", kitchenStaff)).toBe(
      true
    );
    expect(canAccessDashboardRoute("/dashboard/clients", kitchenStaff)).toBe(
      false
    );
    expect(canAccessDashboardRoute("/dashboard/billing", kitchenStaff)).toBe(
      false
    );
  });

  it("denies everything to a principal holding nothing", () => {
    for (const route of Object.keys(dashboardRoutePermissions)) {
      expect(canAccessDashboardRoute(route, []), route).toBe(false);
    }
  });

  it("treats an unmapped route as open - the API is the real boundary", () => {
    expect(canAccessDashboardRoute("/dashboard/something-new", [])).toBe(true);
  });

  it("matches nested paths against their parent", () => {
    expect(canAccessDashboardRoute("/dashboard/kitchen/board", viewer)).toBe(
      true
    );
    expect(canAccessDashboardRoute("/dashboard/billing/invoices", viewer)).toBe(
      false
    );
  });

  it("normalises a trailing slash", () => {
    expect(canAccessDashboardRoute("/dashboard/calendar/", viewer)).toBe(true);
  });
});

describe("getRequiredDashboardPermission", () => {
  it("names a key for every mapped route", () => {
    for (const route of Object.keys(dashboardRoutePermissions)) {
      expect(getRequiredDashboardPermission(route), route).toBeTruthy();
    }
  });

  it("only names keys that exist in the catalog", () => {
    // A typo here silently locks everybody out of a page, and the failure looks
    // like a permissions bug rather than a map bug.
    for (const [route, required] of Object.entries(dashboardRoutePermissions)) {
      for (const key of Array.isArray(required) ? required : [required]) {
        expect(permissionKeys, `${route} needs unknown key ${key}`).toContain(
          key
        );
      }
    }
  });

  it("returns null for an unmapped route", () => {
    expect(getRequiredDashboardPermission("/dashboard/nope")).toBeNull();
    expect(getRequiredDashboardPermission(null)).toBeNull();
  });

  it("prefers the longest matching prefix", () => {
    // /dashboard/client-portal must not be answered by /dashboard/clients.
    expect(getRequiredDashboardPermission("/dashboard/client-portal")).toBe(
      "client.read"
    );
  });
});
