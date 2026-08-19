import {
  SEAT_FOOTPRINT_OVERHANG,
  getDefaultSeatingSides,
  getSeatPlacements,
  type SeatPlacement,
  type SeatingSides
} from "@/lib/hall-map/seating";

export { getDefaultSeatingSides };
export type { SeatPlacement, SeatingSides };

export type ShapeType =
  | "round-table"
  | "rect-table"
  | "kids-table"
  | "box"
  | "circle"
  | "divider"
  | "buffet"
  | "head-table"
  | "drinks";

export type SeatingUse = "none" | "adult" | "kids" | "head";

export type MapObject = {
  id: string;
  type: ShapeType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  seats: number;
  seatingUse: SeatingUse;
  /**
   * How many edges of a rectangular table are seated. Optional because presets
   * saved before seating existed have no value, and round tables ignore it -
   * they always seat the full perimeter.
   */
  seatingSides?: SeatingSides;
};

export type SavedHallMap = {
  id: string;
  name: string;
  objects: MapObject[];
  hallId: string;
  hall?: { id: string; name: string };
  /** Storage path of the hall's floor-plan image, drawn under the shapes. */
  backgroundPath?: string | null;
};

export type ShapeLibraryItem = {
  id: string;
  name: string;
  shapeType: "round-table" | "rect-table";
  width: number;
  height: number;
  seats: number;
};

export type HallMapsResponse = {
  halls: Array<{ id: string; name: string; capacity: number | null }>;
  presets: SavedHallMap[];
  shapeLibrary: ShapeLibraryItem[];
};

export type SaveHallMapInput = {
  id?: string;
  name: string;
  hallId: string;
  objects: MapObject[];
  backgroundPath?: string | null;
};

export const HALL_MAP_STORAGE_KEY = "event-core-hall-room-maps";

export const initialHallMaps: SavedHallMap[] = [];

export const DESIGN_MAP_WIDTH = 800;
// The editor board is intentionally taller than the original 520-unit canvas.
// Keeping the logical map at 520 left a visible internal boundary and made the
// gridded area below it impossible to use. The 640-unit height matches the full
// desktop board while preserving its existing outer dimensions. Together with
// the 800-unit width, the usable surface follows the full board instead of the
// former 760x520 inset.
export const DESIGN_MAP_HEIGHT = 640;
export const MAP_WORLD_SIZE = 20_000;
export const MAP_WORLD_ORIGIN = MAP_WORLD_SIZE / 2;
export const MAP_VIEWPORT_PADDING = 24;

/**
 * Tables are drawn at a minimum diameter so their label fits. The view and every
 * bounds calculation have to agree on this: while the renderer applied the floor
 * and the clamp did not, a table stored below this size was held inside a box
 * smaller than the one on screen and could be pushed past the map edge.
 */
export const MIN_TABLE_SIZE = 68;
export type ResizeEdge = "north" | "east" | "south" | "west";

export function isTableShape(type: ShapeType) {
  return type === "round-table" || type === "kids-table" || type === "circle";
}

type ObjectBox = Pick<MapObject, "type" | "width" | "height">;

/** The size the object actually occupies on screen, before rotation. */
export function getRenderedObjectSize(object: ObjectBox) {
  const table = isTableShape(object.type);

  return {
    width: table ? Math.max(object.width, MIN_TABLE_SIZE) : object.width,
    height: table ? Math.max(object.height, MIN_TABLE_SIZE) : object.height
  };
}

/**
 * Axis-aligned bounding box once `rotate()` is applied. Objects are rotated
 * about their centre (the default transform-origin), so a rotated shape can
 * extend well beyond its unrotated box - a 250x12 divider turned 90deg reaches
 * ~119px above and below it.
 */
export function getRotatedBounds(
  object: ObjectBox & Pick<MapObject, "rotation">
) {
  const { width, height } = getRenderedObjectSize(object);
  const radians = (object.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos
  };
}

/** Chair positions for one object, in that object's own coordinate space. */
export function getObjectSeatPlacements(object: MapObject): SeatPlacement[] {
  const { width, height } = getRenderedObjectSize(object);

  return getSeatPlacements({
    round: isTableShape(object.type),
    width,
    height,
    seats: object.seats,
    sides: object.seatingSides ?? getDefaultSeatingSides(object.type)
  });
}

