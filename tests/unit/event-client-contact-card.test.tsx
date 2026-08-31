import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn()
}));

import { ClientContact } from "@/features/events/components/event-details-panel";
import type { EventFile } from "@/features/events/components/event-manager-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

/**
 * Who to contact, edited a row at a time.
 *
 * The card used to be a read-only list: a phone that could only be changed from
 * the form above it, and an email and coordinator that could not be set at all.
 * Each row saves on its own now, which is why these tests care as much about
 * what a save carries as about what it stores - a row that sent its neighbours
 * along would put stale values back over their edits.
 */

// Typed in full rather than cast, so a field added to EventFile fails here
// instead of leaving the fixture quietly out of step with the real row.
function eventFile(overrides: Partial<EventFile> = {}): EventFile {
  return {
    id: "event-1",
    bookingStatus: "INQUIRY",
    clientName: "Charles Duot",
    eventType: "Wedding",
    eventTypeId: "event-type-1",
    title: "Event 1",
    date: "Aug 20, 2026",
    dateInput: "2026-08-20",
    time: "6:30 PM",
    timeInput: "18:30",
    hallId: "hall-1",
    room: "Main Hall",
    packageName: "Gold dinner",
    guests: "187",
    children: "12",
    couples: "40",
    coordinator: "Unassigned",
    coordinatorMembershipId: "",
    balance: "See billing",
    status: "Hold",
    paymentStatus: "No invoice",
    version: 1,
    cancelledAt: null,
    completedAt: null,
    waitersCount: 8,
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
    phone: "+12125550123",
    email: "",
    workspaceData: {},
    menuItemIds: [],
    ...overrides
  };
}

function renderCard(event = eventFile()) {
  const onEventSaved = vi.fn().mockResolvedValue(undefined);

  render(<ClientContact event={event} onEventSaved={onEventSaved} />);

  return { onEventSaved };
}

function openRow(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function typeInto(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function clickSave() {
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

/** The PATCH body of the only save that was made. */
function savedBody() {
  expect(authenticatedFetch).toHaveBeenCalledOnce();
  const [, init] = vi.mocked(authenticatedFetch).mock.calls[0];
  return JSON.parse(String(init?.body));
}

describe("ClientContact", () => {
  beforeEach(() => {
    vi.mocked(authenticatedFetch).mockReset();
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify({ event: { id: "event-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
  });

  it("keeps the phone and email dialable until a row is opened", () => {
    renderCard(eventFile({ email: "client@example.com" }));

    // The row is a link first and an editor second: tapping a number on a
    // phone should call it, which is why Edit is its own control.
    expect(screen.getByRole("link", { name: "+12125550123" })).toHaveAttribute(
      "href",
      "tel:+12125550123"
    );
    expect(
      screen.getByRole("link", { name: "client@example.com" })
    ).toHaveAttribute("href", "mailto:client@example.com");
  });

  it("saves an email on its own, carrying nothing else", async () => {
    const { onEventSaved } = renderCard();

    openRow("Edit email");
    typeInto("Email", "client@example.com");
    clickSave();

    await waitFor(() => expect(onEventSaved).toHaveBeenCalled());
    // One field per save. A body carrying the phone as well would overwrite
    // whatever the phone row had been changed to in the meantime.
    expect(savedBody()).toEqual({ email: "client@example.com" });
  });

  it("refuses an address that is not one, without saving", async () => {
    renderCard();

    openRow("Edit email");
    typeInto("Email", "not-an-address");
    clickSave();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a valid email address."
    );
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it("clears an address that was entered by mistake", async () => {
    renderCard(eventFile({ email: "wrong@example.com" }));

    openRow("Edit email");
    typeInto("Email", "");
    clickSave();

    // null rather than "": the event genuinely has no address again.
    await waitFor(() => expect(savedBody()).toEqual({ email: null }));
  });

  it("carries no coordinator row", () => {
    renderCard(
      eventFile({
        coordinator: "Sarah Klein",
        coordinatorMembershipId: "11111111-1111-4111-8111-111111111111"
      })
    );

    // The card is the phone and the email now. A coordinator is still stored on
    // the event and still settable when a booking is created, but nothing on
    // this card reads it or offers to change it.
    expect(screen.queryByRole("button", { name: "Edit coordinator" })).toBeNull();
    expect(screen.queryByText("Sarah Klein")).toBeNull();
    expect(screen.queryByText("Unassigned")).toBeNull();
  });

  it("abandons an edit on Cancel without saving", () => {
    renderCard();

    openRow("Edit email");
    typeInto("Email", "typed@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(authenticatedFetch).not.toHaveBeenCalled();
    expect(screen.getByText("Email not provided")).toBeInTheDocument();
  });

  it("only opens one row at a time", () => {
    renderCard();

    openRow("Edit email");
    expect(screen.getByLabelText("Email")).toBeInTheDocument();

    openRow("Edit phone");
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });
});
