import { describe, expect, it } from "vitest";

import {
  SEAT_DEPTH,
  SEAT_GAP,
  getSeatPlacements,
  isRoundSeatingShape,
  seatingSidesSchema,
  type SeatingShape
} from "@/lib/hall-map/seating";
import { buildDiningTablesFromHallMapPresetObjects } from "@/features/dining/components/dining-shared";
import {
  MIN_TABLE_SIZE,
  getDefaultSeatingSides,
  getObjectSeatPlacements,
  type MapObject
} from "@/features/hall-room-map/components/hall-map-shared";

const SEAT_OFFSET = SEAT_GAP + SEAT_DEPTH / 2;

function round(overrides: Partial<SeatingShape> = {}): SeatingShape {
  return { round: true, width: 96, height: 96, seats: 10, ...overrides };
}

function rect(overrides: Partial<SeatingShape> = {}): SeatingShape {
  return { round: false, width: 150, height: 46, seats: 6, ...overrides };
}

/** Which edge a placement sits on, inferred from the direction it faces. */
function edgeOf(angle: number) {
  const normalized = ((angle % 360) + 360) % 360;

  if (normalized === 0) return "top";
  if (normalized === 90) return "right";
  if (normalized === 180) return "bottom";
  return "left";
}

function countByEdge(placements: Array<{ angle: number }>) {
  return placements.reduce<Record<string, number>>((counts, placement) => {
    const edge = edgeOf(placement.angle);
    counts[edge] = (counts[edge] ?? 0) + 1;
    return counts;
  }, {});
}

describe("round table seating", () => {
  it("draws one chair per seat", () => {
    expect(getSeatPlacements(round({ seats: 10 }))).toHaveLength(10);
    expect(getSeatPlacements(round({ seats: 3 }))).toHaveLength(3);
  });

  it("spaces chairs evenly around the full circle", () => {
    const seats = 8;
    const placements = getSeatPlacements(round({ seats }));
    const center = 48;
    const angles = placements.map((placement) =>
      Math.atan2(placement.y - center, placement.x - center)
    );

    const fullTurn = Math.PI * 2;

    for (let index = 1; index < angles.length; index += 1) {
      // atan2 wraps at +/-PI, so normalise before comparing the step.
      const delta =
        (((angles[index] - angles[index - 1]) % fullTurn) + fullTurn) % fullTurn;
      expect(delta).toBeCloseTo(fullTurn / seats, 6);
    }
  });

  it("places the first chair at twelve o'clock, facing the table", () => {
    const [first] = getSeatPlacements(round({ seats: 6 }));

    expect(first.x).toBeCloseTo(48, 6);
    expect(first.y).toBeCloseTo(-SEAT_OFFSET, 6);
    expect(first.angle).toBeCloseTo(0, 6);
  });

  it("keeps every chair clear of the table edge", () => {
    const placements = getSeatPlacements(round({ seats: 12 }));

    for (const placement of placements) {
      const distance = Math.hypot(placement.x - 48, placement.y - 48);
      expect(distance).toBeCloseTo(48 + SEAT_OFFSET, 6);
    }
  });

  it("ignores the sides option, which only applies to rectangles", () => {
    const withSides = getSeatPlacements(round({ seats: 6, sides: 1 }));
    const withoutSides = getSeatPlacements(round({ seats: 6 }));

    expect(withSides).toEqual(withoutSides);
  });
});

describe("rectangular table seating", () => {
  it("puts every chair on one edge for one-side seating", () => {
    const placements = getSeatPlacements(rect({ seats: 5, sides: 1 }));

    expect(countByEdge(placements)).toEqual({ top: 5 });
    for (const placement of placements) {
      expect(placement.y).toBeCloseTo(-SEAT_OFFSET, 6);
    }
  });

  it("seats the long edges when two sides are chosen", () => {
    const wide = getSeatPlacements(rect({ width: 150, height: 46, seats: 8, sides: 2 }));
    const tall = getSeatPlacements(rect({ width: 46, height: 150, seats: 8, sides: 2 }));

    expect(countByEdge(wide)).toEqual({ top: 4, bottom: 4 });
    expect(countByEdge(tall)).toEqual({ left: 4, right: 4 });
  });

  it("gives an odd seat to the first edge", () => {
    // Seven across two sides is four then three, not a fractional split.
    expect(countByEdge(getSeatPlacements(rect({ seats: 7, sides: 2 })))).toEqual({
      top: 4,
      bottom: 3
    });
  });

  it("spreads four-side seating in proportion to edge length", () => {
    const placements = getSeatPlacements(
      rect({ width: 104, height: 76, seats: 10, sides: 4 })
    );

    // The long edges are wider, so they take the two spare seats.
    expect(countByEdge(placements)).toEqual({
      top: 3,
      bottom: 3,
      left: 2,
      right: 2
    });
  });

  it("leaves an equal margin at both ends of an edge", () => {
    const placements = getSeatPlacements(rect({ width: 150, seats: 4, sides: 1 }));
    const xs = placements.map((placement) => placement.x);

    expect(xs[0]).toBeCloseTo(150 - xs[xs.length - 1], 6);
  });

  it("defaults to two-side seating when no choice is stored", () => {
    const withoutSides = getSeatPlacements(rect({ seats: 6 }));

    expect(countByEdge(withoutSides)).toEqual({ top: 3, bottom: 3 });
  });
});

