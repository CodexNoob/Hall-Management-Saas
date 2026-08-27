import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
import type {
  EventKitchenLine,
  EventKitchenResponse,
  EventKitchenSheet
} from "@/features/events/components/event-manager-shared";
import { KitchenEventDetailsDialog } from "@/features/kitchen/components/kitchen-event-details-dialog";
import type { KitchenEvent } from "@/features/kitchen/components/kitchen-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { cacheTestSessionForStarterRole } from "./auth-session-fixture";

/**
 * The dish card is the control.
 *
 * A click moves a dish on - not started, then pending, then complete - and a
 * double-click puts it back. That is the interaction the kitchen was specified
 * to have, and the reason it needs a test is the overlap between the two: a
 * double-click delivers two `click` events of its own before its `dblclick`, so
 * the obvious implementation resets the dish *and* advances it twice.
 */

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
  const dishes = lines.filter((entry) => entry.kind === "Dish");

  return {
    meal: "Main",
    menuStatus: "Draft",
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
      dishes: dishes.length,
      addOns: 0,
      complete: dishes.filter((entry) => entry.status === "COMPLETE").length,
      pending: dishes.filter((entry) => entry.status === "PENDING").length,
      notStarted: dishes.filter((entry) => entry.status === null).length,
      assigned: dishes.filter((entry) => entry.assignedWorkerId).length,
      needsAttention: 0,
      unresolvedBases: []
    }
  };
}

const boardEvent: KitchenEvent = {
  id: "11111111-1111-4111-8111-111111111111",
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

async function renderDialog(
  lines: EventKitchenLine[],
  permissions = allPermissions,
  workersOnly = false,
  currentWorkerId: string | null = null
) {
  const onSaveItemAction = vi.fn().mockResolvedValue(undefined);

  vi.mocked(authenticatedFetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ kitchen: sheet(lines) })
  } as unknown as Response);

  render(
    <KitchenEventDetailsDialog
      event={boardEvent}
      isSaving={false}
      onClose={vi.fn()}
      onSaveItemAction={onSaveItemAction}
      permissions={permissions}
      currentWorkerId={currentWorkerId}
      workersOnly={workersOnly}
      workers={[{ id: "worker-1", name: "Mendy", isStaff: false }]}
    />
  );

  await waitFor(() =>
    expect(screen.getByText("Potato kugel")).toBeInTheDocument()
  );

  return onSaveItemAction;
}

/**
 * The card body, which is the status control.
 *
 * Matched on the status half of its label rather than the dish name alone: the
 * Replace button beside it carries the same name, and either would answer to
 * `/Potato kugel/`.
 */
function dishCard() {
  return screen.getByRole("button", { name: /Potato kugel — / });
}

/** The single-click action is held briefly; this is that wait. */
function settleClick() {
  act(() => {
    vi.advanceTimersByTime(400);
  });
}

