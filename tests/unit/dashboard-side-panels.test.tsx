import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() })
}));

import { DashboardSidePanels } from "@/features/dashboard/components/dashboard-side-panels";
import { cacheSyncedUser, cacheSyncedUserForRole } from "./synced-user-fixture";

function renderPanels() {
  return render(
    <DashboardSidePanels
      isLoading={false}
      onNewBooking={vi.fn()}
      rangeLabel="This week"
      timelineGroups={[]}
      totalEvents={0}
    />
  );
}

// Route shortcuts follow canAccessRoute, the same any-of check the sidebar uses,
// so the panel offers a destination exactly when the sidebar would. "Book event"
// opens a dialog instead, so it keeps canCreateBooking.
describe("DashboardSidePanels quick actions", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("offers every shortcut to an Event Manager", () => {
    cacheSyncedUserForRole("manager");
    renderPanels();

    for (const label of [
      "Book event",
      "Kitchen board",
      "Open billing",
      "Dining sheets"
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("gives a Viewer the pages it can open, but not Book event or billing", () => {
    cacheSyncedUserForRole("viewer");
    renderPanels();

    // canViewKitchenDashboard and canViewEventManager make both routes
    // reachable, which is why the sidebar lists them too.
    expect(
      screen.getByRole("button", { name: "Kitchen board" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dining sheets" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Book event" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open billing" })
    ).not.toBeInTheDocument();
  });

  it("hides Book event without canCreateBooking and shows it with", () => {
    cacheSyncedUser("viewer", { canCreateBooking: false });
    const first = renderPanels();
    expect(
      screen.queryByRole("button", { name: "Book event" })
    ).not.toBeInTheDocument();
    first.unmount();

    window.localStorage.clear();
    cacheSyncedUser("viewer", { canCreateBooking: true });
    renderPanels();
    expect(
      screen.getByRole("button", { name: "Book event" })
    ).toBeInTheDocument();
  });

  it("hides the kitchen shortcut for Billing Staff but keeps the reachable ones", () => {
    cacheSyncedUserForRole("billing");
    renderPanels();

    expect(
      screen.getByRole("button", { name: "Open billing" })
    ).toBeInTheDocument();
    // /dashboard/dining-manager accepts canViewEventManager, which Billing has.
    expect(
      screen.getByRole("button", { name: "Dining sheets" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Kitchen board" })
    ).not.toBeInTheDocument();
  });

  it("drops the panel entirely when no shortcut survives", () => {
    cacheSyncedUser("viewer", {
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
      cacheSyncedUserForRole(role);
      renderPanels();

      expect(
        screen.getByRole("heading", { name: "Attention needed" })
      ).toBeInTheDocument();
    });
  }

  for (const role of ["kitchen", "viewer"] as const) {
    it(`is hidden for ${role}, keeping the open-balance notice out of view`, () => {
      cacheSyncedUserForRole(role);
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
      cacheSyncedUserForRole(role);
      const { unmount } = renderPanels();
      expect(
        screen.getByRole("heading", { name: "Events timeline" })
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("is hidden without either event view permission", () => {
    cacheSyncedUser("viewer", {
      canViewCalendar: false,
      canViewEventManager: false
    });
    renderPanels();

    expect(
      screen.queryByRole("heading", { name: "Events timeline" })
    ).not.toBeInTheDocument();
  });

  it("returns nothing at all when no panel in the column survives", () => {
    cacheSyncedUser("viewer", {
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
