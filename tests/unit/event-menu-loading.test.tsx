import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
import { EventMenuContent } from "@/features/events/components/event-menu-content";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import type {
  EventFile,
  EventMenuDocument
} from "@/features/events/components/event-manager-shared";
import { cacheTestSessionForStarterRole } from "./auth-session-fixture";

/**
 * What the menu tab does while it has nothing to show, and what it shows when
 * the event under it changes.
 *
 * The second one is the regression: this component is not remounted when the
 * sidebar selects another event, only handed a new `event` prop, so anything it
 * keeps in local state outlives the event it was read for. It used to keep the
 * whole menu there, which meant that for as long as the new event's menu took
 * to arrive, the previous event's dishes were on screen presented as this
 * event's - and the kitchen quantities are cooked off that list.
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
    time: "2:00 AM",
    timeInput: "02:00",
    hallId: "hall-1",
    room: "E2E Hall",
    packageName: "Not assigned",
    guests: "80",
    children: "0",
    couples: "0",
    coordinator: "Unassigned",
    balance: "See billing",
    status: "Hold",
    paymentStatus: "No invoice",
    version: 1,
    cancelledAt: null,
    completedAt: null,
    waitersCount: 0,
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

function menuDocument(dishNames: string[]): EventMenuDocument {
  return {
    id: "menu-1",
    meal: "Main",
    status: "Draft",
    serviceStyle: null,
    confirmedAt: null,
    version: 1,
    confirmedBy: null,
    packageId: null,
    lines: dishNames.map((name, index) => ({
      id: `line-${name}`,
      menuItemId: `item-${name}`,
      addOnId: null,
      kind: "Dish" as const,
      name,
      pictureUrl: null,
      serviceStyle: "Buffet",
      availableStyles: ["Buffet"],
      price: null,
      notes: null,
      sortOrder: index,
      quantityMultiplier: 1,
      source: "Manual",
      isRetired: false
    }))
  };
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as unknown as Response;
}

/** Which dishes each event's menu comes back with. */
const menus = new Map<string, string[]>();

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

function menuGetsFor(eventId: string) {
  return vi
    .mocked(authenticatedFetch)
    .mock.calls.filter(
      ([url, init]) =>
        url === `/api/events/${eventId}/menu` &&
        (init?.method ?? "GET") === "GET"
    ).length;
}

const noop = async () => undefined;

