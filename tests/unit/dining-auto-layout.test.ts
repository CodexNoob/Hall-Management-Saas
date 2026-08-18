import { describe, expect, it, vi } from "vitest";

import {
  cloneDiningLayoutTables,
  diningTableRequirements,
  findMatchingDiningLayout,
  generateDiningAutoLayout,
  type DiningEvent
} from "@/features/dining/components/dining-shared";

function event(overrides: Partial<DiningEvent> = {}): DiningEvent {
  return {
    bookingStatus: "CONFIRMED",
    boysCount: 0,
    clientName: "Client",
    couplesCount: 0,
    diningPlan: null,
    eventDate: "2026-08-17",
    eventStatus: "CONFIRMED",
    eventType: "Wedding",
    girlsCount: 0,
    hall: { id: "hall-1", name: "Main Hall" },
    id: "event-1",
    kidsCount: 0,
    ladiesCount: 0,
    menCount: 0,
    notes: null,
    packageName: null,
    startsAt: null,
    tableclothName: null,
    waitersCount: 0,
    washingTime: null,
    ...overrides
  };
}

describe("dining auto layout", () => {
  it("calculates required table counts from seating requirements", () => {
    expect(
      diningTableRequirements({
        childrenCount: 12,
        menRequired: 85,
        womenRequired: 85
      })
    ).toEqual({ kids: 2, men: 9, women: 9 });
  });

  it("finds a previous event with the same men, women, and kids table counts", () => {
    const requirements = { kids: 1, men: 2, women: 1 };
    const matched = findMatchingDiningLayout({
      currentEventId: "current",
      events: [
        event({ id: "current" }),
        event({
          id: "old-event",
          diningPlan: {
            adultCount: 30,
            childrenCount: 10,
            countType: "People",
            eventId: "old-event",
            hallMapPresetId: null,
            id: "plan-1",
            menWaiters: 0,
            specialNotes: null,
            tablecloth: null,
            tables: [
              { id: "m1", number: 1, seats: 10, side: "men" },
              { id: "m2", number: 2, seats: 10, side: "men" },
              { id: "w1", number: 3, seats: 10, side: "women" },
              { id: "k1", number: 4, seats: 10, side: "kids" }
            ],
            washingTime: null,
            womenWaiters: 0
          }
        })
      ],
      requirements
    });

    expect(matched?.id).toBe("old-event");
  });

  it("clones matched tables with fresh ids", () => {
    const createId = vi.fn().mockReturnValueOnce("new-1").mockReturnValueOnce("new-2");
    const cloned = cloneDiningLayoutTables(
      [
        { id: "old-1", number: 9, seats: 10, side: "men", x: 10, y: 20 },
        { id: "old-2", number: 10, seats: 10, side: "women", x: 80, y: 20 }
      ],
      createId
    );

    expect(cloned).toMatchObject([
      { id: "new-1", number: 1, side: "men", x: 10 },
      { id: "new-2", number: 2, side: "women", x: 80 }
    ]);
  });

  it("generates men left, women right, kids near the mechitza", () => {
    const layout = generateDiningAutoLayout({ kids: 2, men: 2, women: 2 });

    const seating = layout.filter((table) => table.isSeating !== false);

    expect(seating.filter((table) => table.side === "men")).toHaveLength(2);
    expect(seating.filter((table) => table.side === "women")).toHaveLength(2);
    expect(seating.filter((table) => table.side === "kids")).toHaveLength(2);
    expect(layout.find((table) => table.mapType === "divider")).toMatchObject({
      name: "Mechitza",
      isSeating: false
    });
    expect(seating.filter((table) => table.side === "men").every((table) => (table.x ?? 0) < 0)).toBe(true);
    expect(seating.filter((table) => table.side === "women").every((table) => (table.x ?? 0) > 0)).toBe(true);
  });
});
