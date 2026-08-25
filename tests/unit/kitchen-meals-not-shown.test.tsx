import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
import type { EventKitchenSheet } from "@/features/events/components/event-manager-shared";
import { KitchenEventCard } from "@/features/kitchen/components/kitchen-event-card";
import { KitchenEventDetailsDialog } from "@/features/kitchen/components/kitchen-event-details-dialog";
import {
  formatMealsNotShown,
  formatOtherMeals,
  mealLabel,
  type KitchenEvent
} from "@/features/kitchen/components/kitchen-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { cacheTestSessionForStarterRole } from "./auth-session-fixture";

/**
 * The board draws one meal, and `EventMenu` holds four.
 *
 * Nothing writes a non-`Main` menu today, which is exactly why this needs a
 * test: the failure is silent. An event serving three meals reports its Main
 * menu as the whole job - a full progress bar over a quarter of the cooking,
 * with no error and no empty state - and every surface agrees with it, because
 * they all read the same wrong meal.
 *
 * These tests hold the marker in place until the board can draw the other
 * meals properly.
 */

const summary: EventKitchenSheet["summary"] = {
  dishes: 2,
  addOns: 0,
  complete: 2,
  pending: 0,
  notStarted: 0,
  needsAttention: 0,
  unresolvedBases: []
};

function boardEvent(overrides: Partial<KitchenEvent> = {}): KitchenEvent {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    category: "Main Hall",
    title: "Gold Wedding",
    status: "Confirmed",
    startsAt: "2026-08-20T18:00:00.000Z",
    totalGuests: 187,
    menuStatus: "Confirmed",
    otherMeals: [],
    summary,
    ...overrides
  };
}

function sheet(otherMeals: string[]): EventKitchenSheet {
  return {
    meal: "Main",
    menuStatus: "Confirmed",
    otherMeals,
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
    lines: [],
    summary
  };
}

describe("the meals a kitchen surface is not showing", () => {
  describe("saying it", () => {
    it("names the meals in the order they are eaten", () => {
      // Whatever order the rows come back in. A sentence that reorders itself
      // between requests reads as something having changed.
      expect(formatOtherMeals(["ShabbosDay", "FridayNight"])).toBe(
        "Friday Night and Shabbos Day"
      );
    });

    it("puts commas between three and an 'and' before the last", () => {
      expect(
        formatOtherMeals(["SeudahShlishis", "FridayNight", "ShabbosDay"])
      ).toBe("Friday Night, Shabbos Day and Seudah Shlishis");
    });

    it("hands back a meal it does not recognise rather than nothing", () => {
      // `EventMenu.meal` is a plain string column with no enum and no CHECK
      // behind it, so a value this map has never seen has to render as itself.
      expect(mealLabel("Brunch")).toBe("Brunch");
      expect(formatOtherMeals(["Brunch"])).toBe("Brunch");
    });

    it("counts them for the card, which has no room for names", () => {
      expect(formatMealsNotShown(["FridayNight"])).toBe("+1 meal not shown");
      expect(formatMealsNotShown(["FridayNight", "ShabbosDay"])).toBe(
        "+2 meals not shown"
      );
    });

    it("says nothing at all when there is nothing missing", () => {
      expect(formatMealsNotShown([])).toBeNull();
      expect(formatOtherMeals([])).toBe("");
    });
  });

  describe("the board card", () => {
    it("marks an event whose other meals it cannot draw", () => {
      render(
        <KitchenEventCard
          event={boardEvent({ otherMeals: ["FridayNight", "ShabbosDay"] })}
          onSelect={vi.fn()}
        />
      );

      // Beside a bar reading 100%, which is the whole problem: without this the
      // card is complete and wrong at the same time.
      expect(screen.getByText("2/2 done")).toBeInTheDocument();
      expect(screen.getByText("+2 meals not shown")).toBeInTheDocument();
    });

    it("stays quiet on an event serving only Main", () => {
      render(<KitchenEventCard event={boardEvent()} onSelect={vi.fn()} />);

      expect(screen.queryByText(/not shown/)).not.toBeInTheDocument();
    });

    it("carries it into the compact card's tooltip", () => {
      // The four-week grid gives a card a seventh of a screen and already
      // truncates, so the marker goes where there is room for it.
      render(
        <KitchenEventCard
          compact
          event={boardEvent({ otherMeals: ["FridayNight"] })}
          onSelect={vi.fn()}
        />
      );

      expect(screen.getByRole("button")).toHaveAttribute(
        "title",
        expect.stringContaining("+1 meal not shown")
      );
    });
  });

  describe("the details dialog", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      clearAuthenticatedQueryCache();
      cacheTestSessionForStarterRole("event-manager");
    });

    it("names them, and says which meal this sheet is", async () => {
      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ kitchen: sheet(["FridayNight", "ShabbosDay"]) })
      } as unknown as Response);

      render(
        <KitchenEventDetailsDialog
          event={boardEvent({ otherMeals: ["FridayNight", "ShabbosDay"] })}
          isSaving={false}
          onClose={vi.fn()}
          onSaveItemAction={vi.fn().mockResolvedValue(undefined)}
          permissions={{
            canAssignWorkers: true,
            canUpdateKitchenStatus: true,
            canAddKitchenEvents: true
          }}
          workers={[]}
        />
      );

      await waitFor(() =>
        expect(
          screen.getByText(
            /Friday Night and Shabbos Day are not shown here\. This sheet is the Main meal only\./
          )
        ).toBeInTheDocument()
      );
    });

    it("says it before its own request lands", async () => {
      // Read off the board's payload first, the same way the stat tiles are.
      // Waiting for the sheet would leave the dialog looking complete for as
      // long as its request was in flight.
      vi.mocked(authenticatedFetch).mockReturnValue(
        new Promise(() => {}) as unknown as Promise<Response>
      );

      render(
        <KitchenEventDetailsDialog
          event={boardEvent({ otherMeals: ["FridayNight"] })}
          isSaving={false}
          onClose={vi.fn()}
          onSaveItemAction={vi.fn().mockResolvedValue(undefined)}
          permissions={{
            canAssignWorkers: true,
            canUpdateKitchenStatus: true,
            canAddKitchenEvents: true
          }}
          workers={[]}
        />
      );

      expect(
        screen.getByText(/Friday Night is not shown here\./)
      ).toBeInTheDocument();
    });
  });
});
