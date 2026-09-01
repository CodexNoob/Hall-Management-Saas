import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import {
  clearAuthenticatedQueryCache,
  invalidateAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { EventMenuContent } from "@/features/events/components/event-menu-content";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import type {
  EventFile,
  EventMenuDocument
} from "@/features/events/components/event-manager-shared";
import { cacheTestSessionForStarterRole } from "./auth-session-fixture";

/**
 * Editing the menu faster than the server can answer.
 *
 * Removing a dish is one click on a grid of them, so two of them land inside
 * one round trip all the time. The menu PUT is version-checked, which is what
 * made that a bug rather than a race nobody noticed: both writes carried the
 * version the screen was showing, the server took the first and answered 409 to
 * the second, and the dish the user removed came back.
 */

const eventId = "event-1";
const menuUrl = `/api/events/${eventId}/menu`;

function eventFile(): EventFile {
  return {
    id: eventId,
    bookingStatus: "INQUIRY",
    clientName: "Client",
    eventType: "Wedding",
    eventTypeId: "event-type-1",
    title: "Event 1",
    date: "Aug 20, 2026",
    dateInput: "2026-08-20",
    time: "2:00 AM",
    timeInput: "02:00",
    hallId: "hall-1",
    room: "E2E Hall",
    packageId: "",
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

function menuDocument(dishNames: string[], version: number): EventMenuDocument {
  return {
    id: "menu-1",
    meal: "Main",
    status: "Draft",
    serviceStyle: null,
    confirmedAt: null,
    version,
    confirmedBy: null,
    packageId: null,
    lines: dishNames.map((name, index) => ({
      id: `line-${name}`,
      menuItemId: `item-${name}`,
      addOnId: null,
      kind: "Dish" as const,
      itemKind: "Food",
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

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => body
  } as unknown as Response;
}

/** The menu as the server holds it, version-checked the way the route is. */
let serverDishes: string[] = [];
let serverVersion = 1;

/** Set to hold the next PUT open, so a second click lands inside the first. */
let releaseWrite: (() => void) | null = null;
let heldWrite: Promise<void> | null = null;

/** Set to hold the next GET open, standing in for a background refresh. */
let releaseRead: ((response: Response) => void) | null = null;
let heldRead: Promise<Response> | null = null;

function holdNextWrite() {
  heldWrite = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
}

function holdNextRead() {
  heldRead = new Promise<Response>((resolve) => {
    releaseRead = resolve;
  });
}

function writes() {
  return vi
    .mocked(authenticatedFetch)
    .mock.calls.filter(([, init]) => init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init?.body)) as {
      version: number;
      lines: Array<{ menuItemId: string | null; quantityMultiplier?: number }>;
    });
}

function quantityOf(
  body: {
    lines: Array<{ menuItemId: string | null; quantityMultiplier?: number }>;
  },
  dish: string
) {
  return body.lines.find((line) => line.menuItemId === `item-${dish}`)
    ?.quantityMultiplier;
}

function dishesIn(body: { lines: Array<{ menuItemId: string | null }> }) {
  return body.lines.map((line) => String(line.menuItemId).replace("item-", ""));
}

async function mount() {
  await act(async () => {
    render(
      <EventMenuContent event={eventFile()} onEventSaved={async () => undefined} />
    );
  });
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

describe("event menu edits made faster than the server answers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cacheTestSessionForStarterRole("event-manager");
    clearAuthenticatedQueryCache();

    serverDishes = ["Soup", "Salad", "Kugel"];
    serverVersion = 1;
    releaseWrite = null;
    heldWrite = null;
    releaseRead = null;
    heldRead = null;

    vi.mocked(authenticatedFetch).mockReset();
    vi.mocked(authenticatedFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/api/menu") {
        return jsonResponse({ items: [], addOns: [], packages: [] });
      }

      if (method === "PUT") {
        const body = JSON.parse(String(init?.body)) as {
          version: number;
          lines: Array<{ menuItemId: string | null }>;
        };

        if (heldWrite) {
          const gate = heldWrite;
          heldWrite = null;
          await gate;
        }

        // The route's optimistic lock. A write against a version the server has
        // moved past is refused, not merged.
        if (body.version !== serverVersion) {
          return jsonResponse(
            { error: "Somebody else changed this menu." },
            409
          );
        }

        serverDishes = dishesIn(body);
        serverVersion += 1;

        return jsonResponse({
          menu: menuDocument(serverDishes, serverVersion)
        });
      }

      if (heldRead) {
        const held = heldRead;
        heldRead = null;

        return held;
      }

      return jsonResponse({ menu: menuDocument(serverDishes, serverVersion) });
    });
  });

  it("keeps both dishes off when the second is removed inside the first save", async () => {
    await mount();
    holdNextWrite();

    await click("Remove Soup");
    await click("Remove Salad");

    // Both go straight away - the second click builds on the first rather than
    // on the menu the server last confirmed.
    expect(screen.queryByRole("button", { name: "Remove Soup" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove Salad" })).toBeNull();

    await act(async () => {
      releaseWrite?.();
    });
    await waitFor(() => expect(writes()).toHaveLength(2));

    expect(screen.queryByRole("button", { name: "Remove Soup" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove Salad" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove Kugel" })
    ).toBeInTheDocument();
    expect(serverDishes).toEqual(["Kugel"]);
  });

  it("sends one follow-up for a burst, against the version the first one left", async () => {
    await mount();
    holdNextWrite();

    await click("Remove Soup");
    await click("Remove Salad");
    await click("Remove Kugel");

    await act(async () => {
      releaseWrite?.();
    });
    await waitFor(() => expect(serverDishes).toEqual([]));

    const sent = writes();

    // Three clicks, two requests: the middle state is not worth sending when a
    // newer one is already queued behind it.
    expect(sent).toHaveLength(2);
    expect(dishesIn(sent[0])).toEqual(["Salad", "Kugel"]);
    expect(sent[0].version).toBe(1);
    // The follow-up carries the version the first save left behind, so it is
    // accepted rather than refused as a conflict.
    expect(dishesIn(sent[1])).toEqual([]);
    expect(sent[1].version).toBe(2);
  });

  it("saves a burst on the stepper once, at the number it was left on", async () => {
    // Three presses of + is one more dish to cook, not three saves. The stepper
    // waits for the user to stop, so the server hears 4 and never hears 2 or 3 -
    // three round trips and two version bumps that nobody was waiting for.
    await mount();

    await click("Increase Soup quantity");
    await click("Increase Soup quantity");
    await click("Increase Soup quantity");

    // Nothing has gone out yet; the card has moved regardless, which is the
    // point of the overlay.
    expect(writes()).toHaveLength(0);
    expect(
      screen.getByTestId("event-menu-quantity-item-Soup")
    ).toHaveTextContent("×4");

    await waitFor(() => expect(writes()).toHaveLength(1), { timeout: 3000 });

    const sent = writes();

    expect(quantityOf(sent[0], "Soup")).toBe(4);
    // The other dishes ride along untouched, because the tab sends the whole
    // line set on every write.
    expect(quantityOf(sent[0], "Kugel")).toBe(1);
  });

  it("does not make a removal wait on the stepper's pause", async () => {
    // Only the stepper is debounced. Taking a dish off is deliberate and rare,
    // and the sooner it is durable the better.
    await mount();

    await click("Remove Soup");

    await waitFor(() => expect(serverDishes).toEqual(["Salad", "Kugel"]));
    expect(writes()).toHaveLength(1);
  });

  it("offers to undo a removal, and puts the dish back where it was", async () => {
    await mount();

    await click("Remove Soup");
    await waitFor(() => expect(serverDishes).toEqual(["Salad", "Kugel"]));

    expect(screen.getByRole("status")).toHaveTextContent("Soup removed.");

    await click("Undo");
    await waitFor(() =>
      expect(serverDishes).toEqual(["Soup", "Salad", "Kugel"])
    );

    expect(
      screen.getByRole("button", { name: "Remove Soup" })
    ).toBeInTheDocument();
  });

  it("does not let a refresh that started first put a removed dish back", async () => {
    await mount();

    // A background refresh - the realtime layer ages this url on every write to
    // the events table - reading the menu as it stands before the removal.
    holdNextRead();
    act(() => invalidateAuthenticatedQuery(menuUrl));

    await click("Remove Soup");
    await waitFor(() => expect(serverDishes).toEqual(["Salad", "Kugel"]));

    await act(async () => {
      releaseRead?.(jsonResponse({ menu: menuDocument(["Soup", "Salad", "Kugel"], 1) }));
    });

    expect(screen.queryByRole("button", { name: "Remove Soup" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove Salad" })
    ).toBeInTheDocument();
  });

  it("puts every dish in the burst back when a save is refused", async () => {
    await mount();

    // Somebody else's write lands between the load and the click.
    serverVersion = 7;
    holdNextWrite();

    await click("Remove Soup");
    await click("Remove Salad");

    await act(async () => {
      releaseWrite?.();
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Somebody else changed this menu."
      )
    );

    // The queued second removal is dropped with the first: it was built on a
    // menu the server never accepted.
    expect(writes()).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Remove Soup" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Salad" })
    ).toBeInTheDocument();
  });
});
