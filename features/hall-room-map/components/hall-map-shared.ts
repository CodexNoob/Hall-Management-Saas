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
};

export type SavedHallMap = {
  id: string;
  name: string;
  objects: MapObject[];
  hallId: string;
  hall?: { id: string; name: string };
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
