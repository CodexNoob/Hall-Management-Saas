import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard/kitchen"
}));

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
import { KitchenDashboardPage } from "@/features/kitchen/components/kitchen-dashboard-page";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { cacheTestSessionForStarterRole } from "./auth-session-fixture";

/**
 * The board as a screen mounted on a kitchen wall, rather than a page somebody
 * visits.
 *
 * It is left running for a whole service and nobody reloads it. Until it read
 * itself back on a timer it only ever changed when somebody standing at THAT
 * screen wrote something - so a cook ticking a dish on the tablet by the ovens
 * never reached the wall, and a board that had quietly stopped moving looked
 * exactly like a board where nothing was happening.
 */

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const MENU_ITEM_ID = "22222222-2222-4222-8222-222222222222";
const WORKER_ID = "33333333-3333-4333-8333-333333333333";

function sheet() {
  return {
    meal: "Dinner",
    menuStatus: "Confirmed" as const,
    otherMeals: [],
    confirmedAt: null,
    version: 1,
    counts: {
      totalGuests: 250,
      couples: 0,
      men: 125,
      ladies: 125,
      boys: 0,
      girls: 0,
      kids: 0,
      waiters: 0,
      tables: null
    },
    lines: [
      {
        id: "line-1",
        menuItemId: MENU_ITEM_ID,
        addOnId: null,
        kind: "Dish" as const,
        itemKind: "Food",
        name: "Potato kugel",
        pictureUrl: null,
        serviceStyle: "Buffet",
        availableStyles: ["Buffet"],
        notes: "No onions",
        allergens: ["Eggs"],
        sortOrder: 0,
        isRetired: false,
        quantityMultiplier: 1,
        quantities: [],
        unresolvedBases: [],
        countState: "NoRule" as const,
        status: null,
        assignedWorkerId: null,
        assignedWorkerName: null
      }
    ],
    summary: {
      dishes: 1,
      addOns: 0,
      complete: 0,
      pending: 0,
      notStarted: 1,
      assigned: 0,
      assignedToCurrentWorker: 0,
      needsAttention: 1,
      unresolvedBases: []
    }
  };
}

function boardPayload() {
  const eventSheet = sheet();

  return {
    events: [
      {
        id: EVENT_ID,
        clientName: "Feferkorn",
        eventType: "Wedding",
        eventDate: "2026-09-03T00:00:00.000Z",
        eventStatus: "Confirmed",
        startsAt: "2026-09-03T18:00:00.000Z",
        packageName: null,
        version: 7,
        hall: { name: "Ateres Akiva" },
        counts: eventSheet.counts,
        menuStatus: eventSheet.menuStatus,
        otherMeals: [],
        summary: eventSheet.summary,
        timeline: [
          { id: "t1", time: "7:00 PM", text: "Reception", type: "Event" },
          { id: "t2", time: "8:15 PM", text: "Main Course", type: "Event" },
          { id: "t3", cue: "After speeches", text: "Dessert", type: "Kitchen" }
        ],
        sheet: eventSheet
      }
    ],
    kitchenEvents: [],
    workers: [{ id: WORKER_ID, name: "Sarah", isStaff: true }],
    currentWorkerId: null,
    notifications: [],
    menus: [],
    menuItems: [],
    permissions: {
      canAssignWorkers: true,
      canUpdateKitchenStatus: true,
      canAddKitchenEvents: true,
      canCancelEvents: true,
      seesWholeBoard: true
    },
    kitchenSettings: { defaultView: "four-weeks" as const }
  };
}

function boardRequests() {
  return vi
    .mocked(authenticatedFetch)
    .mock.calls.filter(([url]) =>
      String(url).startsWith("/api/kitchen?start=")
    );
}

