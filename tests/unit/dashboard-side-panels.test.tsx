import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() })
}));

import { DashboardSidePanels } from "@/features/dashboard/components/dashboard-side-panels";
import { cacheTestSession, cacheTestSessionForRole } from "./auth-session-fixture";

function renderPanels() {
  return render(
    <DashboardSidePanels
      isLoading={false}
      rangeLabel="This week"
      timelineGroups={[]}
      totalEvents={0}
    />
  );
}

// Route shortcuts follow canAccessRoute, the same any-of check the sidebar uses,
// plus the MVP gate the sidebar now applies first - so the panel offers a
// destination exactly when the sidebar would. Billing and Dining Manager are
// hidden for the MVP (lib/ui/mvp-features), which leaves Kitchen board as the
// only shortcut any role can be offered.
describe("DashboardSidePanels quick actions", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("offers every surviving shortcut to an Event Manager", () => {
    cacheTestSessionForRole("manager");
    renderPanels();

    expect(
      screen.getByRole("button", { name: "Kitchen board" })
    ).toBeInTheDocument();
    for (const label of ["Open billing", "Dining sheets"]) {
      expect(
        screen.queryByRole("button", { name: label })
      ).not.toBeInTheDocument();
    }
  });

  it("gives a Viewer the pages it can open, but not billing", () => {
    cacheTestSessionForRole("viewer");
    renderPanels();

    // canViewKitchenDashboard makes this one reachable, which is why the
    // sidebar lists it too.
    expect(
      screen.getByRole("button", { name: "Kitchen board" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Book event" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open billing" })
    ).not.toBeInTheDocument();
  });

  it("does not show Book event even when canCreateBooking is granted", () => {
    cacheTestSession("viewer", { canCreateBooking: false });
    const first = renderPanels();
    expect(
      screen.queryByRole("button", { name: "Book event" })
    ).not.toBeInTheDocument();
    first.unmount();

    window.localStorage.clear();
    cacheTestSession("viewer", { canCreateBooking: true });
    renderPanels();
    expect(
      screen.queryByRole("button", { name: "Book event" })
    ).not.toBeInTheDocument();
  });

  // Billing Staff has neither the kitchen permission nor a module the MVP still
  // ships, so the shortcut list empties out for that role entirely.
  it("leaves Billing Staff with no shortcut at all", () => {
    cacheTestSessionForRole("billing");
    renderPanels();

    for (const label of ["Kitchen board", "Open billing", "Dining sheets"]) {
      expect(
        screen.queryByRole("button", { name: label })
      ).not.toBeInTheDocument();
    }
  });

  it("drops the panel entirely when no shortcut survives", () => {
    cacheTestSession("viewer", {
      canCreateBooking: false,
      canViewKitchenDashboard: false,
      canViewEventManager: false,
      canViewPaymentInfo: false
    });
    renderPanels();

    expect(
      screen.queryByRole("heading", { name: "Quick actions" })
    ).not.toBeInTheDocument();
  });
});

describe("DashboardSidePanels Attention needed panel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  // The panel's hardcoded sample items include an open-balance notice, so it
  // follows payment visibility.
  for (const role of ["manager", "billing"] as const) {
    it(`is shown for ${role}, which can view payment info`, () => {
      cacheTestSessionForRole(role);
      renderPanels();

      expect(
        screen.getByRole("heading", { name: "Attention needed" })
      ).toBeInTheDocument();
    });
  }

  for (const role of ["kitchen", "viewer"] as const) {
    it(`is hidden for ${role}, keeping the open-balance notice out of view`, () => {
      cacheTestSessionForRole(role);
      renderPanels();

      expect(
        screen.queryByRole("heading", { name: "Attention needed" })
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Friedman Dinner:")).not.toBeInTheDocument();
    });
  }
});

describe("DashboardSidePanels events timeline", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is shown for every shipped role", () => {
    for (const role of ["manager", "kitchen", "billing", "viewer"] as const) {
      window.localStorage.clear();
      cacheTestSessionForRole(role);
      const { unmount } = renderPanels();
      expect(
        screen.getByRole("heading", { name: "Events timeline" })
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("is hidden without either event view permission", () => {
    cacheTestSession("viewer", {
      canViewCalendar: false,
      canViewEventManager: false
    });
    renderPanels();

    expect(
      screen.queryByRole("heading", { name: "Events timeline" })
    ).not.toBeInTheDocument();
  });

  it("returns nothing at all when no panel in the column survives", () => {
    cacheTestSession("viewer", {
      canViewCalendar: false,
      canViewEventManager: false,
      canViewKitchenDashboard: false,
      canCreateBooking: false,
      canViewPaymentInfo: false
    });
    const { container } = renderPanels();

    expect(container).toBeEmptyDOMElement();
  });
});
