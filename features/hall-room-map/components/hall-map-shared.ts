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

export type HallMapsResponse = {
  halls: Array<{ id: string; name: string; capacity: number | null }>;
  presets: SavedHallMap[];
};

export type SaveHallMapInput = {
  id?: string;
  name: string;
  hallId: string;
  objects: MapObject[];
};

export const HALL_MAP_STORAGE_KEY = "event-core-hall-room-maps";

export const initialHallMaps: SavedHallMap[] = [];

export const DESIGN_MAP_WIDTH = 760;
export const DESIGN_MAP_HEIGHT = 520;
export const MAP_VIEWPORT_PADDING = 24;

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