/** Pretends the tab is in front, or behind, and tells the page it changed. */
function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("the kitchen board as a mounted screen", () => {
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    })) as unknown as typeof window.matchMedia;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1, 14, 30, 15));
    setVisibility("visible");
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard/kitchen");
    cacheTestSessionForStarterRole("owner");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
    cleanup();
  });

  async function openBoard() {
    vi.mocked(authenticatedFetch).mockImplementation(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => boardPayload()
        }) as unknown as Response
    );

    await act(async () => {
      render(<KitchenDashboardPage />);
    });
  }

  it("re-reads the board on its own, with nobody touching the screen", async () => {
    await openBoard();

    expect(boardRequests()).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(boardRequests()).toHaveLength(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(boardRequests()).toHaveLength(3);
  });

  it("does not poll while the screen is behind something", async () => {
    await openBoard();
    expect(boardRequests()).toHaveLength(1);

    await act(async () => {
      setVisibility("hidden");
      await vi.advanceTimersByTimeAsync(90_000);
    });

    // A tablet asleep in a pocket is not a board anyone is reading.
    expect(boardRequests()).toHaveLength(1);
  });

  it("catches up the moment the screen comes back to the front", async () => {
    await openBoard();

    await act(async () => {
      setVisibility("hidden");
      await vi.advanceTimersByTimeAsync(90_000);
    });

    expect(boardRequests()).toHaveLength(1);

    await act(async () => {
      setVisibility("visible");
    });

    expect(boardRequests()).toHaveLength(2);
  });

  it("says when it last heard from the server, and refreshes on demand", async () => {
    await openBoard();

    expect(screen.getByText(/^Updated \d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Refresh the kitchen board" })
      );
    });

    expect(boardRequests()).toHaveLength(2);
  });

  it("shows the event's timeline inside the details view", async () => {
    await openBoard();

    await act(async () => {
      fireEvent.click(screen.getByText("Feferkorn Wedding"));
    });

    expect(screen.getByText("Reception")).toBeInTheDocument();
    expect(screen.getByText("7:00 PM")).toBeInTheDocument();
    expect(screen.getByText("Main Course")).toBeInTheDocument();
    // A cue row is placed by what happens before it, so the time column carries
    // the cue rather than a midnight nobody meant.
    expect(screen.getByText("After speeches")).toBeInTheDocument();
  });

  it("puts the allergens on the dish, beside the menu line's own note", async () => {
    await openBoard();

    await act(async () => {
      fireEvent.click(screen.getByText("Feferkorn Wedding"));
    });

    expect(screen.getAllByText("Contains Eggs").length).toBeGreaterThan(0);
    // The kitchen instruction comes from `EventMenuLine.notes`, set on the
    // event's Menu tab. The kitchen has no note field of its own.
    expect(screen.getAllByText("No onions").length).toBeGreaterThan(0);
  });

  /**
   * The board updates optimistically, so a click that worked usually LOOKS
   * like it worked - which is exactly why a click that silently did not is so
   * hard to notice. These say the server agreed.
   */
  it("says so on screen when a worker is assigned", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (url, init) => {
      if (String(url) === "/api/kitchen" && init?.method === "PATCH") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ itemStatus: { assignedWorkerId: WORKER_ID } })
        } as unknown as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => boardPayload()
      } as unknown as Response;
    });

    await act(async () => {
      render(<KitchenDashboardPage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Feferkorn Wedding"));
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Assign a worker/), {
        target: { value: WORKER_ID }
      });
      await Promise.resolve();
    });

    // By text, not by role: the freshness label beside the refresh button is
    // also a status region, and there is deliberately more than one.
    const message = screen.getByText("Assigned to Sarah.");
    expect(message).toBeInTheDocument();

    // And it is INSIDE the sheet, beside the dish that changed. It used to be
    // raised at page level, above the day columns, with nothing connecting it
    // to the card somebody had just touched.
    const dishCard = screen.getByRole("button", { name: /^Potato kugel/ });
    const sheet = dishCard.closest(".bg-\\[\\#dceaff\\]");
    expect(sheet).not.toBeNull();
    expect(sheet).toContainElement(message);
  });

  it("clears the confirmation rather than leaving it up all service", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (url, init) => {
      if (String(url) === "/api/kitchen" && init?.method === "PATCH") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ itemStatus: null })
        } as unknown as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => boardPayload()
      } as unknown as Response;
    });

    await act(async () => {
      render(<KitchenDashboardPage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Feferkorn Wedding"));
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Assign a worker/), {
        target: { value: WORKER_ID }
      });
      await Promise.resolve();
    });

    expect(screen.queryByText("Assigned to Sarah.")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(screen.queryByText("Assigned to Sarah.")).toBeNull();
  });

  it("labels a dish in the kitchen's own words", async () => {
    await openBoard();

    await act(async () => {
      fireEvent.click(screen.getByText("Feferkorn Wedding"));
    });

    const card = screen.getByRole("button", { name: /^Potato kugel/ });

    await act(async () => {
      fireEvent.click(card);
      await vi.advanceTimersByTimeAsync(400);
    });

    // "Pending / In prep" is one state - picked up and not yet out - which is
    // the vocabulary the workflow tiles have always used.
    expect(
      screen.getByRole("button", { name: /Pending \/ In prep/ })
    ).toBeInTheDocument();
  });
});
