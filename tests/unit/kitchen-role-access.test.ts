import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  canAccessDashboardRoute,
  dashboardRoutePermissions,
  resolveLandingRoute
} from "@/lib/auth/dashboard-routes";
import { sidebarSections } from "@/components/layout/dashboard-sidebar-shared";
import { isHiddenDashboardRoute, MVP_LANDING_ROUTE } from "@/lib/ui/mvp-features";
import { starterPermissions } from "./auth-session-fixture";

/**
 * WHO SEES WHAT, for the three operational roles.
 *
 * The bug this suite exists for: a Kitchen Manager was arriving with Events and
 * Calendar in their sidebar. The navigation was not wrong - it is derived from
 * `dashboardRoutePermissions` and was reporting the grant faithfully. The grant
 * was wrong: `lib/authz/starter-roles.ts` seeded both kitchen roles with
 * `event.read` and `calendar.read`, neither of which the Kitchen Dashboard
 * needs.
 *
 * These are UI-layer assertions and they are deliberately not the boundary. The
 * API refuses on its own authority, which `api route guards` below pins by
 * reading the handlers rather than by trusting this file.
 */

const EVENT_MANAGER = starterPermissions("event-manager");
const KITCHEN_MANAGER = starterPermissions("kitchen-manager");
const KITCHEN_STAFF = starterPermissions("kitchen-staff");

/** Every sidebar destination this key set may open, in nav order. */
function visibleNav(permissions: readonly string[]) {
  return sidebarSections
    .flatMap((section) => section.items)
    .filter(
      (item) =>
        !isHiddenDashboardRoute(item.route) &&
        canAccessDashboardRoute(item.route, permissions)
    )
    .map((item) => item.label);
}

describe("Event Manager", () => {
  it("runs the office, unchanged", () => {
    for (const route of [
      "/dashboard/events",
      "/dashboard/calendar",
      "/dashboard/clients",
      "/dashboard/menu"
    ]) {
      expect(canAccessDashboardRoute(route, EVENT_MANAGER), route).toBe(true);
    }
  });

  it("can still see kitchen production progress", () => {
    // The office question "is Friday's wedding ready" is answered from the
    // board, so this role keeps `kitchen.read` and `kitchen.read.all` - the
    // whole board rather than the none assigned to them.
    expect(canAccessDashboardRoute("/dashboard/kitchen", EVENT_MANAGER)).toBe(
      true
    );
    expect(EVENT_MANAGER).toContain("kitchen.read.all");
  });

  it("receives no billing, staff, access or settings-write keys automatically", () => {
    for (const key of [
      "invoice.create",
      "payment.refund",
      "bank.connect",
      "staff.read",
      "role.read",
      "role.manage",
      "settings.update"
    ]) {
      expect(EVENT_MANAGER, key).not.toContain(key);
    }
  });
});

describe("Kitchen Manager", () => {
  it("sees Kitchen and Menu, and no Events", () => {
    expect(visibleNav(KITCHEN_MANAGER)).toEqual(["Kitchen", "Menu"]);
  });

  it("is refused the Events workspace and the booking calendar", () => {
    expect(canAccessDashboardRoute("/dashboard/events", KITCHEN_MANAGER)).toBe(
      false
    );
    expect(
      canAccessDashboardRoute("/dashboard/event-manager", KITCHEN_MANAGER)
    ).toBe(false);
    expect(
      canAccessDashboardRoute("/dashboard/calendar", KITCHEN_MANAGER)
    ).toBe(false);
  });

  it("keeps every verb that running a kitchen needs", () => {
    // If any of these ever goes false, the revocation took something
    // load-bearing with it and the Kitchen Dashboard is broken for its manager.
    for (const key of [
      "kitchen.read",
      "kitchen.read.all",
      "kitchen.worker.read",
      "kitchen.worker.assign",
      "kitchen.event.create",
      "kitchen.status.update",
      "eventmenu.read",
      "eventmenu.confirm"
    ]) {
      expect(KITCHEN_MANAGER, key).toContain(key);
    }
  });

  it("receives nothing commercial or administrative", () => {
    for (const key of [
      "client.read",
      "invoice.read",
      "payment.record",
      "report.read",
      "booking.create",
      "event.update",
      "staff.read",
      "role.read",
      "settings.read"
    ]) {
      expect(KITCHEN_MANAGER, key).not.toContain(key);
    }
  });
});