describe("degenerate input", () => {
  it("draws nothing for a table with no seats", () => {
    expect(getSeatPlacements(round({ seats: 0 }))).toEqual([]);
    expect(getSeatPlacements(rect({ seats: 0 }))).toEqual([]);
  });

  it("draws nothing for negative or unusable seat counts", () => {
    expect(getSeatPlacements(round({ seats: -4 }))).toEqual([]);
    expect(getSeatPlacements(round({ seats: Number.NaN }))).toEqual([]);
  });

  it("draws nothing for a table with no area", () => {
    expect(getSeatPlacements(round({ width: 0 }))).toEqual([]);
    expect(getSeatPlacements(rect({ height: 0 }))).toEqual([]);
  });

  it("ignores a fractional seat count rather than drawing half a chair", () => {
    expect(getSeatPlacements(round({ seats: 5.7 }))).toHaveLength(5);
  });
});

describe("map object seating", () => {
  function object(overrides: Partial<MapObject> = {}): MapObject {
    return {
      id: "object-1",
      type: "rect-table",
      name: "Table",
      x: 0,
      y: 0,
      width: 150,
      height: 46,
      rotation: 0,
      seats: 6,
      seatingUse: "adult",
      ...overrides
    };
  }

  it("seats a small round table against the size it is actually drawn at", () => {
    // Tables render at MIN_TABLE_SIZE even when stored smaller; seating has to
    // follow the drawn circle, not the stored one.
    const placements = getObjectSeatPlacements(
      object({ type: "round-table", width: 20, height: 20, seats: 4 })
    );
    const center = MIN_TABLE_SIZE / 2;

    for (const placement of placements) {
      const distance = Math.hypot(placement.x - center, placement.y - center);
      expect(distance).toBeCloseTo(center + SEAT_OFFSET, 6);
    }
  });

  it("honours an explicit sides choice over the shape default", () => {
    const oneSided = getObjectSeatPlacements(object({ seats: 6, seatingSides: 1 }));

    expect(countByEdge(oneSided)).toEqual({ top: 6 });
  });

  it("serves head tables, buffets and drinks from a single side", () => {
    expect(getDefaultSeatingSides("head-table")).toBe(1);
    expect(getDefaultSeatingSides("buffet")).toBe(1);
    expect(getDefaultSeatingSides("drinks")).toBe(1);
    expect(getDefaultSeatingSides("rect-table")).toBe(2);
    expect(getDefaultSeatingSides("box")).toBe(2);
  });

  it("draws nothing for shapes that carry no seats", () => {
    expect(
      getObjectSeatPlacements(object({ type: "divider", seats: 0 }))
    ).toEqual([]);
  });
});

describe("shared shape classification", () => {
  it("recognises the round shapes by their stored string type", () => {
    // The Dining Manager stores the shape as `mapType: string`, so this has to
    // work without the ShapeType union.
    expect(isRoundSeatingShape("round-table")).toBe(true);
    expect(isRoundSeatingShape("kids-table")).toBe(true);
    expect(isRoundSeatingShape("circle")).toBe(true);
    expect(isRoundSeatingShape("rect-table")).toBe(false);
    expect(isRoundSeatingShape(undefined)).toBe(false);
  });
});

describe("dining manager inherits the hall map seating", () => {
  const presetObject = {
    id: "map-object-1",
    type: "rect-table",
    name: "Table 1",
    x: 40,
    y: 60,
    width: 150,
    height: 46,
    rotation: 0,
    seats: 8,
    seatingUse: "adult" as const
  };

  it("carries the seating choice from the saved hall map onto the table", () => {
    const [table] = buildDiningTablesFromHallMapPresetObjects(
      [{ ...presetObject, seatingSides: 4 }],
      () => "dining-1"
    );

    expect(table.seatingSides).toBe(4);
    expect(table.mapType).toBe("rect-table");
    expect(table.seats).toBe(8);
  });

  it("leaves the choice unset for presets saved before seating existed", () => {
    const [table] = buildDiningTablesFromHallMapPresetObjects(
      [presetObject],
      () => "dining-1"
    );

    // Undefined rather than a guessed value, so rendering applies the shape
    // default and an old preset is not silently rewritten.
    expect(table.seatingSides).toBeUndefined();
  });

  it("keeps the field through the dining plan's table validation", () => {
    // Zod strips unknown keys, so the API schema has to list seatingSides or a
    // saved plan comes back without it.
    expect(seatingSidesSchema.parse(4)).toBe(4);
    expect(seatingSidesSchema.parse(undefined)).toBeUndefined();
    expect(seatingSidesSchema.safeParse(3).success).toBe(false);
    expect(seatingSidesSchema.safeParse(0).success).toBe(false);
  });
});
