import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
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
 * The board is left up: on a wall, on a pass, through service and past
 * midnight. Its idea of which day it is was worked out once at mount, so at
 * midnight it went on calling yesterday "Today" - and everything derived from
 * that date went with it.
 */

function respondWith() {
  vi.mocked(authenticatedFetch).mockImplementation(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          events: [],
          kitchenEvents: [],
          workers: [],
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
          kitchenSettings: { defaultView: "week" as const }
        })
      }) as unknown as Response
  );
}

/**
 * The day columns labelled Today, ignoring the view tab of the same name.
 * A day heading is text, not a control.
 */
function todayHeadings() {
  return screen
    .getAllByText("Today")
    .filter((element) => element.closest("button") === null);
}

describe("Kitchen board across midnight", () => {
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    })) as unknown as typeof window.matchMedia;
    vi.useFakeTimers();
    window.localStorage.clear();
    cacheTestSessionForStarterRole("owner");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
    cleanup();
  });

  it("moves Today onto the new date when the clock passes midnight", async () => {
    // Ten minutes to midnight on a Tuesday.
    vi.setSystemTime(new Date(2026, 8, 1, 23, 50));
    respondWith();

    await act(async () => {
      render(<KitchenDashboardPage />);
    });

    expect(screen.getByText("Sep 1")).toBeInTheDocument();
    expect(todayHeadings()).toHaveLength(1);
    // The 1st is the day being called Today, and the 2nd is a Wednesday.
    expect(screen.getByText("Wed")).toBeInTheDocument();

    // Twenty minutes on, which is the next day.
    await act(async () => {
      vi.setSystemTime(new Date(2026, 8, 2, 0, 10));
      vi.advanceTimersByTime(60_000);
    });

    // Still exactly one Today, and the 1st has stopped being it - the label
    // moved rather than being duplicated or left behind.
    expect(todayHeadings()).toHaveLength(1);
    expect(screen.getByText("Tue")).toBeInTheDocument();
  });

  it("leaves the date alone while the clock stays on the same day", async () => {
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0));
    respondWith();

    await act(async () => {
      render(<KitchenDashboardPage />);
    });

    const before = todayHeadings().length;

    await act(async () => {
      vi.setSystemTime(new Date(2026, 8, 1, 9, 30));
      vi.advanceTimersByTime(60_000 * 30);
    });

    expect(todayHeadings()).toHaveLength(before);
    expect(screen.getByText("Sep 1")).toBeInTheDocument();
  });
});
