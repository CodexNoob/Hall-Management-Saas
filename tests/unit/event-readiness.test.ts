import { describe, expect, it } from "vitest";
import {
  getEventReadinessSummary,
  getScopedEventReadinessItems
} from "@/features/events/components/event-readiness";
import { type EventFile } from "@/features/events/components/event-manager-shared";

function createEvent(overrides: Partial<EventFile> = {}): EventFile {
  return {
    id: "event-1",
    bookingStatus: "CONFIRMED",
    clientName: "E2E Wedding",
    eventType: "Wedding",
    title: "E2E Wedding",
    date: "Aug 22, 2026",
    dateInput: "2026-08-22",
    time: "6:00 PM",
    timeInput: "18:00",
    hallId: "hall-1",
    room: "Hall 1",
    packageName: "Standard",
    guests: "370",
    children: "20",
    couples: "10",
    coordinator: "Unassigned",
    balance: "See billing",
    status: "Confirmed",
    paymentStatus: "Paid in Full",
    version: 1,
    cancelledAt: null,
    completedAt: null,
    waitersCount: 8,
    setupTime: "17:15",
    washingTime: "23:00",
    tableclothName: "Champagne",
    notes: ["Internal note"],
    internalNotes: "Confirm waiter count before print.",
    daveningNote: "Mincha before chupah.",
    memberShulName: "Updated Shul",
    sideBoxes: "Women side boxes near stage.",
    shabbosSetup: "Set before candle lighting.",
    diningManagerNotes: "VIP table beside stage.",
    activityLogs: [],
    diningHallMapPreset: {
      id: "preset-1",
      name: "Wedding Layout",
      objects: []
    },
    phone: "Not provided",
    email: "",
    workspaceData: { timelineConfirmed: true },
    ...overrides
  };
}

describe("event readiness", () => {
  it("marks a complete confirmed event ready for event details and print packet", () => {
    const event = createEvent();

    expect(getEventReadinessSummary(event, "event")).toMatchObject({
      ready: true
    });
    expect(getEventReadinessSummary(event, "print")).toMatchObject({
      ready: true
    });
  });

  it("uses one readiness source with different event and print scopes", () => {
    const eventItems = getScopedEventReadinessItems(createEvent(), "event");
    const printItems = getScopedEventReadinessItems(createEvent(), "print");

    expect(eventItems.map((item) => item.id)).toContain("dining-plan");
    expect(printItems.map((item) => item.id)).not.toContain("dining-plan");
    expect(printItems.length).toBeLessThan(eventItems.length);
  });

  it("shows real missing data as incomplete", () => {
    const event = createEvent({
      bookingStatus: "TENTATIVE_HOLD",
      guests: "0",
      packageName: "Not assigned",
      paymentStatus: "No invoice",
      diningHallMapPreset: null,
      workspaceData: { timelineConfirmed: false }
    });

    const printItems = getScopedEventReadinessItems(event, "print");

    expect(printItems.find((item) => item.id === "event-confirmed")?.done).toBe(
      false
    );
    expect(printItems.find((item) => item.id === "guest-count")?.done).toBe(
      false
    );
    expect(printItems.find((item) => item.id === "menu")?.done).toBe(false);
    expect(printItems.find((item) => item.id === "hall-map")?.done).toBe(false);
    expect(printItems.find((item) => item.id === "timeline")?.done).toBe(false);
    expect(printItems.find((item) => item.id === "billing")?.done).toBe(false);
    expect(getEventReadinessSummary(event, "print")).toMatchObject({
      ready: false
    });
  });
});