describe("kitchen dish card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthenticatedQueryCache();
    cacheTestSessionForStarterRole("event-manager");
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides unassigned dishes when workers-only filtering is on", async () => {
    await renderDialog(
      [
        line({
          assignedWorkerId: "worker-1",
          assignedWorkerName: "Mendy"
        }),
        line({
          id: "line-2",
          menuItemId: "item-2",
          name: "Unassigned salad"
        })
      ],
      allPermissions,
      true
    );

    expect(screen.getByText("Potato kugel")).toBeInTheDocument();
    expect(screen.queryByText("Unassigned salad")).toBeNull();
  });

  it("shows only dishes assigned to the current worker when known", async () => {
    await renderDialog(
      [
        line({
          assignedWorkerId: "worker-1",
          assignedWorkerName: "Mendy"
        }),
        line({
          id: "line-2",
          menuItemId: "item-2",
          name: "Someone else's kugel",
          assignedWorkerId: "worker-2",
          assignedWorkerName: "Sarah"
        }),
        line({
          id: "line-3",
          menuItemId: "item-3",
          name: "Unassigned salad"
        })
      ],
      allPermissions,
      true,
      "worker-1"
    );

    expect(screen.getByText("Potato kugel")).toBeInTheDocument();
    expect(screen.queryByText("Someone else's kugel")).toBeNull();
    expect(screen.queryByText("Unassigned salad")).toBeNull();
  });

  it("shows the dish picture when the kitchen sheet includes one", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () =>
        ({
          kitchen: sheet([
            line({ pictureUrl: "https://storage.example/signed/kugel.jpg" })
          ])
        }) as EventKitchenResponse
    } as unknown as Response);

    const { container } = render(
      <KitchenEventDetailsDialog
        event={boardEvent}
        isSaving={false}
        onClose={vi.fn()}
        onSaveItemAction={vi.fn()}
        permissions={allPermissions}
        workers={[]}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("Potato kugel")).toBeInTheDocument()
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://storage.example/signed/kugel.jpg"
    );
  });

  it("moves a dish from not started to pending on a click", async () => {
    const onSaveItemAction = await renderDialog([line()]);

    fireEvent.click(dishCard());
    settleClick();

    expect(onSaveItemAction).toHaveBeenCalledTimes(1);
    expect(onSaveItemAction).toHaveBeenCalledWith({
      action: "status",
      eventId: boardEvent.id,
      menuItemId: "item-1",
      status: "PENDING"
    });
  });

  it("moves a pending dish to complete on a click", async () => {
    const onSaveItemAction = await renderDialog([line({ status: "PENDING" })]);

    fireEvent.click(dishCard());
    settleClick();

    expect(onSaveItemAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "status", status: "COMPLETE" })
    );
  });

  it("stops at complete rather than cycling back round", async () => {
    // Reset is the way back, and it is the double-click. A click that wrapped
    // complete to not started would undo finished work by mis-tap.
    const onSaveItemAction = await renderDialog([line({ status: "COMPLETE" })]);

    fireEvent.click(dishCard());
    settleClick();

    expect(onSaveItemAction).not.toHaveBeenCalled();
  });

  it("resets on a double-click without also advancing", async () => {
    // The regression this guards: a dblclick is preceded by two clicks, so an
    // unguarded handler writes PENDING, then COMPLETE, then the reset - and the
    // dish lands wherever the responses happen to arrive.
    const onSaveItemAction = await renderDialog([line({ status: "PENDING" })]);
    const card = dishCard();

    fireEvent.click(card);
    fireEvent.click(card);
    fireEvent.doubleClick(card);
    settleClick();

    expect(onSaveItemAction).toHaveBeenCalledTimes(1);
    expect(onSaveItemAction).toHaveBeenCalledWith({
      action: "reset-status",
      eventId: boardEvent.id,
      menuItemId: "item-1"
    });
  });

  it("ignores a double-click on a dish that has not been started", async () => {
    const onSaveItemAction = await renderDialog([line()]);
    const card = dishCard();

    fireEvent.click(card);
    fireEvent.doubleClick(card);
    settleClick();

    expect(onSaveItemAction).not.toHaveBeenCalled();
  });

  it("offers reset from the keyboard, which has no double-click", async () => {
    const onSaveItemAction = await renderDialog([line({ status: "COMPLETE" })]);

    fireEvent.keyDown(dishCard(), {
      key: "Delete"
    });

    expect(onSaveItemAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "reset-status" })
    );
  });

  it("assigns a worker without also ticking the dish", async () => {
    // The select sits beneath the card body rather than inside it, so choosing
    // a name is not also a click on the status control.
    const onSaveItemAction = await renderDialog([line()]);

    fireEvent.change(screen.getByLabelText(/Assign a worker/), {
      target: { value: "worker-1" }
    });
    settleClick();

    expect(onSaveItemAction).toHaveBeenCalledTimes(1);
    expect(onSaveItemAction).toHaveBeenCalledWith({
      action: "assign-worker",
      eventId: boardEvent.id,
      menuItemId: "item-1",
      assignedWorkerId: "worker-1"
    });
  });

  it("is not clickable without permission to update status", async () => {
    await renderDialog([line()], {
      ...allPermissions,
      canUpdateKitchenStatus: false
    });

    expect(
      screen.queryByRole("button", { name: /Potato kugel/ })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Potato kugel")).toBeInTheDocument();
  });
});
