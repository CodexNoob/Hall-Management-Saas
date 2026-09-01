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

/**
 * Cancelling a booking from the kitchen board's details dialog.
 *
 * The button reads "Delete Event" because that is what the design asks for, but
 * the write is a cancellation: the booking leaves this board and the calendar
 * and keeps every record attached to it. These cover the three things that make
 * that safe - the permission that gates the button, the version that guards the
 * write, and the confirmation that stands between the two.
 */

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const STANDALONE_ID = "22222222-2222-4222-8222-222222222222";

function boardPayload({ canCancelEvents = true }: { canCancelEvents?: boolean }) {
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
        counts: { totalGuests: 250, waiters: 0 },
        menuStatus: "Menu confirmed",
        otherMeals: [],
        summary: {
          dishes: 1,
          addOns: 0,
          complete: 0,
          pending: 0,
          notStarted: 1,
          assigned: 0,
          assignedToCurrentWorker: 0,
          needsAttention: 0,
          unresolvedBases: []
        },
        sheet: null
      }
    ],
    kitchenEvents: [
      {
        id: STANDALONE_ID,
        dateKey: "2026-09-03",
        source: "standalone" as const,
        category: "Kitchen-only",
        title: "Birthday",
        startsAt: null,
        totalGuests: 80,
        menuStatus: "Kitchen menu",
        otherMeals: [],
        summary: null
      }
    ],
    workers: [],
    currentWorkerId: null,
    notifications: [],
    menus: [],
    menuItems: [],
    permissions: {
      canAssignWorkers: true,
      canUpdateKitchenStatus: true,
      canAddKitchenEvents: true,
      canCancelEvents,
      seesWholeBoard: true
    },
    kitchenSettings: { defaultView: "four-weeks" as const }
  };
}

/** Every request answers the board, except the cancel, which is asserted on. */
function respondWith(payload: ReturnType<typeof boardPayload>) {
  vi.mocked(authenticatedFetch).mockImplementation(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => payload
      }) as unknown as Response
  );
}

async function openDialog(
  options: { canCancelEvents?: boolean; card?: string } = {}
) {
  respondWith(boardPayload(options));

  await act(async () => {
    render(<KitchenDashboardPage />);
  });

  await act(async () => {
    fireEvent.click(screen.getByText(options.card ?? "Feferkorn Wedding"));
  });
}

/** The PATCH the cancel sends, if it sent one. */
function cancelRequest() {
  return vi
    .mocked(authenticatedFetch)
    .mock.calls.find(([url]) => String(url).endsWith("/status"));
}

/** The DELETE a standalone job's removal sends, if it sent one. */
function deleteRequest() {
  return vi
    .mocked(authenticatedFetch)
    .mock.calls.find(([, init]) => init?.method === "DELETE");
}

describe("Cancelling an event from the kitchen board", () => {
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
    cacheTestSessionForStarterRole("owner");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
    cleanup();
  });

  it("does not offer the button without permission to end a booking", async () => {
    await openDialog({ canCancelEvents: false });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Event" })).toBeNull();
  });

  it("asks before it writes anything", async () => {
    await openDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete Event" }));
    });

    // The confirmation says what actually happens, because the button says
    // "Delete" - the records survive, and the cancellation does not come back.
    expect(screen.getByText(/everything it holds stays/)).toBeInTheDocument();
    expect(cancelRequest()).toBeUndefined();
  });

  it("cancels against the version the board read", async () => {
    await openDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete Event" }));
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Cancel this event" })
      );
    });

    const request = cancelRequest();
    expect(request).toBeDefined();
    expect(String(request?.[0])).toBe(`/api/events/${EVENT_ID}/status`);
    expect(request?.[1]?.method).toBe("PATCH");
    // `expectedVersion` is what stops two people cancelling past each other.
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      status: "CANCELLED",
      expectedVersion: 7
    });
  });

  /**
   * A standalone kitchen job is not a booking: no client, no invoice, no place
   * on the calendar. Removing one is a real delete, and the wording says so
   * rather than borrowing the booking's careful "everything stays" language.
   */
  describe("a standalone kitchen job", () => {
    it("is deleted outright, and says so before it does it", async () => {
      await openDialog({ card: "Birthday" });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Delete Event" }));
      });

      expect(screen.getByText(/removes it outright/)).toBeInTheDocument();
      expect(deleteRequest()).toBeUndefined();

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Delete this kitchen event" })
        );
      });

      expect(String(deleteRequest()?.[0])).toBe(
        `/api/kitchen?kitchenEventId=${STANDALONE_ID}`
      );
    });

    it("is still offered when the caller cannot cancel bookings", async () => {
      // Deleting a kitchen job only takes work off this board, so it follows
      // the permission that adds one rather than the booking lifecycle's.
      await openDialog({ card: "Birthday", canCancelEvents: false });

      expect(
        screen.getByRole("button", { name: "Delete Event" })
      ).toBeInTheDocument();
    });
  });
});
