import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
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

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const MENU_ITEM_ID = "22222222-2222-4222-8222-222222222222";
const WORKER_ID = "33333333-3333-4333-8333-333333333333";

function sheet(assignedWorkerId: string | null = null) {
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
        notes: null,
        sortOrder: 0,
        isRetired: false,
        quantityMultiplier: 1,
        quantities: [],
        unresolvedBases: [],
        countState: "NoRule" as const,
        status: null,
        assignedWorkerId,
        assignedWorkerName: assignedWorkerId ? "Mendy" : null
      }
    ],
    summary: {
      dishes: 1,
      addOns: 0,
      complete: 0,
      pending: 0,
      notStarted: 1,
      assigned: assignedWorkerId ? 1 : 0,
      assignedToCurrentWorker: 0,
      needsAttention: 0,
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
        sheet: eventSheet
      }
    ],
    kitchenEvents: [],
    workers: [{ id: WORKER_ID, name: "Mendy", isStaff: true }],
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

function assignmentRequests() {
  return vi
    .mocked(authenticatedFetch)
    .mock.calls.filter(
      ([url, init]) =>
        String(url) === "/api/kitchen" && init?.method === "PATCH"
    );
}

describe("Kitchen worker assignment", () => {
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    })) as unknown as typeof window.matchMedia;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1));
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard/kitchen");
    cacheTestSessionForStarterRole("owner");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
    cleanup();
  });

  it("does not refetch the whole board after assigning a worker", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (url, init) => {
      if (String(url) === "/api/kitchen" && init?.method === "PATCH") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            itemStatus: {
              id: "status-1",
              eventId: EVENT_ID,
              menuItemId: MENU_ITEM_ID,
              status: null,
              assignedWorkerId: WORKER_ID
            }
          })
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
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(boardRequests()).toHaveLength(1);
    expect(assignmentRequests()).toHaveLength(1);
    expect(
      (screen.getByLabelText(/Assign a worker/) as HTMLSelectElement).value
    ).toBe(WORKER_ID);
  });
});
