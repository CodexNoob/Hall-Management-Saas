import { describe, expect, it } from "vitest";

import {
  DESIGN_MAP_HEIGHT,
  DESIGN_MAP_WIDTH,
  MIN_TABLE_SIZE,
  clampObjectToMap,
  findObjectIdsInRegion,
  getMapFitScale,
  normalizeWorldRect,
  getRenderedObjectSize,
  getRotationFromPointer,
  getRotatedBounds,
  resizeMapObjectFromEdge,
  type MapObject
} from "@/features/hall-room-map/components/hall-map-shared";
import { mapObjectSchema } from "@/features/hall-room-map/validations/hall-map.schema";

/**
 * Objects used to stop well short of the visible workspace edge, and rotated or
 * shrunken ones could escape it. These cover the geometry that decides both.
 */

function object(overrides: Partial<MapObject> = {}): MapObject {
  return {
    id: "object-1",
    type: "box",
    name: "Box",
    x: 0,
    y: 0,
    width: 80,
    height: 54,
    rotation: 0,
    seats: 0,
    seatingUse: "none",
    ...overrides
  };
}

describe("hall map object bounds", () => {
  it("lets an unrotated object reach every edge of the map", () => {
    const box = object();

    expect(clampObjectToMap(box, -500, -500)).toEqual({ x: 0, y: 0 });
    expect(clampObjectToMap(box, 5_000, 5_000)).toEqual({
      x: DESIGN_MAP_WIDTH - box.width,
      y: DESIGN_MAP_HEIGHT - box.height
    });
  });

  it("leaves a position that is already inside untouched", () => {
    expect(clampObjectToMap(object(), 120, 200)).toEqual({ x: 120, y: 200 });
  });

  it("clamps a small table by the size it is actually drawn at", () => {
    // Tables render at MIN_TABLE_SIZE even when stored smaller. Clamping by the
    // stored width let the drawn circle hang over the edge.
    const table = object({ type: "round-table", width: 20, height: 20 });

    expect(getRenderedObjectSize(table)).toEqual({
      width: MIN_TABLE_SIZE,
      height: MIN_TABLE_SIZE
    });
    expect(clampObjectToMap(table, 5_000, 5_000)).toEqual({
      x: DESIGN_MAP_WIDTH - MIN_TABLE_SIZE,
      y: DESIGN_MAP_HEIGHT - MIN_TABLE_SIZE
    });
  });

  it("keeps a rotated divider's drawn bounding box inside the map", () => {
    const divider = object({
      type: "divider",
      width: 250,
      height: 12,
      rotation: 90
    });
    const bounds = getRotatedBounds(divider);

    expect(Math.round(bounds.width)).toBe(12);
    expect(Math.round(bounds.height)).toBe(250);

    const top = clampObjectToMap(divider, 300, -500);
    const bottom = clampObjectToMap(divider, 300, 5_000);

    // Stored coordinates stay non-negative because the API schema rejects
    // negatives, while the rotated box lands exactly on each edge.
    expect(top.y).toBeGreaterThanOrEqual(0);
    expect(top.y + divider.height / 2 - bounds.height / 2).toBeCloseTo(0, 0);
    expect(bottom.y + divider.height / 2 + bounds.height / 2).toBeCloseTo(
      DESIGN_MAP_HEIGHT,
      0
    );
  });

  it("still allows a rotated object to reach the edges of its narrow axis", () => {
    const divider = object({
      type: "divider",
      width: 250,
      height: 12,
      rotation: 90
    });

    expect(clampObjectToMap(divider, -500, 200).x).toBe(0);
    expect(clampObjectToMap(divider, 5_000, 200).x).toBe(
      DESIGN_MAP_WIDTH - divider.width
    );
  });

  it("treats a 180 degree rotation the same as no rotation", () => {
    const flipped = object({ rotation: 180 });

    expect(clampObjectToMap(flipped, 5_000, 5_000)).toEqual({
      x: DESIGN_MAP_WIDTH - flipped.width,
      y: DESIGN_MAP_HEIGHT - flipped.height
    });
  });

  it("centres an object that is larger than the map instead of inverting", () => {
    const huge = object({ width: 2_000, height: 1_200 });
    const clamped = clampObjectToMap(huge, 5_000, -5_000);

    expect(Number.isFinite(clamped.x)).toBe(true);
    expect(Number.isFinite(clamped.y)).toBe(true);
    expect(clamped.x).toBeGreaterThanOrEqual(0);
    expect(clamped.y).toBeGreaterThanOrEqual(0);
    // Stable: the same oversized object resolves identically wherever it is
    // dragged, rather than jittering between clamp attempts.
    expect(clampObjectToMap(huge, -5_000, 5_000)).toEqual(clamped);
  });
});

describe("hall map fit scale", () => {
  it("fits the tighter axis so the map is never clipped", () => {
    // Wide but short: height is the binding constraint.
    expect(getMapFitScale(DESIGN_MAP_WIDTH * 4, DESIGN_MAP_HEIGHT)).toBe(1);
    expect(getMapFitScale(DESIGN_MAP_WIDTH, DESIGN_MAP_HEIGHT * 4)).toBe(1);
  });

  it("scales above 1 so the map fills a large panel", () => {
    // The previous Math.min(1, ...) cap left the map as a small centred strip,
    // which is what made objects look like they stopped short of the edge.
    expect(getMapFitScale(DESIGN_MAP_WIDTH * 2, DESIGN_MAP_HEIGHT * 2)).toBe(2);
  });

  it("scales below 1 for a small panel", () => {
    expect(getMapFitScale(DESIGN_MAP_WIDTH / 2, DESIGN_MAP_HEIGHT / 2)).toBe(
      0.5
    );
  });

  it("falls back to 1 before the viewport has been measured", () => {
    expect(getMapFitScale(0, 0)).toBe(1);
    expect(getMapFitScale(Number.NaN, Number.NaN)).toBe(1);
  });
});

