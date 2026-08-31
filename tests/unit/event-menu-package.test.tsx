import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
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
 * Putting a package on an event's menu from the manager.
 *
 * The point of the feature is that one click stands in for picking the same
 * dish list out of the library every time the venue sells its usual package, so
 * what is asserted here is the round trip: the drawer offers what the library
 * holds, applying sends one request against the menu's version, and the answer
 * - not a second fetch - is what the tab draws.
 */

const eventId = "event-1";
const menuUrl = `/api/events/${eventId}/menu`;
const packageUrl = `${menuUrl}/package`;

const soupId = "item-soup";
const roastId = "item-roast";

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

function dishLine(
  menuItemId: string,
  name: string,
  overrides: Partial<EventMenuLine> = {}
): EventMenuLine {
  return {
    id: `line-${menuItemId}`,
    menuItemId,
    addOnId: null,
    kind: "Dish",
    name,
    pictureUrl: null,
    serviceStyle: "Buffet",
    availableStyles: ["Buffet"],
    price: null,
    notes: null,
    sortOrder: 0,
    quantityMultiplier: 1,
    source: "Manual",
    isRetired: false,
    ...overrides
  };
}

function menuDocument(
  lines: EventMenuLine[],
  packageId: string | null = null,
  version = 1
): EventMenuDocument {
  return {
    id: "menu-1",
    meal: "Main",
    status: "Draft",
    serviceStyle: null,
    confirmedAt: null,
    version,
    confirmedBy: null,
    packageId,
    lines
  };
}

const library = {
  items: [
    {
      id: soupId,
      name: "Chicken soup",
      isActive: true,
      services: [{ serviceStyle: "Buffet" }],
      pictureUrl: null
    },
    {
      id: roastId,
      name: "Roast beef",
      isActive: true,
      // Two rules, so the event has to be asked which one applies.
      services: [{ serviceStyle: "Buffet" }, { serviceStyle: "Plated" }],
      pictureUrl: null
    }
  ],
  addOns: [],
  packages: [
    {
      id: "package-1",
      name: "Wedding Classic",
      regularPrice: "125",
      includedMenuItemIds: [soupId, roastId],
      isActive: true
    },
    {
      id: "package-2",
      name: "Retired Kiddush",
      regularPrice: "40",
      includedMenuItemIds: [soupId],
      // Deactivated in the library, so it is not offered for anything new.
      isActive: false
    }
  ]
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => body
  } as unknown as Response;
}

/** What the GET answers with, swapped by a test before it mounts. */
let currentMenu: EventMenuDocument = menuDocument([]);

async function mount(
  onEventSaved: () => Promise<unknown> = async () => undefined
) {
  await act(async () => {
    render(
      <EventMenuContent event={eventFile()} onEventSaved={onEventSaved} />
    );
  });
}

async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

function callsTo(url: string, method: string) {
  return vi
    .mocked(authenticatedFetch)
    .mock.calls.filter(
      ([input, init]) =>
        String(input).startsWith(url) && (init?.method ?? "GET") === method
    );
}

describe("event menu packages", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cacheTestSessionForStarterRole("event-manager");
    clearAuthenticatedQueryCache();
    currentMenu = menuDocument([]);

    vi.mocked(authenticatedFetch).mockReset();
    vi.mocked(authenticatedFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/api/menu") return jsonResponse(library);

      if (url.startsWith(packageUrl)) {
        if (method === "POST") {
          return jsonResponse({
            menu: menuDocument(
              [
                dishLine(soupId, "Chicken soup", { source: "Package" }),
                dishLine(roastId, "Roast beef", {
                  source: "Package",
                  serviceStyle: null,
                  availableStyles: ["Buffet", "Plated"]
                })
              ],
              "package-1",
              2
            )
          });
        }

        // A removal takes the package's lines with it and leaves the rest.
        return jsonResponse({
          menu: menuDocument([dishLine("item-kugel", "Potato kugel")], null, 3)
        });
      }

      return jsonResponse({ menu: currentMenu });
    });
  });

  it("says no package is on the event and offers to add one", async () => {
    await mount();

    expect(screen.getByText("No package on this event")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add package" })).toBeEnabled();
  });

  it("offers only active packages, with the style each dish will land under", async () => {
    await mount();
    await click("Add package");

    expect(screen.getByText("Wedding Classic")).toBeInTheDocument();
    // Deactivated in the library, so it is not on offer here either.
    expect(screen.queryByText("Retired Kiddush")).not.toBeInTheDocument();
    expect(screen.getByText("Chicken soup")).toBeInTheDocument();
    // A dish with a rule for both styles is flagged before it is added, not
    // filed under a guess that would decide what the kitchen cooks.
    expect(screen.getByText("Needs a style")).toBeInTheDocument();
  });

  it("applies the package against the menu's version and draws the answer", async () => {
    const onEventSaved = vi.fn(async () => undefined);

    await mount(onEventSaved);
    await click("Add package");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Wedding Classic/ }));
    });
    await click(/Add Wedding Classic/);

    const [, init] = callsTo(packageUrl, "POST")[0];

    expect(JSON.parse(String(init?.body))).toEqual({
      meal: "Main",
      version: 1,
      packageId: "package-1"
    });
    // Answered with the whole menu, so nothing goes back to re-read it.
    expect(callsTo(menuUrl, "GET")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Remove Chicken soup" })
    ).toBeInTheDocument();
    // The strip now names the package, and the event row is re-read because it
    // is what the rest of the manager shows the package name from.
    expect(screen.getByText("Wedding Classic")).toBeInTheDocument();
    expect(onEventSaved).toHaveBeenCalled();
    // The dish carrying two rules is surfaced rather than quietly filed.
    expect(screen.getByText("Needs a service style")).toBeInTheDocument();
  });

  it("confirms before removing, then takes only the package's dishes off", async () => {
    currentMenu = menuDocument(
      [
        dishLine(soupId, "Chicken soup", { source: "Package" }),
        dishLine("item-kugel", "Potato kugel")
      ],
      "package-1"
    );

    await mount();

    expect(
      screen.getByText(/1 dish on this menu came from the package/)
    ).toBeInTheDocument();

    await click("Remove");

    // Nothing is written by opening the question.
    expect(callsTo(packageUrl, "DELETE")).toHaveLength(0);

    await click("Remove package");

    const [url] = callsTo(packageUrl, "DELETE")[0];

    expect(String(url)).toBe(`${packageUrl}?meal=Main&version=1`);
    expect(screen.getByText("No package on this event")).toBeInTheDocument();
    // The hand-added dish is still there; only the package's went.
    expect(
      screen.getByRole("button", { name: "Remove Potato kugel" })
    ).toBeInTheDocument();
  });

  it("offers the dishes of a package the booking named but never materialised", async () => {
    // A package chosen when the booking was taken puts nothing on the menu.
    currentMenu = menuDocument(
      [dishLine("item-kugel", "Potato kugel")],
      "package-1"
    );

    await mount();

    expect(screen.getByText(/no longer on this menu/)).toBeInTheDocument();
    // "Change package" would be the wrong offer when none of it is here.
    expect(
      screen.getByRole("button", { name: "Add its dishes" })
    ).toBeEnabled();
  });

  it("leaves the package alone while the menu is confirmed", async () => {
    currentMenu = {
      ...menuDocument(
        [dishLine(soupId, "Chicken soup", { source: "Package" })],
        "package-1"
      ),
      status: "Confirmed"
    };

    await mount();

    expect(
      screen.getByRole("button", { name: "Change package" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
  });
});