describe("event menu tab loading", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cacheTestSessionForStarterRole("event-manager");
    menus.clear();
    pendingRequests.clear();
    clearAuthenticatedQueryCache();

    vi.mocked(authenticatedFetch).mockReset();
    vi.mocked(authenticatedFetch).mockImplementation(async (input, init) => {
      const url = String(input);

      if (url === "/api/menu") {
        return jsonResponse({ items: [], addOns: [] });
      }

      const eventId = /^\/api\/events\/([^/]+)\/menu$/.exec(url)?.[1] ?? "";

      // A write answers with the whole saved menu, the way the route does.
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as {
          lines: Array<{ menuItemId: string | null }>;
        };
        const saved = body.lines.map((line) =>
          String(line.menuItemId).replace("item-", "")
        );
        menus.set(eventId, saved);

        return jsonResponse({ menu: menuDocument(saved) });
      }

      const held = pendingRequests.get(url);

      if (held) {
        pendingRequests.delete(url);
        return held;
      }

      return jsonResponse({ menu: menuDocument(menus.get(eventId) ?? []) });
    });
  });

  it("draws the menu's shape, not an empty menu, while the first load is in the air", async () => {
    const finishLoad = defer("/api/events/event-1/menu");

    await mount(
      <EventMenuContent event={eventFile("event-1")} onEventSaved={noop} />
    );

    expect(screen.getByText(/Loading this event/)).toBeInTheDocument();
    // The panel's own heading stays up through the load - the workspace tab is
    // identified by it, and a header that comes and goes makes the panel jump.
    expect(
      screen.getByRole("heading", { name: "Menu for this event" })
    ).toBeInTheDocument();
    // Nothing offers to edit a menu that has not arrived.
    expect(
      screen.queryByRole("button", { name: "Add buffet item" })
    ).not.toBeInTheDocument();

    await finishLoad({ menu: menuDocument(["Soup"]) });

    expect(screen.queryByText(/Loading this event/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Soup" })
    ).toBeInTheDocument();
  });

  it("never shows the previous event's dishes under the newly selected event", async () => {
    menus.set("event-1", ["Soup"]);
    menus.set("event-2", ["Salad"]);

    const view = await mount(
      <EventMenuContent event={eventFile("event-1")} onEventSaved={noop} />
    );

    expect(
      screen.getByRole("button", { name: "Remove Soup" })
    ).toBeInTheDocument();

    const finishLoad = defer("/api/events/event-2/menu");

    await rerender(
      view,
      <EventMenuContent event={eventFile("event-2")} onEventSaved={noop} />
    );

    expect(
      screen.queryByRole("button", { name: "Remove Soup" })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Loading this event/)).toBeInTheDocument();

    await finishLoad({ menu: menuDocument(["Salad"]) });

    expect(
      screen.getByRole("button", { name: "Remove Salad" })
    ).toBeInTheDocument();
  });

  // The narrow case the optimistic overlay's url tag is there for: the switch
  // lands on an event whose menu is already cached, so there is no loading state
  // to hide behind and whatever the overlay holds goes straight on screen.
  it("does not carry an in-flight edit over to the next event", async () => {
    menus.set("event-1", ["Soup", "Salad"]);
    menus.set("event-2", ["Kugel"]);

    // Visited first so event-2's menu is in the cache for the switch below.
    const view = await mount(
      <EventMenuContent event={eventFile("event-2")} onEventSaved={noop} />
    );
    await rerender(
      view,
      <EventMenuContent event={eventFile("event-1")} onEventSaved={noop} />
    );

    // A save that never comes back, so the edit is still optimistic when the
    // user gives up waiting and clicks the other event.
    const holdSave = defer("/api/events/event-1/menu");
    vi.mocked(authenticatedFetch).mockImplementationOnce(
      async () => pendingRequests.get("/api/events/event-1/menu")!
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove Soup" }));
    });

    await rerender(
      view,
      <EventMenuContent event={eventFile("event-2")} onEventSaved={noop} />
    );

    expect(
      screen.getByRole("button", { name: "Remove Kugel" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Salad" })
    ).not.toBeInTheDocument();

    await holdSave({ menu: menuDocument(["Salad"]) });

    // The save landed against the event it was made on, not the one now open.
    expect(
      screen.getByRole("button", { name: "Remove Kugel" })
    ).toBeInTheDocument();

    await rerender(
      view,
      <EventMenuContent event={eventFile("event-1")} onEventSaved={noop} />
    );

    expect(
      screen.getByRole("button", { name: "Remove Salad" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Soup" })
    ).not.toBeInTheDocument();
  });

  it("shows a revisited event's menu straight away, with no second request", async () => {
    menus.set("event-1", ["Soup"]);
    menus.set("event-2", ["Salad"]);

    const view = await mount(
      <EventMenuContent event={eventFile("event-1")} onEventSaved={noop} />
    );
    await rerender(
      view,
      <EventMenuContent event={eventFile("event-2")} onEventSaved={noop} />
    );
    await rerender(
      view,
      <EventMenuContent event={eventFile("event-1")} onEventSaved={noop} />
    );

    expect(screen.queryByText(/Loading this event/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Soup" })
    ).toBeInTheDocument();
    expect(menuGetsFor("event-1")).toBe(1);
  });

  // The old code invalidated the cache after every save, so the menu the server
  // had just handed back was thrown away and the next visit paid to read it
  // again. This is that round trip not happening.
  it("keeps a saved menu warm, so coming back to the event costs no request", async () => {
    menus.set("event-1", ["Soup", "Salad"]);
    menus.set("event-2", []);

    const view = await mount(
      <EventMenuContent event={eventFile("event-1")} onEventSaved={noop} />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove Soup" }));
    });

    expect(
      screen.queryByRole("button", { name: "Remove Soup" })
    ).not.toBeInTheDocument();

    await rerender(
      view,
      <EventMenuContent event={eventFile("event-2")} onEventSaved={noop} />
    );
    await rerender(
      view,
      <EventMenuContent event={eventFile("event-1")} onEventSaved={noop} />
    );

    expect(screen.queryByText(/Loading this event/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Salad" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Soup" })
    ).not.toBeInTheDocument();
    expect(menuGetsFor("event-1")).toBe(1);
  });

  it("puts the rows back when a save is refused", async () => {
    menus.set("event-1", ["Soup", "Salad"]);

    await mount(
      <EventMenuContent event={eventFile("event-1")} onEventSaved={noop} />
    );

    vi.mocked(authenticatedFetch).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Somebody else changed this menu." })
    } as unknown as Response);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove Soup" }));
    });

    expect(
      screen.getByRole("button", { name: "Remove Soup" })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Somebody else changed this menu."
    );
  });
});