describe("infinite hall map coordinates", () => {
  it("accepts saved objects on either side of the world origin", () => {
    expect(
      mapObjectSchema.parse(object({ x: -450, y: -275 }))
    ).toMatchObject({ x: -450, y: -275 });
    expect(
      mapObjectSchema.parse(object({ x: 4_500, y: 6_200 }))
    ).toMatchObject({ x: 4_500, y: 6_200 });
  });
});

describe("hall map edge resizing", () => {
  it("keeps the opposite edge fixed while resizing", () => {
    const original = object({ x: 100, y: 80, width: 100, height: 60 });
    const resized = resizeMapObjectFromEdge(
      original,
      "west",
      -40,
      -20
    );

    expect(resized).toMatchObject({ x: 60, y: 80, width: 140, height: 60 });
    expect(resized.x + resized.width).toBe(original.x + original.width);
  });

  it("resizes in the rotated object's local axes", () => {
    const resized = resizeMapObjectFromEdge(
      object({ width: 100, height: 50, rotation: 90 }),
      "east",
      0,
      40
    );

    expect(resized.width).toBe(140);
    expect(resized.height).toBe(50);
    expect(Number.isFinite(resized.x)).toBe(true);
    expect(Number.isFinite(resized.y)).toBe(true);
  });

  it("does not shrink a shape below its minimum size", () => {
    const resized = resizeMapObjectFromEdge(
      object({ width: 20, height: 20 }),
      "east",
      -1_000,
      -1_000
    );

    expect(resized.width).toBe(10);
    expect(resized.height).toBe(20);
  });
});

describe("hall map pointer rotation", () => {
  it("rotates by the pointer's angular movement", () => {
    expect(getRotationFromPointer(20, -90, 0)).toBe(110);
  });

  it("wraps rotations into the zero-to-359 range", () => {
    expect(getRotationFromPointer(350, 0, 30)).toBe(20);
    expect(getRotationFromPointer(10, 0, -30)).toBe(340);
  });

  it("snaps to 15-degree increments while Shift is held", () => {
    expect(getRotationFromPointer(0, 0, 38, true)).toBe(45);
  });
});

describe("marquee region selection", () => {
  it("builds the same rectangle whichever way it was dragged", () => {
    const downRight = normalizeWorldRect({ x: 10, y: 20 }, { x: 110, y: 220 });
    const upLeft = normalizeWorldRect({ x: 110, y: 220 }, { x: 10, y: 20 });

    expect(downRight).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 220 });
    expect(upLeft).toEqual(downRight);
  });

  it("picks up only the shapes the box touches", () => {
    const inside = object({ id: "inside", x: 100, y: 100 });
    const outside = object({ id: "outside", x: 900, y: 900 });

    expect(
      findObjectIdsInRegion(
        [inside, outside],
        { minX: 50, minY: 50, maxX: 400, maxY: 400 }
      )
    ).toEqual(["inside"]);
  });

  it("selects a shape the box only clips", () => {
    // Touch, not containment: requiring the box to swallow a table whole means
    // dragging across half the room to collect two of them.
    const clipped = object({ id: "clipped", x: 100, y: 100 });

    expect(
      findObjectIdsInRegion([clipped], {
        minX: 0,
        minY: 0,
        maxX: 110,
        maxY: 110
      })
    ).toEqual(["clipped"]);
  });

  it("catches a rotated shape by the space it really occupies", () => {
    // A 250x12 divider turned 90deg is a tall bar. A box beside its unrotated
    // footprint still crosses it, and must select it.
    const divider = object({
      id: "divider",
      type: "divider",
      width: 250,
      height: 12,
      rotation: 90,
      x: 0,
      y: 0
    });
    const bounds = getRotatedBounds(divider);
    expect(bounds.height).toBeGreaterThan(200);

    expect(
      findObjectIdsInRegion([divider], {
        minX: 100,
        minY: 100,
        maxX: 140,
        maxY: 140
      })
    ).toEqual(["divider"]);
  });

  it("does not select a shape the box merely approaches", () => {
    const box = object({ id: "far", x: 0, y: 0, width: 80, height: 54 });

    expect(
      findObjectIdsInRegion([box], {
        minX: 200,
        minY: 200,
        maxX: 300,
        maxY: 300
      })
    ).toEqual([]);
  });

  it("returns nothing for an empty board or an empty box", () => {
    expect(
      findObjectIdsInRegion([], { minX: 0, minY: 0, maxX: 500, maxY: 500 })
    ).toEqual([]);
    // A click without a drag collapses to zero area and must select nothing.
    expect(
      findObjectIdsInRegion([object({ id: "any", x: 300, y: 300 })], {
        minX: 10,
        minY: 10,
        maxX: 10,
        maxY: 10
      })
    ).toEqual([]);
  });

  it("returns every shape it spans, in board order", () => {
    const shapes = [
      object({ id: "a", x: 0, y: 0 }),
      object({ id: "b", x: 200, y: 0 }),
      object({ id: "c", x: 400, y: 0 })
    ];

    expect(
      findObjectIdsInRegion(shapes, {
        minX: -50,
        minY: -50,
        maxX: 300,
        maxY: 300
      })
    ).toEqual(["a", "b"]);
  });
});