describe("Kitchen Staff", () => {
  /**
   * Menu stays, and deliberately.
   *
   * `menu.read` is the dish library - what a dish IS, its allergens and its
   * service. The kitchen's replace-dish drawer reads `/api/menu` directly, so
   * taking the key off would break a control this role uses. It carries
   * nothing commercial: no price is on it, and `menu.create` / `menu.update`
   * are absent, so a cook reads the library and changes none of it.
   */
  it("sees the Kitchen and the dish library, and nothing else", () => {
    expect(visibleNav(KITCHEN_STAFF)).toEqual(["Kitchen", "Menu"]);
    expect(KITCHEN_STAFF).not.toContain("menu.create");
    expect(KITCHEN_STAFF).not.toContain("menu.update");
  });

  it("is refused Events, Calendar, Clients, Billing, Staff and Settings", () => {
    for (const route of [
      "/dashboard/events",
      "/dashboard/calendar",
      "/dashboard/clients",
      "/dashboard/billing",
      "/dashboard/staff",
      "/dashboard/settings"
    ]) {
      expect(canAccessDashboardRoute(route, KITCHEN_STAFF), route).toBe(false);
    }
  });

  it("stays limited to its own assigned work", () => {
    // The absence IS the restriction: without `kitchen.read.all` the kitchen
    // routes send this role only the lines assigned to them.
    expect(KITCHEN_STAFF).not.toContain("kitchen.read.all");
    expect(KITCHEN_STAFF).toContain("kitchen.status.update");
  });

  it("directs nobody", () => {
    for (const key of [
      "kitchen.worker.assign",
      "kitchen.event.create",
      "eventmenu.confirm"
    ]) {
      expect(KITCHEN_STAFF, key).not.toContain(key);
    }
  });
});

describe("sidebar visibility and route authorization agree", () => {
  /**
   * The invariant behind the whole fix. A nav entry is drawn from exactly the
   * check that decides whether the page renders, so the two cannot disagree -
   * there is no second list of "what this role sees" to keep in step.
   */
  it.each([
    ["event-manager", EVENT_MANAGER],
    ["kitchen-manager", KITCHEN_MANAGER],
    ["kitchen-staff", KITCHEN_STAFF]
  ])("holds for %s", (_role, permissions) => {
    for (const item of sidebarSections.flatMap((section) => section.items)) {
      if (isHiddenDashboardRoute(item.route)) continue;

      expect(
        visibleNav(permissions).includes(item.label),
        `${item.label} (${item.route})`
      ).toBe(canAccessDashboardRoute(item.route, permissions));
    }
  });
});

describe("nobody lands on a page they cannot open", () => {
  /**
   * `/dashboard/events` is where every default path leads - a sign-in with no
   * `next`, a hidden module's redirect, leaving onboarding. Revoking
   * `event.read` from the kitchen roles without this would put every cook on
   * an "Access restricted" card for doing nothing but arriving.
   */
  it("sends a kitchen role to the Kitchen instead of Events", () => {
    expect(canAccessDashboardRoute(MVP_LANDING_ROUTE, KITCHEN_STAFF)).toBe(
      false
    );
    expect(
      resolveLandingRoute(KITCHEN_STAFF, isHiddenDashboardRoute)
    ).toBe("/dashboard/kitchen");
    expect(
      resolveLandingRoute(KITCHEN_MANAGER, isHiddenDashboardRoute)
    ).toBe("/dashboard/kitchen");
  });

  it("leaves Events as the landing route for anyone who can open it", () => {
    expect(
      resolveLandingRoute(EVENT_MANAGER, isHiddenDashboardRoute)
    ).toBe(MVP_LANDING_ROUTE);
  });

  it("never lands anybody somewhere they lack the key for", () => {
    for (const permissions of [EVENT_MANAGER, KITCHEN_MANAGER, KITCHEN_STAFF]) {
      const landing = resolveLandingRoute(permissions, isHiddenDashboardRoute);

      expect(landing).toBeTruthy();
      expect(canAccessDashboardRoute(landing, permissions)).toBe(true);
      expect(isHiddenDashboardRoute(landing)).toBe(false);
    }
  });

  it("answers null rather than guessing for a principal holding nothing", () => {
    expect(resolveLandingRoute([], isHiddenDashboardRoute)).toBeNull();
  });
});

