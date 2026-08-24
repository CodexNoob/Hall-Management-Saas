import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard/events"
}));

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
import { EventManagerPage } from "@/features/events/components/event-manager-page";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import type { EventsResponse } from "@/features/events/components/event-manager-shared";
import { cacheTestSession } from "./auth-session-fixture";

/**
 * Which event the Event Manager opens on arrival, and what it shows when that is
 * none of them.
 *
 * The page used to fall back to `allEvents[0]`, so it always had an event open.
 * That read as a selection the user had not made, and because the list filters to
 * Active by default while the API orders by start time ascending, the event it
 * picked was usually finished or expired and so was not even rendered in the list
 * to be highlighted: data on the right, nothing selected on the left.
 */

// Typed against the real response so a field added to the route fails here
// rather than leaving the fixture quietly out of step with it.
function eventRow(
  id: string,
  overrides: Partial<EventsResponse["events"][number]> = {}
): EventsResponse["events"][number] {
  return {
    id,
    clientName: `Client ${id}`,
    eventDate: "2026-08-22T00:00:00.000Z",
    eventType: "Wedding",
    eventTypeId: "event-type-1",
    eventStatus: "Confirmed",
    bookingStatus: "CONFIRMED",
    startsAt: "2026-08-22T18:00:00.000Z",
    endsAt: null,
    setupStartsAt: null,
    cleanupEndsAt: null,
    holdExpiresAt: null,
    cancelledAt: null,
    completedAt: null,
    version: 1,
    paymentStatus: null,
    packageName: "Standard",
    couplesCount: 0,
    menCount: 10,
    ladiesCount: 0,
    boysCount: 0,
    girlsCount: 0,
    kidsCount: 0,
    waitersCount: 2,
    setupTime: null,
    washingTime: null,
    tableclothName: null,
    notes: null,
    daveningNote: null,
    memberShulName: null,
    sideBoxes: null,
    shabbosSetup: null,
    diningManagerNotes: null,
    activityLogs: [],
    diningHallMapPreset: null,
    phone: "Not provided",
    email: null,
    workspaceData: null,
    menuItemIds: [],
    hall: { id: "hall-1", name: "Hall 1" },
    ...overrides
  };
}

function eventsResponse(events: EventsResponse["events"]): EventsResponse {
  return {
    events,
    halls: [{ id: "hall-1", name: "Hall 1" }],
    eventTypes: []
  };
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as unknown as Response;
}

function respondWith(payload: EventsResponse) {
  vi.mocked(authenticatedFetch).mockImplementation(async () =>
    jsonResponse(payload)
  );
}

async function mount() {
  await act(async () => {
    render(<EventManagerPage />);
  });
}

function workspace() {
  return screen.queryByRole("navigation", { name: "Event workspace" });
}

// jsdom ships no matchMedia, and the sidebar only has a collapsed width above
// lg, so the viewport has to be stated for the request to be made at all.
function setViewport(width: number) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("min-width: 1024px")
      ? width >= 1024
      : width <= 1023,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {}
  })) as unknown as typeof window.matchMedia;
}

// The sidebar itself is not mounted here, so its event is what there is to
// watch: it is the one thing this page says, and everything else - the dataset
// flag, localStorage, the topbar - follows from the sidebar answering it.
function collapseRequests() {
  const requests: boolean[] = [];
  window.addEventListener("dashboard-sidebar-toggle", (event) => {
    requests.push(
      Boolean((event as CustomEvent<{ collapsed?: boolean }>).detail?.collapsed)
    );
  });
  return requests;
}

describe("Event Manager selection", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard/events");
    cacheTestSession("manager");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
    Reflect.deleteProperty(window, "matchMedia");
  });

  it("opens nothing on arrival, and says so", async () => {
    respondWith(eventsResponse([eventRow("event-1"), eventRow("event-2")]));

    await mount();

    expect(
      screen.getByRole("heading", { name: "No event selected" })
    ).toBeInTheDocument();
    expect(workspace()).not.toBeInTheDocument();
  });

  it("opens the event that is clicked, and only then", async () => {
    respondWith(eventsResponse([eventRow("event-1"), eventRow("event-2")]));

    await mount();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Client event-2 Wedding/ })
      );
    });

    expect(workspace()).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Client event-2 Wedding" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "No event selected" })
    ).not.toBeInTheDocument();
  });

  // The case that produced the report: the first event by start time is finished,
  // so the list's default Active filter drops its row. Opening it anyway left an
  // event on screen that the list denied existed.
  it("does not open an event the list has filtered out of view", async () => {
    respondWith(
      eventsResponse([
        eventRow("finished", { bookingStatus: "COMPLETED" }),
        eventRow("upcoming")
      ])
    );

    await mount();

    expect(
      screen.getByRole("heading", { name: "No event selected" })
    ).toBeInTheDocument();
    // Confirms the row really is filtered out, so the assertion above is about
    // the selection and not about an empty list.
    expect(
      screen.queryByRole("button", { name: /Client finished Wedding/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Client upcoming Wedding/ })
    ).toBeInTheDocument();
  });

  // A link that names an event is a selection the user did make.
  it("still opens an event named by a deep link", async () => {
    window.history.replaceState({}, "", "/dashboard/events?eventId=event-2");
    respondWith(eventsResponse([eventRow("event-1"), eventRow("event-2")]));

    await mount();

    expect(workspace()).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Client event-2 Wedding" })
    ).toBeInTheDocument();
  });

  // Opening an event hands the widest pane on the page the sidebar's width.
  it("asks the sidebar to collapse when an event is opened", async () => {
    setViewport(1440);
    respondWith(eventsResponse([eventRow("event-1")]));
    const requests = collapseRequests();

    await mount();

    expect(requests).toEqual([]);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Client event-1 Wedding/ })
      );
    });

    expect(requests).toEqual([true]);
  });

  // Below lg the sidebar has no collapsed width to give, so asking would only
  // save a preference the user never expressed.
  it("leaves the sidebar alone on a narrow viewport", async () => {
    setViewport(768);
    respondWith(eventsResponse([eventRow("event-1")]));
    const requests = collapseRequests();

    await mount();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Client event-1 Wedding/ })
      );
    });

    expect(workspace()).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it("does not collapse the sidebar for a deep link", async () => {
    setViewport(1440);
    window.history.replaceState({}, "", "/dashboard/events?eventId=event-1");
    respondWith(eventsResponse([eventRow("event-1")]));
    const requests = collapseRequests();

    await mount();

    expect(workspace()).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it("goes back to the empty pane when the filters are cleared", async () => {
    respondWith(eventsResponse([eventRow("event-1")]));

    await mount();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Client event-1 Wedding/ })
      );
    });

    expect(workspace()).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    });

    expect(workspace()).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No event selected" })
    ).toBeInTheDocument();
  });
});
