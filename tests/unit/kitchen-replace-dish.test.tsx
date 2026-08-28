import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
import type {
  EventKitchenLine,
  EventKitchenSheet
} from "@/features/events/components/event-manager-shared";
import { KitchenEventDetailsDialog } from "@/features/kitchen/components/kitchen-event-details-dialog";
import type { KitchenEvent } from "@/features/kitchen/components/kitchen-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { cacheTestSessionForStarterRole } from "./auth-session-fixture";

/**
 * Swapping a dish from the board.
 *
 * The kitchen carried a replace control once before and it was taken out,
 * because it wrote the legacy `Event.menuItemIds` mirror and never reached the
 * lines anybody cooks from. These tests are about the two things that made the
 * second attempt worth having: the swap names both ends before it happens, and
 * a dish already on this menu is not offered - `(menu, dish)` is unique, so
 * picking one would be a refusal rather than a swap.
 */

const eventId = "11111111-1111-4111-8111-111111111111";

function line(overrides: Partial<EventKitchenLine> = {}): EventKitchenLine {
  return {
    id: "line-1",
    menuItemId: "item-1",
    addOnId: null,
    kind: "Dish",
    name: "Potato kugel",
    pictureUrl: null,
    serviceStyle: "Buffet",
    availableStyles: ["Buffet"],
    notes: null,
    sortOrder: 0,
    isRetired: false,
    quantityMultiplier: 1,
    quantities: [{ unit: "tray", units: 7, perServingUnits: 7, raw: 7 }],
    unresolvedBases: [],
    countState: "Counted",
    status: null,
    assignedWorkerId: null,
    assignedWorkerName: null,
    ...overrides
  };
}

function sheet(
  lines: EventKitchenLine[],
  menuStatus: EventKitchenSheet["menuStatus"] = "Draft"
): EventKitchenSheet {
  return {
    meal: "Main",
    menuStatus,
    otherMeals: [],
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
      dishes: lines.length,
      addOns: 0,
      complete: 0,
      pending: 0,
      notStarted: lines.length,
      needsAttention: 0,
      unresolvedBases: []
    }
  };
}

const library = {
  items: [
    {
      id: "item-1",
      name: "Potato kugel",
      isActive: true,
      services: [{ serviceStyle: "Buffet" }],
      pictureUrl: "https://example.test/kugel.jpg"
    },
    {
      id: "item-2",
      name: "Roast chicken",
      isActive: true,
      services: [{ serviceStyle: "Buffet" }],
      pictureUrl: "https://example.test/chicken.jpg"
    },
    {
      id: "item-3",
      name: "Poached salmon",
      isActive: true,
      services: [{ serviceStyle: "Plated" }],
      pictureUrl: null
    },
    {
      id: "item-4",
      name: "Discontinued trifle",
      isActive: false,
      services: [{ serviceStyle: "Buffet" }],
      pictureUrl: null
    }
  ],
  addOns: [],
  packages: [],
  categories: []
};

const boardEvent: KitchenEvent = {
  id: eventId,
  category: "Main Hall",
  title: "Gold Wedding",
  status: "Confirmed",
  startsAt: "2026-08-20T18:00:00.000Z",
  totalGuests: 187,
  menuStatus: "Draft",
  otherMeals: [],
  summary: sheet([line()]).summary
};

const allPermissions = {
  canAssignWorkers: true,
  canUpdateKitchenStatus: true,
  canAddKitchenEvents: true,
  seesWholeBoard: true
};

/**
 * The drawer, scoped.
 *
 * The board's dialog is still mounted underneath with a card per dish, so an
 * unscoped search for a dish name can find the card rather than the option.
 */
function drawer() {
  return within(screen.getByRole("dialog", { name: "Replace a dish" }));
}

/** Answers each url with its own payload; the drawer reads a second one. */
function serve(kitchen: EventKitchenSheet) {
  vi.mocked(authenticatedFetch).mockImplementation(((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => (url === "/api/menu" ? library : { kitchen })
    } as unknown as Response)) as unknown as typeof authenticatedFetch);
}