/**
 * The server side, read from the handlers themselves.
 *
 * Every assertion above is about what a browser DRAWS, which is a courtesy.
 * These pin the refusal: the route map and the handler have to name the same
 * key, or a page could be hidden while its data stayed reachable.
 */
describe("api route guards", () => {
  const source = (relative: string) =>
    readFileSync(path.join(process.cwd(), "app/api", relative), "utf8");

  it("gates GET /api/events on event.read", () => {
    expect(source("events/route.ts")).toContain(
      'authorize(request, "event.read")'
    );
  });

  it("gates GET /api/calendar on calendar.read", () => {
    expect(source("calendar/route.ts")).toContain(
      'authorize(request, "calendar.read")'
    );
  });

  /**
   * The key that makes the revocation safe. If this ever becomes
   * `event.read`, the kitchen detail dialog breaks for every kitchen role and
   * the only warning would be a bug report from a venue.
   */
  it("serves the kitchen's event context under kitchen.read, not event.read", () => {
    for (const route of ["kitchen/route.ts", "events/[eventId]/kitchen/route.ts"]) {
      const contents = source(route);

      expect(contents, route).toContain('authorize(request, "kitchen.read")');
      expect(contents, route).not.toContain('authorize(request, "event.read")');
    }
  });

  /**
   * What the board is allowed to send. A kitchen role holds no `client.read`,
   * no `invoice.read` and no `payment.*`, so the kitchen endpoint must not
   * hand those fields over by another name.
   */
  it("selects no contact, financial or contract fields for the board", () => {
    const contents = source("kitchen/route.ts");

    for (const field of [
      "clientEmail",
      "clientPhone",
      "totalAmount",
      "depositAmount",
      "balanceDue",
      "contractUrl",
      "invoices:",
      "payments:"
    ]) {
      expect(contents, field).not.toContain(field);
    }
  });

  it("maps the two office routes to the keys the kitchen no longer holds", () => {
    expect(dashboardRoutePermissions["/dashboard/events"]).toBe("event.read");
    expect(dashboardRoutePermissions["/dashboard/calendar"]).toBe(
      "calendar.read"
    );
  });
});

/**
 * The persisted half.
 *
 * `ensureStarterRoles` is create-only for permissions on purpose, so editing
 * `starter-roles.ts` changes what NEW organizations get and nothing else. Every
 * organization that already has a kitchen role keeps both keys until the
 * backfill runs - which means a suite that only read the TypeScript would pass
 * while every existing venue stayed broken.
 */
describe("backfill for organizations seeded before this change", () => {
  const sql = (name: string) =>
    readFileSync(path.join(process.cwd(), "prisma", name), "utf8");

  const REVOKE = "kitchen-event-calendar-revoke.sql";
  const ROLLBACK = "kitchen-event-calendar-revoke-rollback.sql";

  it("ships both a migration and its rollback", () => {
    for (const name of [REVOKE, ROLLBACK]) {
      expect(existsSync(path.join(process.cwd(), "prisma", name)), name).toBe(
        true
      );
    }
  });

  it("revokes exactly the two keys from exactly the two kitchen roles", () => {
    const contents = sql(REVOKE);

    expect(contents).toContain("DELETE FROM role_permissions");
    expect(contents).toContain("'kitchen-manager', 'kitchen-staff'");
    expect(contents).toContain("'event.read', 'calendar.read'");
  });

  it("touches no role a tenant authored themselves", () => {
    // Restricting somebody's own composition without being asked is the
    // failure mode this kind of migration has to be careful about.
    expect(sql(REVOKE)).toContain("r.is_system = true");
  });

  it("leaves Event Manager alone", () => {
    expect(sql(REVOKE)).not.toContain("'event-manager'");
  });

  it("is idempotent and reversible", () => {
    expect(sql(REVOKE)).toContain("IDEMPOTENT");
    expect(sql(ROLLBACK)).toContain("INSERT INTO role_permissions");
    expect(sql(ROLLBACK)).toContain("ON CONFLICT (role_id, permission_id) DO NOTHING");
  });
});
