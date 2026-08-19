import { describe, expect, it, vi } from "vitest";

import {
  clampSeatsPerTable,
  cloneDiningLayoutTables,
  deriveSeatsPerTable,
  diningGenderSplit,
  diningTableRequirements,
  findMatchingDiningLayout,
  generateDiningAutoLayout,
  type DiningEvent,
  type DiningTableData
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

function plan(eventId: string, tables: DiningTableData[]) {
  return {
    adultCount: 30,
    childrenCount: 10,
    countType: "People" as const,
    eventId,
    hallMapPresetId: null,
    id: `plan-${eventId}`,
    menWaiters: 0,
    specialNotes: null,
    tablecloth: null,
    tables,
    washingTime: null,
    womenWaiters: 0
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
      currentEvent: event({ id: "current" }),
      adultCount: 30,
      childrenCount: 10,
      events: [
        event({ id: "current" }),
        event({
          id: "old-event",
          diningPlan: plan("old-event", [
            { id: "m1", number: 1, seats: 10, side: "men" },
            { id: "m2", number: 2, seats: 10, side: "men" },
            { id: "w1", number: 3, seats: 10, side: "women" },
            { id: "k1", number: 4, seats: 10, side: "kids" }
          ])
        })
      ],
      requirements
    });

    expect(matched?.id).toBe("old-event");
  });

  it("never reuses a layout from a different hall", () => {
    // Table coordinates are meaningless in a room of another shape, however
    // well the counts line up.
    const matched = findMatchingDiningLayout({
      currentEvent: event({ id: "current" }),
      adultCount: 30,
      childrenCount: 0,
      events: [
        event({
          id: "other-hall",
          hall: { id: "hall-2", name: "Garden Room" },
          diningPlan: plan("other-hall", [
            { id: "m1", number: 1, seats: 10, side: "men" },
            { id: "w1", number: 2, seats: 10, side: "women" }
          ])
        })
      ],
      requirements: { kids: 0, men: 1, women: 1 }
    });

    expect(matched).toBeNull();
  });

  it("prefers the closest guest count, then the nearest date", () => {
    const tables: DiningTableData[] = [
      { id: "m1", number: 1, seats: 10, side: "men" },
      { id: "w1", number: 2, seats: 10, side: "women" }
    ];
    const matched = findMatchingDiningLayout({
      currentEvent: event({ id: "current", eventDate: "2026-08-20" }),
      adultCount: 20,
      childrenCount: 0,
      events: [
        // Same signature, but 60 adults away.
        event({
          id: "far-count",
          eventDate: "2026-08-21",
          diningPlan: { ...plan("far-count", tables), adultCount: 80 }
        }),
        // Same guest count as the current event, further away in time.
        event({
          id: "close-count",
          eventDate: "2026-11-02",
          diningPlan: { ...plan("close-count", tables), adultCount: 20 }
        })
      ],
      requirements: { kids: 0, men: 1, women: 1 }
    });

    expect(matched?.id).toBe("close-count");
  });

  it("breaks a full tie by the nearest date", () => {
    const tables: DiningTableData[] = [
      { id: "m1", number: 1, seats: 10, side: "men" }
    ];
    const matched = findMatchingDiningLayout({
      currentEvent: event({ id: "current", eventDate: "2026-08-20" }),
      adultCount: 10,
      childrenCount: 0,
      events: [
        event({
          id: "distant",
          eventDate: "2026-12-25",
          diningPlan: { ...plan("distant", tables), adultCount: 10 }
        }),
        event({
          id: "nearby",
          eventDate: "2026-08-22",
          diningPlan: { ...plan("nearby", tables), adultCount: 10 }
        })
      ],
      requirements: { kids: 0, men: 1, women: 0 }
    });

    expect(matched?.id).toBe("nearby");
  });
});

