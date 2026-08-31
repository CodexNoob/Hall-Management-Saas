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
import type { KitchenView } from "@/features/kitchen/components/kitchen-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { cacheTestSessionForStarterRole } from "./auth-session-fixture";

/**
 * Settings > Kitchen > Default view, which reaches the board through
 * /api/kitchen rather than a settings request of its own. These mount the board
 * against a stubbed response and read back which of the three ranges it opened
 * on.
 */

function respondWith(kitchenSettings: { defaultView: KitchenView } | null) {
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
            seesWholeBoard: true
          },
          ...(kitchenSettings ? { kitchenSettings } : {})
        })
      }) as unknown as Response
  );
}

async function mountBoard(
  kitchenSettings: { defaultView: KitchenView } | null
) {
  respondWith(kitchenSettings);
  await act(async () => {
    render(<KitchenDashboardPage />);
  });
}

/** The range tab currently marked as the one being shown. */
function openRange() {
  return screen
    .getAllByRole("button")
    .find((button) => button.getAttribute("aria-current") === "page")
    ?.textContent;
}

describe("Kitchen default view", () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    // Pinned, so "which week the board opens on" is a fact about the board
    // rather than about the day the suite happens to run.
    vi.setSystemTime(new Date(2026, 6, 15));
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard/kitchen");
    cacheTestSessionForStarterRole("event-manager");
    vi.mocked(authenticatedFetch).mockReset();
    clearAuthenticatedQueryCache();
  });

  it("opens on This Week when Settings says week", async () => {
    await mountBoard({ defaultView: "week" });

    expect(openRange()).toBe("This Week");
    // The Sunday-start week around Wednesday 15 July 2026.
    expect(screen.getByText("Jul 12 – Jul 18, 2026")).toBeInTheDocument();
  });

  it("opens on today when Settings says today", async () => {
    await mountBoard({ defaultView: "today" });

    expect(openRange()).toBe("Today");
    expect(screen.getAllByText("Wednesday, July 15, 2026").length).toBe(1);
  });

  it("opens on the four-week grid when Settings says so", async () => {
    await mountBoard({ defaultView: "four-weeks" });

    expect(openRange()).toBe("4 Weeks");
    expect(screen.getByText("Jul 12 – Aug 8, 2026")).toBeInTheDocument();
  });

  it("lets a range tab override the saved default for the rest of the visit", async () => {
    await mountBoard({ defaultView: "week" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "4 Weeks" }));
    });

    expect(openRange()).toBe("4 Weeks");
  });

  it("falls back to today when the response carries no preference", async () => {
    await mountBoard(null);

    expect(openRange()).toBe("Today");
  });
});
