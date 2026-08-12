import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() })
}));

import { DashboardModuleLinks } from "@/features/dashboard/components/dashboard-module-links";
import { canAccessDashboardRoute } from "@/lib/auth/dashboard-routes";
import { accessForRole, type StaffRoleValue } from "@/lib/auth/permissions";
import { cacheSyncedUser, cacheSyncedUserForRole } from "./synced-user-fixture";

// Matched on description text, not on the <h3> title or the actionLabel: a tile
// button's accessible name is its whole concatenated card text, so "Billing" and
// "Open billing" would collide with the quick-action labels elsewhere on the
// page. The descriptions are unique.
const tiles = {
  Kitchen: {
    description: "Menu production, quantities, workers, and completion status.",
    route: "/dashboard/kitchen"
  },
  Calendar: {
    description: "Month view with room availability and closed-date rules.",
    route: "/dashboard/calendar"
  },
  Events: {
    description: "Full event file: client, menu, dining, staff, vendors, files.",
    route: "/dashboard/events"
  },
  Billing: {
    description: "Retainers, invoices, payment links, and balances due.",
    route: "/dashboard/billing"
  }
} as const;

function visibleTiles() {
  return Object.entries(tiles)
    .filter(([, tile]) => screen.queryByText(tile.description) !== null)
    .map(([title]) => title);
}

const cases: Array<{ role: StaffRoleValue; expected: string[] }> = [
  { role: "admin", expected: ["Kitchen", "Calendar", "Events", "Billing"] },
  { role: "manager", expected: ["Kitchen", "Calendar", "Events", "Billing"] },
  // canViewCalendar makes /dashboard/events reachable even without
  // canViewEventManager, which is why Events survives for Kitchen Staff.
  { role: "kitchen", expected: ["Kitchen", "Calendar", "Events"] },
  { role: "billing", expected: ["Calendar", "Events", "Billing"] },
  { role: "viewer", expected: ["Kitchen", "Calendar", "Events"] }
];

describe("DashboardModuleLinks role gating", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  for (const { role, expected } of cases) {
    it(`shows exactly ${expected.join(", ")} for ${role}`, () => {
      cacheSyncedUserForRole(role);
      render(<DashboardModuleLinks />);

      expect(visibleTiles().sort()).toEqual([...expected].sort());
    });
  }

  // The tiles must agree with the sidebar and the layout guard, which both use
  // canAccessDashboardRoute. This is the assertion that catches a mis-mapped
  // tile route.
  it("offers a tile exactly when its route is reachable", () => {
    for (const { role } of cases) {
      window.localStorage.clear();
      cacheSyncedUserForRole(role);
      const { unmount } = render(<DashboardModuleLinks />);
      const shown = visibleTiles();

      for (const [title, tile] of Object.entries(tiles)) {
        expect(
          shown.includes(title),
          `${role}: tile ${title} visibility must match canAccessDashboardRoute("${tile.route}")`
        ).toBe(canAccessDashboardRoute(tile.route, accessForRole(role), role));
      }

      unmount();
    }
  });

  it("exposes the tile row as a labelled region", () => {
    cacheSyncedUserForRole("viewer");
    render(<DashboardModuleLinks />);

    expect(
      screen.getByRole("region", { name: "Module shortcuts" })
    ).toBeInTheDocument();
  });

  it("renders nothing when no tile is reachable", () => {
    cacheSyncedUser("viewer", {
      canViewCalendar: false,
      canViewEventManager: false,
      canViewKitchenDashboard: false,
      canViewPaymentInfo: false
    });
    const { container } = render(<DashboardModuleLinks />);

    expect(container).toBeEmptyDOMElement();
  });
});
