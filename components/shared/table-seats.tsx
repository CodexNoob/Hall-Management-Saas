"use client";

import {
  SEAT_DEPTH,
  SEAT_FOOTPRINT_OVERHANG,
  SEAT_WIDTH,
  getSeatPlacements,
  type SeatingShape
} from "@/lib/hall-map/seating";

/**
 * The chairs drawn around a table.
 *
 * Render this inside the element that already carries the table's `rotate()`:
 * placements are in the table's own coordinate space, so rotation, resize and
 * zoom are inherited rather than recomputed.
 *
 * The Hall Map editor and the Dining Manager both draw the same floor plan, so
 * they share this rather than keeping two chair renderers in step.
 *
 * Two details matter for the host element:
 *
 * - it must not clip overflow, since chairs sit outside the table box;
 * - the chairs are decoration, never a hit target, so they take no pointer
 *   events and sit behind the table's label.
 */
export function TableSeats({
  height,
  round,
  seats,
  sides,
  width
}: SeatingShape) {
  const placements = getSeatPlacements({ height, round, seats, sides, width });

  if (placements.length === 0) {
    return null;
  }

  const pad = SEAT_FOOTPRINT_OVERHANG;
  const boxWidth = width + pad * 2;
  const boxHeight = height + pad * 2;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute -z-10"
      data-table-seats={placements.length}
      style={{ height: boxHeight, left: -pad, top: -pad, width: boxWidth }}
      viewBox={`${-pad} ${-pad} ${boxWidth} ${boxHeight}`}
    >
      {placements.map((seat, index) => (
        <rect
          fill="#ffffff"
          height={SEAT_DEPTH}
          key={index}
          rx={2.5}
          stroke="#526c86"
          strokeWidth={1}
          transform={`translate(${seat.x.toFixed(2)} ${seat.y.toFixed(2)}) rotate(${seat.angle.toFixed(2)})`}
          width={SEAT_WIDTH}
          x={-SEAT_WIDTH / 2}
          y={-SEAT_DEPTH / 2}
        />
      ))}
    </svg>
  );
}
