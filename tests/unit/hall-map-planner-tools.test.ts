import { describe, expect, it } from "vitest";

import { SEAT_FOOTPRINT_OVERHANG } from "@/lib/hall-map/seating";
import {
  MAP_GRID_SIZE,
  findOverlappingObjectIds,
  formatFeet,
  generateTableRows,
  getObjectFootprint,
  snapToGrid,
  summarizeSeats,
  type MapObject
} from "@/features/hall-room-map/components/hall-map-shared";

function object(overrides: Partial<MapObject> = {}): MapObject {
  return {
    id: overrides.id ?? "object-1",
    type: "rect-table",
    name: "Table",
    x: 0,
    y: 0,
    width: 96,
    height: 48,
    rotation: 0,
    seats: 0,
    seatingUse: "none",
    ...overrides
  };
}

describe("grid snapping", () => {
  it("rounds to the nearest grid line", () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(9)).toBe(0);
    expect(snapToGrid(10)).toBe(MAP_GRID_SIZE);
    expect(snapToGrid(47)).toBe(40);
    expect(snapToGrid(-31)).toBe(-40);
  });

  it("passes values through untouched when disabled", () => {
    expect(snapToGrid(47, false)).toBe(47);
  });
});

describe("real-world units", () => {
  it("reads the default shapes at their real sizes", () => {
    // The scale is anchored on the 8ft banquet table.
    expect(formatFeet(96)).toBe("8 ft");
    expect(formatFeet(48)).toBe("4 ft");
  });

  it("keeps one decimal for sizes that need it", () => {
    expect(formatFeet(68)).toBe("5.7 ft");
  });
});

describe("seat summary", () => {
  it("buckets seats by seating use", () => {
    const summary = summarizeSeats([
      object({ id: "a", seats: 10, seatingUse: "adult" }),
      object({ id: "b", seats: 10, seatingUse: "adult" }),
      object({ id: "c", seats: 8, seatingUse: "kids" }),
      object({ id: "d", seats: 12, seatingUse: "head" })
    ]);

    expect(summary).toEqual({ total: 40, adult: 20, kids: 8, head: 12 });
  });

  it("ignores non-seating shapes even when a count was typed on them", () => {
    const summary = summarizeSeats([
      object({ id: "a", seats: 10, seatingUse: "none" }),
      object({ id: "b", type: "buffet", seats: 4, seatingUse: "none" })
    ]);

    expect(summary.total).toBe(0);
  });
});

describe("overlap detection", () => {
  it("flags two shapes whose boxes intersect", () => {
    const overlapping = findOverlappingObjectIds([
      object({ id: "a", x: 0, y: 0 }),
      object({ id: "b", x: 40, y: 10 })
    ]);

    expect(overlapping).toEqual(new Set(["a", "b"]));
  });

  it("leaves separated shapes alone", () => {
    const overlapping = findOverlappingObjectIds([
      object({ id: "a", x: 0, y: 0 }),
      object({ id: "b", x: 500, y: 500 })
    ]);

    expect(overlapping.size).toBe(0);
  });

  it("counts the chair ring as part of a seated table's footprint", () => {
    const seated = object({ id: "a", seats: 8, seatingUse: "adult" });
    const footprint = getObjectFootprint(seated);

    expect(footprint.minX).toBeCloseTo(-SEAT_FOOTPRINT_OVERHANG, 6);

    // Table tops 10px apart, but the chair rings between them collide.
    const overlapping = findOverlappingObjectIds([
      seated,
      object({ id: "b", x: 106, y: 0, seats: 8, seatingUse: "adult" })
    ]);
    expect(overlapping).toEqual(new Set(["a", "b"]));

    // The same gap with no chairs is clear.
    const bare = findOverlappingObjectIds([
      object({ id: "a", x: 0, y: 0 }),
      object({ id: "b", x: 106, y: 0 })
    ]);
    expect(bare.size).toBe(0);
  });

  it("uses the rotated bounding box", () => {
    // A divider turned 90deg reaches far above and below its stored box.
    const overlapping = findOverlappingObjectIds([
      object({
        id: "divider",
        type: "divider",
        width: 250,
        height: 12,
        rotation: 90,
        x: 100,
        y: 100
      }),
      object({ id: "b", x: 180, y: 220 })
    ]);

    expect(overlapping.has("divider")).toBe(true);
  });
});

describe("bulk table rows", () => {
  const input = {
    type: "round-table" as const,
    count: 8,
    perRow: 4,
    seats: 10,
    centerX: 0,
    centerY: 0,
    startNumber: 1
  };

  it("creates the requested number of tables, numbered in order", () => {
    const tables = generateTableRows(input);

    expect(tables).toHaveLength(8);
    expect(tables[0].name).toBe("Round Table 1");
    expect(tables[7].name).toBe("Round Table 8");
    expect(new Set(tables.map((table) => table.id)).size).toBe(8);
  });

  it("continues numbering from an existing layout", () => {
    const tables = generateTableRows({ ...input, startNumber: 13 });

    expect(tables[0].name).toBe("Round Table 13");
  });

  it("lays tables out in rows on the grid", () => {
    const tables = generateTableRows(input);
    const distinctY = new Set(tables.map((table) => table.y));

    expect(distinctY.size).toBe(2);
    for (const table of tables) {
      // Math.abs: a negative multiple's modulo is -0, which Object.is rejects.
      expect(Math.abs(table.x % MAP_GRID_SIZE)).toBe(0);
      expect(Math.abs(table.y % MAP_GRID_SIZE)).toBe(0);
      expect(table.seats).toBe(10);
      expect(table.seatingUse).toBe("adult");
    }
  });

  it("spaces tables so chair rings never overlap", () => {
    const tables = generateTableRows(input);

    expect(findOverlappingObjectIds(tables).size).toBe(0);
  });

  it("returns nothing for a zero count", () => {
    expect(generateTableRows({ ...input, count: 0 })).toEqual([]);
  });
});
