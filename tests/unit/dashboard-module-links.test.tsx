import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() })
}));

import { DashboardModuleLinks } from "@/features/dashboard/components/dashboard-module-links";
import { canAccessDashboardRoute } from "@/lib/auth/dashboard-routes";
import { isHiddenDashboardRoute } from "@/lib/ui/mvp-features";
import {
  cacheTestSession,
  cacheTestSessionForStarterRole,
  starterPermissions,
  starterPermissionsExcept
} from "./auth-session-fixture";

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
    description: "Full event file: client, menu, kitchen, staff, and vendors.",
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

// Billing is absent from every row because the MVP hides it outright
// (lib/ui/mvp-features) - the permission map still grants it, which is exactly
// what the reachability test below has to account for.
const cases: Array<{ role: string; expected: string[] }> = [
  { role: "administrator", expected: ["Kitchen", "Calendar", "Events"] },
  { role: "event-manager", expected: ["Kitchen", "Calendar", "Events"] },
  // calendar.read makes /dashboard/events reachable on its own, which is why
  // Events survives for Kitchen Staff.
  { role: "kitchen-staff", expected: ["Kitchen", "Calendar", "Events"] },
  { role: "viewer", expected: ["Kitchen", "Calendar", "Events"] }
];

describe("DashboardModuleLinks role gating", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  for (const { role, expected } of cases) {
    it(`shows exactly ${expected.join(", ")} for ${role}`, () => {
      cacheTestSessionForStarterRole(role);
      render(<DashboardModuleLinks />);

      expect(visibleTiles().sort()).toEqual([...expected].sort());
    });
  }

  // The tiles must agree with the sidebar and the layout guard, which use
  // canAccessDashboardRoute and the MVP gate together. This is the assertion
  // that catches a mis-mapped tile route.
  it("offers a tile exactly when its route is reachable", () => {
    for (const { role } of cases) {
      window.localStorage.clear();
      cacheTestSessionForStarterRole(role);
      const { unmount } = render(<DashboardModuleLinks />);
      const shown = visibleTiles();

      for (const [title, tile] of Object.entries(tiles)) {
        expect(
          shown.includes(title),
          `${role}: tile ${title} visibility must match canAccessDashboardRoute("${tile.route}") and the MVP gate`
        ).toBe(
          !isHiddenDashboardRoute(tile.route) &&
            canAccessDashboardRoute(tile.route, starterPermissions(role))
        );
      }

      unmount();
    }
  });

  it("exposes the tile row as a labelled region", () => {
    cacheTestSessionForStarterRole("viewer");
    render(<DashboardModuleLinks />);

    expect(
      screen.getByRole("region", { name: "Module shortcuts" })
    ).toBeInTheDocument();
  });

  it("renders nothing when no tile is reachable", () => {
    cacheTestSession(starterPermissionsExcept("viewer", ["calendar.read", "event.read", "kitchen.read", "invoice.read"], []));
    const { container } = render(<DashboardModuleLinks />);

    expect(container).toBeEmptyDOMElement();
  });
});