async function openDrawer(
  lines: EventKitchenLine[],
  {
    menuStatus = "Draft" as EventKitchenSheet["menuStatus"],
    onSaveItemAction = vi.fn().mockResolvedValue(undefined),
    permissions = allPermissions
  } = {}
) {
  serve(sheet(lines, menuStatus));

  render(
    <KitchenEventDetailsDialog
      event={boardEvent}
      isSaving={false}
      onClose={vi.fn()}
      onSaveItemAction={onSaveItemAction}
      permissions={permissions}
      workers={[]}
    />
  );

  await waitFor(() =>
    expect(screen.getByLabelText("Replace Potato kugel")).toBeInTheDocument()
  );

  fireEvent.click(screen.getByLabelText("Replace Potato kugel"));

  // A dish no test puts on the sheet, so this waits for the library to land
  // rather than for a name the dialog underneath might also be showing.
  await waitFor(() =>
    expect(drawer().getByText("Poached salmon")).toBeInTheDocument()
  );

  return onSaveItemAction;
}

describe("replacing a dish from the kitchen board", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthenticatedQueryCache();
    cacheTestSessionForStarterRole("event-manager");
  });

  it("offers the library with its pictures, and says what each swap would be", async () => {
    await openDrawer([line()]);

    // A cook picks food by looking at it, so the picture is the point of the
    // list rather than a decoration on it.
    expect(
      drawer().getByRole("button", { name: /Roast chicken/ })
    ).toBeInTheDocument();
    expect(
      document.querySelector('img[src="https://example.test/chicken.jpg"]')
    ).not.toBeNull();
    // Buffet is what the line already is, and the replacement has a rule for
    // it, so the swap does not quietly change how the food reaches the table.
    expect(drawer().getByText("Will be served buffet")).toBeInTheDocument();
    // Plated only: there is no buffet rule to inherit, and one style needs no
    // decision, so this lands plated.
    expect(drawer().getByText("Will be served plated")).toBeInTheDocument();
  });

  it("does not offer a retired dish, or the dish being replaced", async () => {
    await openDrawer([line()]);

    expect(screen.queryByText("Discontinued trifle")).not.toBeInTheDocument();
    // Named once, on the card it was opened from - not again as something to
    // swap itself for.
    expect(screen.getAllByText("Potato kugel")).toHaveLength(2);
  });

  it("names both ends of the swap before it writes anything", async () => {
    const onSaveItemAction = await openDrawer([line()]);

    fireEvent.click(drawer().getByRole("button", { name: /Roast chicken/ }));

    expect(
      drawer().getByRole("button", { name: "Replace dish" })
    ).toBeEnabled();
    expect(onSaveItemAction).not.toHaveBeenCalled();

    fireEvent.click(drawer().getByRole("button", { name: "Replace dish" }));

    await waitFor(() =>
      expect(onSaveItemAction).toHaveBeenCalledWith({
        action: "replace-menu-item",
        eventId,
        menuItemId: "item-1",
        replacementMenuItemId: "item-2"
      })
    );
  });

  it("will not offer a dish that is already on this menu", async () => {
    // `(menu, dish)` is unique, so the second line for it cannot be stored.
    await openDrawer([
      line(),
      line({ id: "line-2", menuItemId: "item-2", name: "Roast chicken" })
    ]);

    expect(
      drawer().getByRole("button", { name: /Roast chicken/ })
    ).toBeDisabled();
    expect(drawer().getByText("Already on this menu")).toBeInTheDocument();
  });

  it("keeps the drawer open on a refusal and prints the reason", async () => {
    // Each refusal has a different next move - reload, pick another dish - so
    // closing over the top of it would take the answer away with it.
    const onSaveItemAction = vi
      .fn()
      .mockRejectedValue(new Error("Roast chicken is already on this menu."));

    await openDrawer([line()], { onSaveItemAction });

    fireEvent.click(drawer().getByRole("button", { name: /Roast chicken/ }));
    fireEvent.click(drawer().getByRole("button", { name: "Replace dish" }));

    await waitFor(() =>
      expect(drawer().getByRole("alert")).toHaveTextContent(
        "Roast chicken is already on this menu."
      )
    );
    expect(
      drawer().getByRole("button", { name: "Replace dish" })
    ).toBeInTheDocument();
  });

  it("warns when the menu has already been shown to the client", async () => {
    await openDrawer([line()], { menuStatus: "Confirmed" });

    expect(drawer().getByRole("status")).toHaveTextContent(
      /changes what they were promised/
    );
  });

  it("does not offer the swap without permission to update kitchen status", async () => {
    serve(sheet([line()]));

    render(
      <KitchenEventDetailsDialog
        event={boardEvent}
        isSaving={false}
        onClose={vi.fn()}
        onSaveItemAction={vi.fn()}
        permissions={{ ...allPermissions, canUpdateKitchenStatus: false }}
        workers={[]}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("Potato kugel")).toBeInTheDocument()
    );
    expect(
      screen.queryByLabelText("Replace Potato kugel")
    ).not.toBeInTheDocument();
  });
});
