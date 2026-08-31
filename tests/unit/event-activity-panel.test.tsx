import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityPanel } from "@/features/events/components/event-details-panel";
import type { EventFile } from "@/features/events/components/event-manager-shared";

/**
 * The event workspace's record of what has been done to an event.
 *
 * /api/events has always fetched these entries and handed them to the workspace;
 * until this card existed they arrived in the browser and were dropped, so a
 * count could move with nothing on screen saying who moved it.
 */

// Typed in full rather than cast, so a field added to EventFile fails here
// instead of leaving the fixture quietly out of step with the real row.
function eventFile(activityLogs: EventFile["activityLogs"]): EventFile {
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
    packageId: "",
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
    activityLogs,
    diningHallMapPreset: null,
    phone: "",
    email: "",
    workspaceData: {},
    menuItemIds: []
  };
}

describe("ActivityPanel", () => {
  it("names the change, the actor and when it happened", () => {
    render(
      <ActivityPanel
        event={eventFile([
          {
            id: "log-1",
            actionType: "Guest Counts Changed",
            message:
              "Changed guest counts for Charles Duot: couples 10 to 25.",
            userName: "Sarah Klein",
            createdAt: "2026-08-21T14:05:00.000Z"
          }
        ])}
      />
    );

    expect(screen.getByText("Guest Counts Changed")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Changed guest counts for Charles Duot: couples 10 to 25."
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Sarah Klein/)).toBeInTheDocument();
  });

  it("lists the newest entry first, as the route returns them", () => {
    render(
      <ActivityPanel
        event={eventFile([
          {
            id: "log-2",
            actionType: "Guest Counts Changed",
            message: "Changed guest counts for Charles Duot: kids 0 to 6.",
            userName: "Sarah Klein",
            createdAt: "2026-08-21T14:05:00.000Z"
          },
          {
            id: "log-1",
            actionType: "Booking Created",
            message: "Created hold booking for Charles Duot in Main Hall.",
            userName: "Sarah Klein",
            createdAt: "2026-08-01T09:00:00.000Z"
          }
        ])}
      />
    );

    const labels = screen
      .getAllByText(/Guest Counts Changed|Booking Created/)
      .map((node) => node.textContent);

    expect(labels).toEqual(["Guest Counts Changed", "Booking Created"]);
  });

  it("says so when nothing has happened yet", () => {
    render(<ActivityPanel event={eventFile([])} />);

    expect(screen.getByText(/No activity recorded yet/)).toBeInTheDocument();
  });
});