export function resizeMapObjectFromEdge(
  object: MapObject,
  edge: ResizeEdge,
  pointerDeltaX: number,
  pointerDeltaY: number
): MapObject {
  const radians = (object.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const localDeltaX = pointerDeltaX * cos + pointerDeltaY * sin;
  const localDeltaY = -pointerDeltaX * sin + pointerDeltaY * cos;
  const horizontalDirection = edge === "east" ? 1 : edge === "west" ? -1 : 0;
  const verticalDirection = edge === "south" ? 1 : edge === "north" ? -1 : 0;
  const minimumWidth = isTableShape(object.type) ? MIN_TABLE_SIZE : 10;
  const minimumHeight = isTableShape(object.type) ? MIN_TABLE_SIZE : 10;
  const width = horizontalDirection
    ? Math.min(
        5_000,
        Math.max(minimumWidth, object.width + horizontalDirection * localDeltaX)
      )
    : object.width;
  const height = verticalDirection
    ? Math.min(
        5_000,
        Math.max(minimumHeight, object.height + verticalDirection * localDeltaY)
      )
    : object.height;
  const localCenterShiftX = (horizontalDirection * (width - object.width)) / 2;
  const localCenterShiftY = (verticalDirection * (height - object.height)) / 2;
  const centerShiftX = localCenterShiftX * cos - localCenterShiftY * sin;
  const centerShiftY = localCenterShiftX * sin + localCenterShiftY * cos;
  const originalCenterX = object.x + object.width / 2;
  const originalCenterY = object.y + object.height / 2;

  return {
    ...object,
    width: Math.round(width),
    height: Math.round(height),
    x: Math.round(originalCenterX + centerShiftX - width / 2),
    y: Math.round(originalCenterY + centerShiftY - height / 2)
  };
}

export function getRotationFromPointer(
  startRotation: number,
  startPointerAngle: number,
  currentPointerAngle: number,
  snapToIncrement = false
) {
  const rawRotation =
    ((startRotation + currentPointerAngle - startPointerAngle) % 360 + 360) %
    360;
  const rotation = snapToIncrement
    ? Math.round(rawRotation / 15) * 15
    : Math.round(rawRotation);

  return rotation === 360 ? 0 : rotation;
}

/**
 * Keep both the stored box and the rotated bounding box inside the map.
 *
 * `inset` is how far the rotated box overhangs the stored box on one side. Only
 * a positive overhang matters: when rotation makes the shape narrower on an
 * axis the stored box is the binding constraint, and the stored coordinates
 * must stay at or above zero because the API schema rejects negatives.
 */
function clampAxis(
  value: number,
  renderedSize: number,
  rotatedSize: number,
  mapSize: number
) {
  const inset = Math.max(0, (rotatedSize - renderedSize) / 2);
  const min = inset;
  const max = mapSize - renderedSize - inset;

  if (min > max) {
    // Larger than the map on this axis: there is no valid range, so settle on a
    // stable centred position instead of an inverted one.
    return Math.max(0, (mapSize - renderedSize) / 2);
  }

  return Math.min(Math.max(value, min), max);
}

export function clampObjectToMap(
  object: ObjectBox & Pick<MapObject, "rotation">,
  x: number,
  y: number,
  mapWidth = DESIGN_MAP_WIDTH,
  mapHeight = DESIGN_MAP_HEIGHT
) {
  const rendered = getRenderedObjectSize(object);
  const rotated = getRotatedBounds(object);

  return {
    x: Math.round(
      clampAxis(x, rendered.width, rotated.width, mapWidth)
    ),
    y: Math.round(
      clampAxis(y, rendered.height, rotated.height, mapHeight)
    )
  };
}

/**
 * Largest scale that fits the whole map in the available space.
 *
 * Fitting on width alone left the map clipped vertically, and capping at 1 left
 * it as a small centred strip inside a much wider gridded panel - which is what
 * made objects look like they stopped short of the workspace edge.
 */
export function getMapFitScale(
  availableWidth: number,
  availableHeight: number
) {
  const scale = Math.min(
    availableWidth / DESIGN_MAP_WIDTH,
    availableHeight / DESIGN_MAP_HEIGHT
  );

  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function clampViewportPosition(value: number, max: number) {
  return Math.min(Math.max(0, value), Math.max(0, max));
}

export function getMapObjectBounds(objects: MapObject[]) {
  if (objects.length === 0) {
    return null;
  }

  return objects.reduce(
    (bounds, object) => ({
      minX: Math.min(bounds.minX, object.x),
      minY: Math.min(bounds.minY, object.y),
      maxX: Math.max(bounds.maxX, object.x + object.width),
      maxY: Math.max(bounds.maxY, object.y + object.height)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
}

/** The visual grid the board draws; snapping rounds to the same pitch. */
export const MAP_GRID_SIZE = 20;

export function snapToGrid(value: number, enabled = true) {
  return enabled ? Math.round(value / MAP_GRID_SIZE) * MAP_GRID_SIZE : value;
}

/**
 * The scale the default shapes were drawn at: a 96px rect table is the
 * standard 8ft banquet table, so 12px to the foot. Presentation only - nothing
 * stored changes units.
 */
export const PIXELS_PER_FOOT = 12;

export function formatFeet(pixels: number) {
  const feet = pixels / PIXELS_PER_FOOT;
  const rounded = Math.round(feet * 10) / 10;

  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} ft`;
}

export type SeatSummary = {
  total: number;
  adult: number;
  kids: number;
  head: number;
};

/**
 * Seats a layout actually offers, bucketed the way the Dining Manager splits
 * them. `none` shapes (buffets, boxes, dividers) contribute nothing even if a
 * seat count was typed on them.
 */
export function summarizeSeats(objects: MapObject[]): SeatSummary {
  return objects.reduce<SeatSummary>(
    (summary, object) => {
      if (object.seatingUse === "none" || object.seats <= 0) return summary;

      return {
        total: summary.total + object.seats,
        adult: summary.adult + (object.seatingUse === "adult" ? object.seats : 0),
        kids: summary.kids + (object.seatingUse === "kids" ? object.seats : 0),
        head: summary.head + (object.seatingUse === "head" ? object.seats : 0)
      };
    },
    { total: 0, adult: 0, kids: 0, head: 0 }
  );
}

/**
 * The axis-aligned box a shape truly occupies: rendered size, rotated, plus
 * the chair ring when the shape seats anyone. This is what overlap means to a
 * guest - two tables whose chairs touch back-to-back are overlapping even if
 * the table tops are apart.
 */
export function getObjectFootprint(object: MapObject) {
  const rendered = getRenderedObjectSize(object);
  const pad = object.seats > 0 ? SEAT_FOOTPRINT_OVERHANG : 0;
  const width = rendered.width + pad * 2;
  const height = rendered.height + pad * 2;
  const radians = (object.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const rotatedWidth = width * cos + height * sin;
  const rotatedHeight = width * sin + height * cos;
  const centerX = object.x + rendered.width / 2;
  const centerY = object.y + rendered.height / 2;

  return {
    minX: centerX - rotatedWidth / 2,
    minY: centerY - rotatedHeight / 2,
    maxX: centerX + rotatedWidth / 2,
    maxY: centerY + rotatedHeight / 2
  };
}

export type WorldRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** A rectangle from two corners, whichever direction it was dragged. */
export function normalizeWorldRect(
  from: { x: number; y: number },
  to: { x: number; y: number }
): WorldRect {
  return {
    minX: Math.min(from.x, to.x),
    minY: Math.min(from.y, to.y),
    maxX: Math.max(from.x, to.x),
    maxY: Math.max(from.y, to.y)
  };
}

/**
 * Ids of every object the marquee touches.
 *
 * Touch, not full containment: a floor plan is dense, and requiring the box to
 * swallow a table whole - chairs included - means dragging across half the room
 * to pick up two tables. Every tool a planner already knows (Figma, Photoshop,
 * Illustrator) selects on intersection. Compares against `getObjectFootprint`,
 * so a rotated divider is caught by the space it really occupies rather than
 * its unrotated box, and a table's chairs count as part of it.
 */
export function findObjectIdsInRegion(objects: MapObject[], region: WorldRect) {
  return objects
    .filter((object) => {
      const box = getObjectFootprint(object);

      return (
        box.minX < region.maxX &&
        region.minX < box.maxX &&
        box.minY < region.maxY &&
        region.minY < box.maxY
      );
    })
    .map((object) => object.id);
}

/** Ids of every object whose footprint intersects another's. */
export function findOverlappingObjectIds(objects: MapObject[]) {
  const overlapping = new Set<string>();
  const footprints = objects.map((object) => ({
    id: object.id,
    box: getObjectFootprint(object)
  }));

  for (let a = 0; a < footprints.length; a += 1) {
    for (let b = a + 1; b < footprints.length; b += 1) {
      const first = footprints[a].box;
      const second = footprints[b].box;
      const intersects =
        first.minX < second.maxX &&
        second.minX < first.maxX &&
        first.minY < second.maxY &&
        second.minY < first.maxY;

      if (intersects) {
        overlapping.add(footprints[a].id);
        overlapping.add(footprints[b].id);
      }
    }
  }

  return overlapping;
}

export const defaultShapeDimensions: Record<
  ShapeType,
  { width: number; height: number }
> = {
  "round-table": { width: 68, height: 68 },
  "rect-table": { width: 96, height: 48 },
  "kids-table": { width: 68, height: 68 },
  box: { width: 80, height: 54 },
  circle: { width: 68, height: 68 },
  divider: { width: 250, height: 12 },
  buffet: { width: 100, height: 38 },
  "head-table": { width: 112, height: 48 },
  drinks: { width: 82, height: 38 }
};

export type TableRowsInput = {
  type: "round-table" | "rect-table";
  count: number;
  perRow: number;
  seats: number;
  /** World-space point (map coordinates) the block of rows is centred on. */
  centerX: number;
  centerY: number;
  /** Numbering starts here so bulk-added tables continue an existing layout. */
  startNumber: number;
};

/**
 * Lays `count` identical tables out in rows around a centre point, spaced so
 * neighbouring chair rings never touch, and snapped to the grid so the block
 * lands tidy. Pure so it can be tested without a canvas.
 */
export function generateTableRows(input: TableRowsInput): MapObject[] {
  const count = Math.max(0, Math.floor(input.count));
  const perRow = Math.max(1, Math.floor(input.perRow));

  if (count === 0) return [];

  const dimensions = defaultShapeDimensions[input.type];
  const rendered = getRenderedObjectSize({ ...dimensions, type: input.type });
  const aisle = 24;
  const cellWidth = rendered.width + SEAT_FOOTPRINT_OVERHANG * 2 + aisle;
  const cellHeight = rendered.height + SEAT_FOOTPRINT_OVERHANG * 2 + aisle;
  const columns = Math.min(perRow, count);
  const rows = Math.ceil(count / perRow);
  const originX = input.centerX - (columns * cellWidth) / 2;
  const originY = input.centerY - (rows * cellHeight) / 2;
  const label = input.type === "round-table" ? "Round Table" : "Rect Table";

  return Array.from({ length: count }, (_, index) => {
    const column = index % perRow;
    const row = Math.floor(index / perRow);

    return {
      id: `${input.type}-${crypto.randomUUID()}`,
      type: input.type,
      name: `${label} ${input.startNumber + index}`,
      x: snapToGrid(
        originX + column * cellWidth + (cellWidth - rendered.width) / 2
      ),
      y: snapToGrid(
        originY + row * cellHeight + (cellHeight - rendered.height) / 2
      ),
      width: dimensions.width,
      height: dimensions.height,
      rotation: 0,
      seats: Math.max(0, Math.floor(input.seats)),
      seatingUse: "adult"
    };
  });
}

export const shapeOptions: Array<{
  type: ShapeType;
  label: string;
}> = [
  { type: "round-table", label: "Round table" },
  { type: "rect-table", label: "Rect table" },
  { type: "kids-table", label: "Kids table" },
  { type: "head-table", label: "Head table" },
  { type: "buffet", label: "Buffet" },
  { type: "drinks", label: "Drinks" },
  { type: "box", label: "Box" },
  { type: "circle", label: "Circle" }
];
