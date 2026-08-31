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
    eventTypeId: "event-type-1",
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
    coordinatorMembershipId: "",
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
    workspaceData: { menuConfirmed: true, timelineConfirmed: true },
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

  // Hall map, dining plan and billing are each satisfied from a module the MVP
  // hides (lib/ui/mvp-features), so the checklist must not ask for them - three
  // items nobody can tick would leave Print packet permanently disabled.
  it("leaves out the checks the hidden modules would answer", () => {
    for (const scope of ["event", "print"] as const) {
      const ids = getScopedEventReadinessItems(createEvent(), scope).map(
        (item) => item.id
      );

      expect(ids).not.toContain("hall-map");
      expect(ids).not.toContain("dining-plan");
      expect(ids).not.toContain("billing");
    }
  });

  it("still marks an event with none of that data ready to print", () => {
    const event = createEvent({
      paymentStatus: "No invoice",
      diningHallMapPreset: null,
      diningManagerNotes: null
    });

    expect(getEventReadinessSummary(event, "print")).toMatchObject({
      ready: true
    });
  });

  it("shows real missing data as incomplete", () => {
    const event = createEvent({
      bookingStatus: "TENTATIVE_HOLD",
      guests: "0",
      packageName: "Not assigned",
      paymentStatus: "No invoice",
      diningHallMapPreset: null,
      workspaceData: { menuConfirmed: false, timelineConfirmed: false }
    });

    const printItems = getScopedEventReadinessItems(event, "print");

    expect(printItems.find((item) => item.id === "event-confirmed")?.done).toBe(
      false
    );
    expect(printItems.find((item) => item.id === "guest-count")?.done).toBe(
      false
    );
    expect(printItems.find((item) => item.id === "menu")?.done).toBe(false);
    expect(printItems.find((item) => item.id === "timeline")?.done).toBe(false);
    expect(getEventReadinessSummary(event, "print")).toMatchObject({
      ready: false
    });
  });

  it("marks the menu ready only after the event menu is confirmed", () => {
    const menuItems = getScopedEventReadinessItems(
      createEvent({
        packageName: "Standard",
        workspaceData: { menuConfirmed: false, timelineConfirmed: true }
      }),
      "event"
    );

    expect(menuItems.find((item) => item.id === "menu")).toMatchObject({
      done: false,
      helper: "Review and confirm the event menu."
    });

    const confirmedMenuItems = getScopedEventReadinessItems(
      createEvent({
        packageName: "Not assigned",
        workspaceData: { menuConfirmed: true, timelineConfirmed: true }
      }),
      "event"
    );

    expect(
      confirmedMenuItems.find((item) => item.id === "menu")
    ).toMatchObject({
      done: true,
      helper: "Menu has been reviewed and confirmed."
    });
  });
});
