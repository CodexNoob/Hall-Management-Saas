import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() })
}));

import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
import { EventKitchenContent } from "@/features/events/components/event-kitchen-content";
import type {
  EventFile,
  EventKitchenLine,
  EventKitchenSheet
} from "@/features/events/components/event-manager-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { cacheTestSession } from "./auth-session-fixture";

/**
 * What the kitchen tab says when the numbers are known, and - the ones that
 * matter - what it says instead of a number when they are not.
 *
 * The dish list is rendered twice, as cards under `md` and as a table above it,
 * because CSS decides which is visible and jsdom keeps both. Assertions here use
 * the `All` queries for anything inside that list.
 */

// Typed in full rather than cast, so a field added to EventFile fails here
// instead of leaving the fixture quietly out of step with the real row.
function eventFile(id: string): EventFile {
  return {
    id,
    bookingStatus: "INQUIRY",
    clientName: "Client",
    eventType: "Wedding",
    eventTypeId: "event-type-1",
    title: `Event ${id}`,
    date: "Aug 20, 2026",
    dateInput: "2026-08-20",
    time: "6:30 PM",
    timeInput: "18:30",
    hallId: "hall-1",
    room: "Main Hall",
    packageName: "Gold dinner",
    guests: "187",
    children: "12",
    couples: "40",
    coordinator: "Unassigned",
    balance: "See billing",
    status: "Hold",
    paymentStatus: "No invoice",
    version: 1,
    cancelledAt: null,
    completedAt: null,
    waitersCount: 8,
    setupTime: "",
    washingTime: "",
    tableclothName: "",
    notes: [],
    internalNotes: "",
    daveningNote: "",
    memberShulName: "",
    sideBoxes: "",
    shabbosSetup: "",
    diningManagerNotes: null,
    activityLogs: [],
    diningHallMapPreset: null,
    phone: "",
    email: "",
    workspaceData: {},
    menuItemIds: []
  };
}

function dishLine(overrides: Partial<EventKitchenLine> = {}): EventKitchenLine {
  return {
    id: "line-1",
    menuItemId: "item-1",
    addOnId: null,
    kind: "Dish",
    name: "Braised short ribs",
    pictureUrl: null,
    serviceStyle: "Buffet",
    availableStyles: ["Buffet"],
    notes: null,
    sortOrder: 0,
    isRetired: false,
    quantities: [{ unit: "tray", units: 7, raw: 6.233333 }],
    unresolvedBases: [],
    countState: "Counted",
    status: null,
    assignedWorkerId: null,
    assignedWorkerName: null,
    ...overrides
  };
}

function sheet(lines: EventKitchenLine[]): EventKitchenSheet {
  const dishes = lines.filter((line) => line.kind === "Dish");

  return {
    meal: "Main",
    menuStatus: "Draft",
    confirmedAt: null,
    version: 1,
    counts: {
      totalGuests: 187,
      couples: 40,
      men: 50,
      ladies: 45,
      boys: 6,
      girls: 4,
      kids: 2,
      waiters: 8,
      tables: null
    },
    lines,
    summary: {
      dishes: dishes.length,
      addOns: lines.length - dishes.length,
      complete: dishes.filter((line) => line.status === "COMPLETE").length,
      pending: dishes.filter((line) => line.status === "PENDING").length,
      notStarted: dishes.filter((line) => line.status === null).length,
      needsAttention: dishes.filter((line) =>
        ["NeedsStyle", "NoRule", "Unresolved"].includes(line.countState)
      ).length,
      unresolvedBases: [
        ...new Set(lines.flatMap((line) => line.unresolvedBases))
      ]
    }
  };
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as unknown as Response;
}

/** Which lines each event's sheet comes back with. */
const sheets = new Map<string, EventKitchenLine[]>();

/** Requests held open until the test hands them a response. */
const pendingRequests = new Map<string, Promise<Response>>();

/**
 * Makes the next GET for a url hang, and returns the function that finishes it.
 * Holding the request open is what makes the loading state assertable instead of
 * something the test has to race.
 */
