/**
 * Where the chairs go around a table.
 *
 * Placements are returned in the table's own coordinate space - the origin is
 * the table's top-left corner, before any rotation. Callers render them inside
 * the element that already carries the table's `rotate()`, so rotation, resize
 * and zoom all come for free and there is no second transform to keep in step.
 *
 * This module deliberately knows nothing about `ShapeType` or any feature
 * module: the Hall Map editor and the Dining Manager both draw the same floor
 * plan, and neither should have to import from the other to do it.
 */

import { z } from "zod";

export type SeatingSides = 1 | 2 | 4;

/**
 * Optional on purpose, in two places that both matter.
 *
 * Hall map presets and dining plans saved before seating existed omit this
 * field, and both are validated on save - making it required would reject every
 * one of those layouts. Zod also strips unknown keys, so any schema that stores
 * a table has to list this explicitly or a user's one- or four-side choice is
 * quietly lost on the next save.
 */
export const seatingSidesSchema = z
  .union([z.literal(1), z.literal(2), z.literal(4)])
  .optional();

export type SeatPlacement = {
  /** Centre of the chair, in table-local coordinates. */
  x: number;
  y: number;
  /** Degrees. 0 points the chair's back away from the table's top edge. */
  angle: number;
};

export type SeatingShape = {
  round: boolean;
  width: number;
  height: number;
  seats: number;
  /** Ignored for round tables, which always seat the full perimeter. */
  sides?: SeatingSides;
};

export const SEAT_WIDTH = 15;
export const SEAT_DEPTH = 11;
export const SEAT_GAP = 5;

/** How far a chair's centre sits beyond the table edge. */
const SEAT_OFFSET = SEAT_GAP + SEAT_DEPTH / 2;

const ROUND_SHAPE_TYPES = new Set(["round-table", "kids-table", "circle"]);

/**
 * Shapes drawn as circles, which seat their whole perimeter.
 *
 * Takes a plain string rather than `ShapeType` so the Dining Manager - which
 * stores the shape as `mapType: string` - can ask the same question without
 * importing from the Hall Map feature.
 */
export function isRoundSeatingShape(type: string | undefined) {
  return type !== undefined && ROUND_SHAPE_TYPES.has(type);
}

const SINGLE_SIDED_SHAPE_TYPES = new Set(["head-table", "buffet", "drinks"]);

/**
 * Which edges a rectangular shape seats when nothing explicit is stored. Head
 * tables, buffets and drinks stations are served from one side; everything else
 * is banquet-seated down both long edges.
 */
export function getDefaultSeatingSides(
  type: string | undefined
): SeatingSides {
  return type !== undefined && SINGLE_SIDED_SHAPE_TYPES.has(type) ? 1 : 2;
}

type Edge = "top" | "bottom" | "left" | "right";

const EDGE_ANGLE: Record<Edge, number> = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270
};

function usableSeatCount(seats: number) {
  return Number.isFinite(seats) ? Math.max(0, Math.floor(seats)) : 0;
}

function roundSeatPlacements(
  width: number,
  height: number,
  seats: number
): SeatPlacement[] {
  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = width / 2 + SEAT_OFFSET;
  const radiusY = height / 2 + SEAT_OFFSET;
  const placements: SeatPlacement[] = [];

  for (let index = 0; index < seats; index += 1) {
    // Start at twelve o'clock so a table's first chair is predictable.
    const theta = (index / seats) * Math.PI * 2 - Math.PI / 2;

    placements.push({
      x: centerX + radiusX * Math.cos(theta),
      y: centerY + radiusY * Math.sin(theta),
      // Turn the chair to face the centre of the table.
      angle: (theta * 180) / Math.PI + 90
    });
  }

  return placements;
}

function edgesForSides(
  sides: SeatingSides,
  width: number,
  height: number
): Edge[] {
  if (sides === 1) return ["top"];
  if (sides === 4) return ["top", "bottom", "left", "right"];

  // Two-sided tables seat their long edges, which is how banquet rounds of
  // rectangles are laid out.
  return width >= height ? ["top", "bottom"] : ["left", "right"];
}

/**
 * Split seats across edges in proportion to edge length, largest fractional
 * remainder first. Equal-length edges therefore hand any odd seat to the
 * earliest edge in the list, so seven across two sides is four then three.
 */
function seatsPerEdge(edges: Edge[], lengths: number[], seats: number) {
  const total = lengths.reduce((sum, length) => sum + length, 0);

  if (total <= 0) {
    return edges.map((_, index) => (index === 0 ? seats : 0));
  }

  const exact = lengths.map((length) => (seats * length) / total);
  const counts = exact.map((value) => Math.floor(value));
  const ranked = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  let placed = counts.reduce((sum, count) => sum + count, 0);

  for (let step = 0; placed < seats; step += 1, placed += 1) {
    counts[ranked[step % ranked.length].index] += 1;
  }

  return counts;
}

function rectangularSeatPlacements(
  width: number,
  height: number,
  seats: number,
  sides: SeatingSides
): SeatPlacement[] {
  const edges = edgesForSides(sides, width, height);
  const lengths = edges.map((edge) =>
    edge === "top" || edge === "bottom" ? width : height
  );
  const counts = seatsPerEdge(edges, lengths, seats);
  const placements: SeatPlacement[] = [];

  edges.forEach((edge, edgeIndex) => {
    const count = counts[edgeIndex];

    for (let index = 0; index < count; index += 1) {
      // The half-step keeps an equal margin at both ends of the edge rather
      // than pinning the first and last chair to the corners.
      const along = (index + 0.5) / count;

      if (edge === "top") {
        placements.push({ x: width * along, y: -SEAT_OFFSET, angle: EDGE_ANGLE.top });
      } else if (edge === "bottom") {
        placements.push({
          x: width * along,
          y: height + SEAT_OFFSET,
          angle: EDGE_ANGLE.bottom
        });
      } else if (edge === "left") {
        placements.push({
          x: -SEAT_OFFSET,
          y: height * along,
          angle: EDGE_ANGLE.left
        });
      } else {
        placements.push({
          x: width + SEAT_OFFSET,
          y: height * along,
          angle: EDGE_ANGLE.right
        });
      }
    }
  });

  return placements;
}

export function getSeatPlacements(shape: SeatingShape): SeatPlacement[] {
  const seats = usableSeatCount(shape.seats);

  if (
    seats === 0 ||
    !Number.isFinite(shape.width) ||
    !Number.isFinite(shape.height) ||
    shape.width <= 0 ||
    shape.height <= 0
  ) {
    return [];
  }

  return shape.round
    ? roundSeatPlacements(shape.width, shape.height, seats)
    : rectangularSeatPlacements(
        shape.width,
        shape.height,
        seats,
        shape.sides ?? 2
      );
}

/**
 * How far the chairs reach beyond the table on every side. Callers that need a
 * footprint including seating - collision checks, fit-to-content - can grow the
 * table box by this much.
 */
export const SEAT_FOOTPRINT_OVERHANG = SEAT_OFFSET + SEAT_DEPTH / 2;