describe("dining gender split", () => {
  it("uses the booking's own men and ladies counts", () => {
    // 20 couples (one seat each side) + 20 men + 0 ladies = 40 men, 20 women.
    expect(
      diningGenderSplit(
        { couplesCount: 20, menCount: 20, ladiesCount: 0 },
        60
      )
    ).toEqual({ menRequired: 40, womenRequired: 20 });
  });

  it("mirrors the split when the ladies outnumber the men", () => {
    expect(
      diningGenderSplit({ couplesCount: 0, menCount: 40, ladiesCount: 60 }, 100)
    ).toEqual({ menRequired: 40, womenRequired: 60 });

    // The same totals reversed must not produce the same seating - the flaw
    // in the old ceil(adults / 2) assumption.
    expect(
      diningGenderSplit({ couplesCount: 0, menCount: 60, ladiesCount: 40 }, 100)
    ).toEqual({ menRequired: 60, womenRequired: 40 });
  });

  it("scales the booked ratio when a planner edits the head count", () => {
    // Booked 30/10; the form now says 80 adults, so keep the 3:1 shape.
    expect(
      diningGenderSplit({ couplesCount: 0, menCount: 30, ladiesCount: 10 }, 80)
    ).toEqual({ menRequired: 60, womenRequired: 20 });
  });

  it("falls back to an even split with no gender breakdown", () => {
    expect(
      diningGenderSplit({ couplesCount: 0, menCount: 0, ladiesCount: 0 }, 41)
    ).toEqual({ menRequired: 21, womenRequired: 20 });
    expect(diningGenderSplit(null, 41)).toEqual({
      menRequired: 21,
      womenRequired: 20
    });
  });

  it("never allocates more men than there are adults", () => {
    const split = diningGenderSplit(
      { couplesCount: 0, menCount: 100, ladiesCount: 0 },
      10
    );

    expect(split.menRequired).toBe(10);
    expect(split.womenRequired).toBe(0);
  });
});

describe("dining seats per table", () => {
  const seating = (seats: number, side: DiningTableData["side"] = "men") => ({
    id: `t-${seats}-${side}-${Math.round(seats * 7)}`,
    number: 1,
    seats,
    side
  });

  it("reads the venue's table size back from the layout", () => {
    expect(
      deriveSeatsPerTable([
        seating(12),
        seating(12, "women"),
        seating(12, "kids"),
        seating(10)
      ])
    ).toBe(12);
  });

  it("ignores the head table, which is its own size", () => {
    // One 12-seat head table must not outvote the 8-seat rounds.
    expect(
      deriveSeatsPerTable([
        { id: "h", number: 1, seats: 12, side: "head" },
        seating(8),
        seating(8, "women")
      ])
    ).toBe(8);
  });

  it("ignores dividers and other non-seating objects", () => {
    expect(
      deriveSeatsPerTable([
        { id: "d", number: 1, seats: 0, side: "men", isSeating: false },
        seating(12),
        seating(12, "women")
      ])
    ).toBe(12);
  });

  it("breaks a tie towards the larger table", () => {
    // Under-stating capacity inflates the table count; over-stating it seats
    // everyone. On an even split, prefer the one that seats everyone.
    expect(deriveSeatsPerTable([seating(10), seating(12, "women")])).toBe(12);
  });

  it("falls back to ten with nothing to read", () => {
    expect(deriveSeatsPerTable([])).toBe(10);
  });

  it("clamps out-of-range and nonsense input", () => {
    expect(clampSeatsPerTable(0)).toBe(1);
    expect(clampSeatsPerTable(999)).toBe(30);
    expect(clampSeatsPerTable(10.4)).toBe(10);
    expect(clampSeatsPerTable(Number.NaN)).toBe(10);
  });

  it("needs fewer tables when the tables are bigger", () => {
    const guests = { childrenCount: 40, menRequired: 120, womenRequired: 120 };

    expect(diningTableRequirements({ ...guests, tableCapacity: 10 })).toEqual({
      kids: 4,
      men: 12,
      women: 12
    });
    expect(diningTableRequirements({ ...guests, tableCapacity: 12 })).toEqual({
      kids: 4,
      men: 10,
      women: 10
    });
  });

  it("generates tables at the size the counts were worked out from", () => {
    // The bug this guards: counts derived from 12-seat tables, tables built at
    // 10 seats, layout silently 40 seats short of what it claims.
    const requirements = diningTableRequirements({
      childrenCount: 0,
      menRequired: 120,
      womenRequired: 120,
      tableCapacity: 12
    });
    const layout = generateDiningAutoLayout(requirements, 12);
    const seatingTables = layout.filter((table) => table.isSeating !== false);

    expect(seatingTables).toHaveLength(20);
    expect(seatingTables.every((table) => table.seats === 12)).toBe(true);
    expect(
      seatingTables.reduce((total, table) => total + table.seats, 0)
    ).toBe(240);
  });

  it("still defaults to ten-seat tables when no size is given", () => {
    const layout = generateDiningAutoLayout({ kids: 0, men: 1, women: 0 });

    expect(layout.find((table) => table.side === "men")?.seats).toBe(10);
  });
});

describe("dining layout generation", () => {
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