function defer(url: string) {
  let settle: (response: Response) => void = () => {};
  const pending = new Promise<Response>((resolve) => {
    settle = resolve;
  });

  pendingRequests.set(url, pending);

  return async (body: unknown) => {
    await act(async () => {
      settle(jsonResponse(body));
      await pending;
    });
  };
}

async function mount(ui: React.ReactElement) {
  let view: ReturnType<typeof render> | null = null;

  await act(async () => {
    view = render(ui);
  });

  return view as unknown as ReturnType<typeof render>;
}

async function rerender(
  view: ReturnType<typeof render>,
  ui: React.ReactElement
) {
  await act(async () => {
    view.rerender(ui);
  });
}

describe("event kitchen tab", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cacheTestSession("manager");
    sheets.clear();
    pendingRequests.clear();
    clearAuthenticatedQueryCache();

    vi.mocked(authenticatedFetch).mockReset();
    vi.mocked(authenticatedFetch).mockImplementation(async (input) => {
      const url = String(input);
      const held = pendingRequests.get(url);

      if (held) {
        pendingRequests.delete(url);
        return held;
      }

      const eventId = /^\/api\/events\/([^/]+)\/kitchen$/.exec(url)?.[1] ?? "";

      return jsonResponse({ kitchen: sheet(sheets.get(eventId) ?? []) });
    });
  });

  it("draws the sheet's shape, not an empty sheet, while the first load is in the air", async () => {
    const finishLoad = defer("/api/events/event-1/kitchen");

    await mount(<EventKitchenContent event={eventFile("event-1")} />);

    expect(screen.getByText(/Loading this event/)).toBeInTheDocument();
    // The panel's own heading stays up through the load - the workspace tab is
    // identified by it, and a header that comes and goes makes the panel jump.
    expect(
      screen.getByRole("heading", { name: "Kitchen sheet" })
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No menu for this event yet")
    ).not.toBeInTheDocument();

    await finishLoad({ kitchen: sheet([dishLine()]) });

    expect(screen.queryByText(/Loading this event/)).not.toBeInTheDocument();
    // Twice: once in the card list, once in the table. Asserting the exact
    // count is what makes deleting either rendering fail this suite.
    expect(screen.getAllByText("7 trays")).toHaveLength(2);
  });

  it("shows the quantity the server worked out, and where it came from", async () => {
    sheets.set("event-1", [dishLine()]);

    await mount(<EventKitchenContent event={eventFile("event-1")} />);

    expect(screen.getAllByText("7 trays")).toHaveLength(2);
    expect(screen.getAllByText("6.23 before rounding")).toHaveLength(2);
    expect(screen.getByText("187")).toBeInTheDocument();
  });

  it("never shows the previous event's dishes under the newly selected event", async () => {
    sheets.set("event-1", [dishLine()]);
    sheets.set("event-2", [dishLine({ id: "line-2", name: "Potato kugel" })]);

    const view = await mount(
      <EventKitchenContent event={eventFile("event-1")} />
    );

    expect(screen.getAllByText("Braised short ribs")).toHaveLength(2);

    const finishLoad = defer("/api/events/event-2/kitchen");
    await rerender(view, <EventKitchenContent event={eventFile("event-2")} />);

    expect(screen.queryAllByText("Braised short ribs")).toHaveLength(0);

    await finishLoad({ kitchen: sheet(sheets.get("event-2") ?? []) });

    expect(screen.getAllByText("Potato kugel")).toHaveLength(2);
  });

  it("says the dining plan is missing instead of printing a zero", async () => {
    sheets.set("event-1", [
      dishLine({
        name: "Dips",
        quantities: [],
        unresolvedBases: ["Tables"],
        countState: "Unresolved"
      })
    ]);

    await mount(<EventKitchenContent event={eventFile("event-1")} />);

    expect(screen.getAllByText("Needs the dining plan")).toHaveLength(2);
    // No invented number anywhere on the row.
    expect(
      screen.queryAllByText(/\d+\s+(tray|set|plate|portion)s?\b/)
    ).toHaveLength(0);
    expect(
      screen.getByText(/Draw the dining plan so per-table rules/)
    ).toBeInTheDocument();
  });

  it("asks for a service style rather than guessing one", async () => {
    sheets.set("event-1", [
      dishLine({
        name: "Chicken",
        serviceStyle: null,
        availableStyles: ["Buffet", "Plated"],
        quantities: [],
        countState: "NeedsStyle"
      })
    ]);

    await mount(<EventKitchenContent event={eventFile("event-1")} />);

    expect(screen.getAllByText("Needs a service style")).toHaveLength(2);
    expect(
      screen.getByText(/Set a service style on the Menu tab/)
    ).toBeInTheDocument();
  });

  it("names each dish's kitchen status", async () => {
    sheets.set("event-1", [
      dishLine({ id: "line-done", name: "Challah rolls", status: "COMPLETE" }),
      dishLine({ id: "line-doing", name: "Chicken soup", status: "PENDING" }),
      dishLine({ id: "line-idle", name: "Potato kugel", status: null })
    ]);

    await mount(<EventKitchenContent event={eventFile("event-1")} />);

    // Asserted per row, not by counting badges: three dishes in three different
    // states produce the same three labels whichever way the mapping is wired,
    // so only the pairing of dish to label can catch it being swapped.
    const rows = screen.getAllByRole("row");
    const rowFor = (dish: string) => {
      const row = rows.find((candidate) => within(candidate).queryByText(dish));

      if (!row) throw new Error(`No table row for ${dish}`);

      return row;
    };

    expect(
      within(rowFor("Challah rolls")).getByText("Complete")
    ).toBeInTheDocument();
    expect(
      within(rowFor("Chicken soup")).getByText("Pending")
    ).toBeInTheDocument();
    expect(
      within(rowFor("Potato kugel")).getByText("Not started")
    ).toBeInTheDocument();
    // And once more in the card list that renders under `md`.
    expect(screen.getAllByText("Complete")).toHaveLength(2);
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByText("1 pending · 1 not started")).toBeInTheDocument();
  });

  it("lists add-ons apart from the dishes, with no status of their own", async () => {
    sheets.set("event-1", [
      dishLine({ isRetired: true }),
      dishLine({
        id: "line-addon",
        menuItemId: null,
        addOnId: "addon-1",
        kind: "AddOn",
        name: "Viennese table",
        serviceStyle: null,
        availableStyles: [],
        quantities: [],
        countState: "NotCounted"
      })
    ]);

    await mount(<EventKitchenContent event={eventFile("event-1")} />);

    expect(screen.getByText("Add-ons")).toBeInTheDocument();
    // Once, in its own section - an add-on is never a row in the dish table,
    // and the Prepared tile counts dishes only.
    expect(screen.getAllByText("Viennese table")).toHaveLength(1);
    expect(screen.getByText("0/1")).toBeInTheDocument();
    expect(screen.getAllByText("Retired from the library")).toHaveLength(2);
  });

  it("points at the Menu tab when the event has no menu yet", async () => {
    await mount(<EventKitchenContent event={eventFile("event-1")} />);

    expect(screen.getByText("No menu for this event yet")).toBeInTheDocument();
    expect(screen.getByText(/Add dishes on the Menu tab/)).toBeInTheDocument();
  });

  it("shows the kitchen board only to a role that may open it", async () => {
    sheets.set("event-1", [dishLine()]);

    const granted = await mount(
      <EventKitchenContent event={eventFile("event-1")} />
    );

    expect(
      screen.getByRole("button", { name: "Kitchen board" })
    ).toBeInTheDocument();

    // Both halves in one test on purpose. The trap note in auth-session-fixture
    // warns that these fixtures go inert the moment identity stops being read
    // from localStorage, and an inert fixture hides the button in BOTH halves -
    // so only a differential in a single test can see it happen.
    await act(async () => {
      granted.unmount();
    });
    cacheTestSession("manager", { canViewKitchenDashboard: false });
    clearAuthenticatedQueryCache();

    await mount(<EventKitchenContent event={eventFile("event-1")} />);

    expect(screen.getAllByText("7 trays")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Kitchen board" })
    ).not.toBeInTheDocument();
  });
});
