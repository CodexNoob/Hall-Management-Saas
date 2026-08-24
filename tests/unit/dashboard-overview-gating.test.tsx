import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() })
}));

import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import type { StaffRoleValue } from "@/lib/auth/permissions";
import { cacheTestSession, cacheTestSessionForRole } from "./auth-session-fixture";

// Gating follows the VIEW permissions and the route map, not the Staff page's
// role-matrix columns. Those columns are all-of checks over groups mixing view
// and edit rights, so they report "-" for a role that can still open the page
// (e.g. Viewer has canViewKitchenDashboard but not canAssignWorkers). Mirroring
// them would hide surfaces the sidebar offers and the layout guard allows.
const sectionHeadings = {
  totalEvents: "Total Events",
  bookedEvents: "Booked Events",
  incomeTimeline: "Income timeline",
  operatingSchedule: "Operating schedule",
  eventsTimeline: "Events timeline",
  attentionNeeded: "Attention needed",
  quickActions: "Quick actions"
} as const;

// "Open billing" is BOTH a quick-action button label and the Billing tile's
// actionLabel, and a tile button's accessible name is its whole concatenated
// card text - so tiles are matched on their unique description and quick
// actions on exact button names only.
const tileDescriptions = {
  Kitchen: "Menu production, quantities, workers, and completion status.",
  Calendar: "Month view with room availability and closed-date rules.",
  Events: "Full event file: client, menu, kitchen, staff, and vendors.",
  Billing: "Retainers, invoices, payment links, and balances due."
} as const;

function renderOverview() {
  return render(
    <DashboardOverview
      annualGroups={[]}
      annualRangeLabel="Jan 1 - Dec 31"
      annualTotalEvents={0}
      bookedEvents={{ confirmed: 0, onHold: 0, total: 0 }}
      customEndDate="2026-01-07"
      customStartDate="2026-01-01"
      dashboardError={null}
      financeTimeFilter="month"
      financialRangeLabel="Jan 1 - Jan 31"
      financialTimeline={[]}
      isAnnualLoading={false}
      isDashboardLoading={false}
      nextUpcomingEvent={undefined}
      rangeLabel="Jan 1 - Jan 7"
      schedulePage={1}
      schedulePageCount={1}
      schedulePageNumbers={[1]}
      scheduleRows={[]}
      timeFilter="week"
      timelineGroups={[]}
      totalEvents={0}
      visibleScheduleRows={[]}
      onCustomEndDateChange={vi.fn()}
      onCustomStartDateChange={vi.fn()}
      onFinanceTimeFilterChange={vi.fn()}
      onSchedulePageChange={vi.fn()}
      onTimeFilterChange={vi.fn()}
    />
  );
}

function visibleSections() {
  return Object.entries(sectionHeadings)
    .filter(([, name]) => screen.queryByRole("heading", { name }) !== null)
    .map(([key]) => key);
}

function visibleQuickActions() {
  return ["Kitchen board", "Open billing", "Dining sheets"].filter(
    (name) => screen.queryByRole("button", { name }) !== null
  );
}

function visibleModuleTiles() {
  return Object.entries(tileDescriptions)
    .filter(([, description]) => screen.queryByText(description) !== null)
    .map(([title]) => title);
}

// Billing and Dining Manager are hidden for the MVP (lib/ui/mvp-features), so
// "Kitchen board" is the only quick action and the Billing tile never appears -
// for any role, including admin. The permission map is unchanged; this is the
// product gate sitting in front of it.
//
// useDashboardAccess is useMemo(..., []) and reads localStorage once per mount,
// so each role needs its own render.
const cases: Array<{
  role: StaffRoleValue;
  sections: string[];
  actions: string[];
  tiles: string[];
}> = [
  {
    role: "manager",
    sections: [
      "totalEvents",
      "bookedEvents",
      "incomeTimeline",
      "operatingSchedule",
      "eventsTimeline",
      "attentionNeeded",
      "quickActions"
    ],
    actions: ["Kitchen board"],
    tiles: ["Kitchen", "Calendar", "Events"]
  },
  {
    // canViewMenu/canViewKitchenDashboard but no canViewPaymentInfo, and
    // /dashboard/events is reachable through canViewCalendar.
    role: "kitchen",
    sections: [
      "totalEvents",
      "bookedEvents",
      "operatingSchedule",
      "eventsTimeline",
      "quickActions"
    ],
    actions: ["Kitchen board"],
    tiles: ["Kitchen", "Calendar", "Events"]
  },
  {
    // Billing Staff has no kitchen permission of its own, and the two shortcuts
    // it could otherwise reach are the hidden ones - so it gets none, and the
    // Quick actions panel drops its heading rather than showing an empty list.
    role: "billing",
    sections: [
      "totalEvents",
      "bookedEvents",
      "incomeTimeline",
      "operatingSchedule",
      "eventsTimeline",
      "attentionNeeded"
    ],
    actions: [],
    tiles: ["Calendar", "Events"]
  },
  {
    // Read-only across the board: sees the operational surfaces it can open,
    // but no payment data and no booking action.
    role: "viewer",
    sections: [
      "totalEvents",
      "bookedEvents",
      "operatingSchedule",
      "eventsTimeline",
      "quickActions"
    ],
    actions: ["Kitchen board"],
    tiles: ["Kitchen", "Calendar", "Events"]
  }
];

