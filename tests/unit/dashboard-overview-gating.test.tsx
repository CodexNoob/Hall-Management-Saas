import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() })
}));

import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import type { PermissionKey } from "@/lib/authz/catalog";
import { cacheTestSession, cacheTestSessionForStarterRole, starterPermissionsExcept } from "./auth-session-fixture";

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
  role: string;
  /** For the cases modelling a key set no shipped starter role carries. */
  permissions?: PermissionKey[];
  sections: string[];
  actions: string[];
  tiles: string[];
}> = [
  {
    role: "event-manager",
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
    /*
     * The overview is an EVENTS page, and this role no longer reads events.
     *
     * Every section on it is a count, a timeline or a schedule of bookings,
     * gated on `event.read` or `calendar.read` - and both came off the kitchen
     * roles, because they opened the office's booking workspace and calendar
     * rather than anything the kitchen cooks from. What is left is nothing,
     * which is the correct answer for a cook looking at a bookings overview:
     * their screen is the Kitchen board, and the Kitchen tile is still here to
     * reach it.
     *
     * The page is MVP-hidden in any case (lib/ui/mvp-features.ts), so no cook
     * arrives here by navigating - this pins the gating rather than a screen
     * anyone sees.
     */
    role: "kitchen-staff",
    sections: [],
    actions: [],
    // Empty for the same reason: the module-link row is drawn inside the
    // overview's own body, and this role renders none of it. The Kitchen is
    // still reachable from the sidebar, which is a different component with a
    // different test (dashboard-module-links.test.tsx asserts ["Kitchen"]).
    tiles: []
  },
  {
    // Somebody who handles money and nothing operational. No shipped starter
    // role carries this set - which is the point: what a screen shows follows
    // KEYS, so a tenant who authors a Bookkeeper role gets this with no code
    // change. The two shortcuts it could otherwise reach are the MVP-hidden
    // ones, so it gets none and Quick actions drops its heading rather than
    // showing an empty list.
    role: "a money-only principal",
    permissions: ["calendar.read", "event.read", "invoice.read", "report.read"],
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

  for (const { role, permissions, sections, actions, tiles } of cases) {
    it(`renders exactly the ${role} section set`, () => {
      if (permissions) cacheTestSession(permissions);
      else cacheTestSessionForStarterRole(role);
      renderOverview();

      expect(visibleSections().sort()).toEqual([...sections].sort());
      expect(visibleQuickActions().sort()).toEqual([...actions].sort());
      expect(visibleModuleTiles().sort()).toEqual([...tiles].sort());
    });
  }

  it("renders every section for an administrative role", () => {
    cacheTestSessionForStarterRole("administrator");
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

  it("gives an administrative key set no bypass at all", () => {
    // This is the shape the rebuild removed. There used to be an administrator
    // branch that rendered the page whatever the access row said; now the only
    // thing that opens it is holding the key, and an Administrator stripped of
    // `calendar.read` sees exactly what anyone else stripped of it sees.
    cacheTestSession(starterPermissionsExcept("administrator", ["calendar.read"], []));
    const { container } = renderOverview();

    expect(container).toBeEmptyDOMElement();
    expect(visibleSections()).toEqual([]);
  });

  it("hides the whole page without canViewHome", () => {
    cacheTestSession(starterPermissionsExcept("viewer", ["calendar.read"], []));
    const { container } = renderOverview();

    expect(container).toBeEmptyDOMElement();
  });

  it("hides the income timeline and attention panel without canViewPaymentInfo", () => {
    cacheTestSession(starterPermissionsExcept("viewer", ["invoice.read"], []));
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
    cacheTestSession(starterPermissionsExcept("event-manager", ["payment.record", "payment.notify"], ["invoice.read"]));
    renderOverview();

    expect(
      screen.getByRole("heading", { name: "Income timeline" })
    ).toBeInTheDocument();
  });

  // Content gating and navigation gating are independent: what the page DRAWS
  // follows the content keys, and what it OFFERS follows the route map. Losing
  // the kitchen key takes the shortcut and the tile without touching a single
  // event-derived section.
  it("drops the kitchen destinations while keeping the event sections", () => {
    cacheTestSession(starterPermissionsExcept("viewer", ["kitchen.read"], []));
    renderOverview();

    expect(visibleSections().sort()).toEqual(
      ["bookedEvents", "eventsTimeline", "operatingSchedule", "totalEvents"]
    );
    expect(visibleQuickActions()).toEqual([]);
    expect(visibleModuleTiles().sort()).toEqual(["Calendar", "Events"]);
  });

  it("drops every section when no permission at all is granted", () => {
    cacheTestSession(starterPermissionsExcept("viewer", ["calendar.read", "event.read", "invoice.read", "kitchen.read", "booking.create"], ["calendar.read"]));
    renderOverview();

    expect(visibleSections()).toEqual([]);
    expect(visibleQuickActions()).toEqual([]);
    expect(visibleModuleTiles()).toEqual([]);
  });

  /**
   * Every role that reads events, which is no longer every shipped role.
   *
   * `kitchen-staff` and `kitchen-manager` were dropped from this list when
   * `event.read` came off them: these affordances all open /dashboard/events,
   * and offering a cook a button to a page that answers "Access restricted" is
   * worse than not drawing it. The test below pins the other side of that.
   */
  it("keeps the /dashboard/events affordances clickable for every role that reads events", () => {
    for (const role of [
      "owner",
      "administrator",
      "event-manager",
      "viewer"
    ] as const) {
      window.localStorage.clear();
      cacheTestSessionForStarterRole(role);
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

  /**
   * The other side of it, and the assertion the original report was about: a
   * kitchen role is offered nothing that opens the Events workspace.
   *
   * A hidden button is only a courtesy - `GET /api/events` refuses the request
   * underneath either way - but a courtesy that names a page the person cannot
   * open is worse than no courtesy at all.
   */
  it("offers a kitchen role no route into Events at all", () => {
    for (const role of ["kitchen-manager", "kitchen-staff"] as const) {
      window.localStorage.clear();
      cacheTestSessionForStarterRole(role);
      const { unmount } = renderOverview();

      expect(
        screen.queryByRole("button", { name: /Next upcoming event/ })
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Open events" })).toBeNull();
      expect(
        screen.queryAllByRole("button", { name: "Open Event Manager" })
      ).toHaveLength(0);

      unmount();
    }
  });
});
