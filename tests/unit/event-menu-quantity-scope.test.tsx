import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import { clearAuthenticatedQueryCache } from "@/features/dashboard/hooks/use-authenticated-query";
import { EventMenuContent } from "@/features/events/components/event-menu-content";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import type {
  EventFile,
  EventMenuDocument,
  EventMenuLine
} from "@/features/events/components/event-manager-shared";
import { cacheTestSessionForStarterRole } from "./auth-session-fixture";

/**
 * Which lines the event menu offers a quantity on.
 *
 * Buffet, and only buffet. A second tray of brisket feeds the room a second
 * time; a second plate goes to a guest who is not seated, and an add-on has no
 * counting rule for a multiplier to act on. The stepper used to sit on every
 * card, which put a number in front of the kitchen that two of the three
 * sections had no way to honour.
 */

const eventId = "event-1";

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
    coordinatorMembershipId: "",
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

function dish(
  name: string,
  serviceStyle: string | null,
  overrides: Partial<EventMenuLine> = {}
): EventMenuLine {
  return {
    id: `line-${name}`,
    menuItemId: `item-${name}`,
    addOnId: null,
    kind: "Dish",
    name,
    pictureUrl: null,
    serviceStyle,
    availableStyles: serviceStyle === null ? ["Buffet", "Plated"] : [serviceStyle],
    price: null,
    notes: null,
    sortOrder: 0,
    quantityMultiplier: 1,
    source: "Manual",
    isRetired: false,
    ...overrides
  };
}

function addOn(name: string, overrides: Partial<EventMenuLine> = {}): EventMenuLine {
  return {
    id: `line-${name}`,
    menuItemId: null,
    addOnId: `addon-${name}`,
    kind: "AddOn",
    name,
    pictureUrl: null,
    serviceStyle: null,
    availableStyles: [],
    price: null,
    notes: null,
    sortOrder: 0,
    quantityMultiplier: 1,
    source: "Manual",
    isRetired: false,
    ...overrides
  };
}

function menuDocument(lines: EventMenuLine[]): EventMenuDocument {
  return {
    id: "menu-1",
    meal: "Main",
    status: "Draft",
    serviceStyle: null,
    confirmedAt: null,
    version: 1,
    confirmedBy: null,
    packageId: null,
    lines: lines.map((line, index) => ({ ...line, sortOrder: index }))
  };
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as unknown as Response;
}

/** The menu the mocked route answers with. */
let served: EventMenuLine[] = [];

function writes() {
  return vi
    .mocked(authenticatedFetch)
    .mock.calls.filter(([, init]) => init?.method === "PUT")
    .map(
      ([, init]) =>
        JSON.parse(String(init?.body)) as {
          lines: Array<{
            menuItemId: string | null;
            serviceStyle?: string | null;
            quantityMultiplier?: number;
          }>;
        }
    );
}

async function mount(lines: EventMenuLine[]) {
  served = lines;

  await act(async () => {
    render(<EventMenuContent event={eventFile()} onEventSaved={async () => undefined} />);
  });
}

describe("quantity is a buffet-only control", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cacheTestSessionForStarterRole("event-manager");
    clearAuthenticatedQueryCache();

    vi.mocked(authenticatedFetch).mockReset();
    vi.mocked(authenticatedFetch).mockImplementation(async (input, init) => {
      const url = String(input);

      if (url === "/api/menu") {
        return jsonResponse({ items: [], addOns: [], packages: [] });
      }

      if (init?.method === "PUT") {
        return jsonResponse({ menu: menuDocument(served) });
      }

      return jsonResponse({ menu: menuDocument(served) });
    });
  });

  it("offers the stepper on a buffet dish and on nothing else", async () => {
    await mount([dish("Brisket", "Buffet"), dish("Salmon", "Plated"), addOn("Bar")]);

    expect(
      screen.getByRole("button", { name: "Increase Brisket quantity" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Increase Salmon quantity" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Increase Bar quantity" })).toBeNull();

    // Nor the bare readout: a card that cannot be given a second helping has no
    // number to report, and "×1" on every plated dish is noise.
    expect(screen.queryByTestId("event-menu-quantity-item-Salmon")).toBeNull();
    expect(screen.queryByTestId("event-menu-quantity-addon-Bar")).toBeNull();
  });

  it("still shows a number a plated line already carries", async () => {
    // The kitchen sheet scales on the stored multiplier whatever style the line
    // sits under, so a row written before this rule has to stay legible - the
    // alternative is a screen that says one thing and a sheet that cooks another.
    await mount([dish("Salmon", "Plated", { quantityMultiplier: 3 })]);

    expect(screen.getByTestId("event-menu-quantity-item-Salmon")).toHaveTextContent(
      "×3"
    );
    expect(
      screen.queryByRole("button", { name: "Increase Salmon quantity" })
    ).toBeNull();
  });

  it("takes a quantity back to one serving when the dish is answered plated", async () => {
    await mount([dish("Kugel", null, { quantityMultiplier: 4 })]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Plated" }));
    });

    await waitFor(() => expect(writes()).toHaveLength(1));

    expect(writes()[0].lines[0]).toMatchObject({
      menuItemId: "item-Kugel",
      serviceStyle: "Plated",
      quantityMultiplier: 1
    });
  });

  it("keeps the quantity when the same dish is answered buffet", async () => {
    await mount([dish("Kugel", null, { quantityMultiplier: 4 })]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Buffet" }));
    });

    await waitFor(() => expect(writes()).toHaveLength(1));

    expect(writes()[0].lines[0]).toMatchObject({
      serviceStyle: "Buffet",
      quantityMultiplier: 4
    });
  });
});