describe("DashboardOverview role gating", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  for (const { role, sections, actions, tiles } of cases) {
    it(`renders exactly the ${role} section set`, () => {
      cacheTestSessionForRole(role);
      renderOverview();

      expect(visibleSections().sort()).toEqual([...sections].sort());
      expect(visibleQuickActions().sort()).toEqual([...actions].sort());
      expect(visibleModuleTiles().sort()).toEqual([...tiles].sort());
    });
  }

  it("renders every section for an administrative role", () => {
    cacheTestSessionForRole("admin");
    renderOverview();

    expect(visibleSections().sort()).toEqual(
      Object.keys(sectionHeadings).sort()
    );
    expect(visibleQuickActions()).toEqual(["Kitchen board"]);
    expect(visibleModuleTiles().sort()).toEqual(
      Object.keys(tileDescriptions)
        .filter((title) => title !== "Billing")
        .sort()
    );
  });

  it("lets an administrative role through even with an all-false access row", () => {
    cacheTestSession("admin", {
      canViewHome: false,
      canViewCalendar: false,
      canViewEventManager: false,
      canViewPaymentInfo: false
    });
    renderOverview();

    expect(visibleSections().sort()).toEqual(
      Object.keys(sectionHeadings).sort()
    );
  });

  it("hides the whole page without canViewHome", () => {
    cacheTestSession("viewer", { canViewHome: false });
    const { container } = renderOverview();

    expect(container).toBeEmptyDOMElement();
  });

  it("hides the income timeline and attention panel without canViewPaymentInfo", () => {
    cacheTestSession("viewer", { canViewPaymentInfo: false });
    renderOverview();

    expect(
      screen.queryByRole("heading", { name: "Income timeline" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Attention needed" })
    ).not.toBeInTheDocument();
    // The fabricated open-balance sample line goes with it.
    expect(screen.queryByText("Friedman Dinner:")).not.toBeInTheDocument();
  });

  it("shows the income timeline for a view-only payment role", () => {
    // The Staff page's Billing column also needs canManagePayments and
    // canSendPaymentEmail, so it reads "-" here - the timeline is still correct
    // to show, because the API returns real figures for canViewPaymentInfo.
    cacheTestSession("manager", {
      canViewPaymentInfo: true,
      canManagePayments: false,
      canSendPaymentEmail: false
    });
    renderOverview();

    expect(
      screen.getByRole("heading", { name: "Income timeline" })
    ).toBeInTheDocument();
  });

  // Content gating and navigation gating are independent: losing event
  // visibility removes the event-derived sections but keeps a shortcut to a page
  // the user can still open.
  it("drops the event overview when neither calendar nor event-manager view is granted", () => {
    cacheTestSession("viewer", {
      canViewHome: true,
      canViewCalendar: false,
      canViewEventManager: false,
      canViewPaymentInfo: false
      // canViewKitchenDashboard stays true, which keeps /dashboard/kitchen
      // reachable.
    });
    renderOverview();

    expect(visibleSections()).toEqual(["quickActions"]);
    expect(visibleQuickActions()).toEqual(["Kitchen board"]);
    expect(visibleModuleTiles()).toEqual(["Kitchen"]);
  });

  it("drops every section when no permission at all is granted", () => {
    cacheTestSession("viewer", {
      canViewHome: true,
      canViewCalendar: false,
      canViewEventManager: false,
      canViewPaymentInfo: false,
      canViewKitchenDashboard: false,
      canCreateBooking: false
    });
    renderOverview();

    expect(visibleSections()).toEqual([]);
    expect(visibleQuickActions()).toEqual([]);
    expect(visibleModuleTiles()).toEqual([]);
  });

  it("keeps the /dashboard/events affordances clickable for every shipped role", () => {
    for (const role of ["manager", "kitchen", "billing", "viewer"] as const) {
      window.localStorage.clear();
      cacheTestSessionForRole(role);
      const { unmount } = renderOverview();

      expect(
        screen.getByRole("button", { name: /Next upcoming event/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Open events" })
      ).toBeInTheDocument();
      // Rendered twice: the mobile list and the desktop table each mount their
      // own empty state, hidden from one another only by responsive classes.
      expect(
        screen.getAllByRole("button", { name: "Open Event Manager" })
      ).toHaveLength(2);

      unmount();
    }
  });
});
