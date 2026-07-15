"use client";

import { useState, type ReactNode } from "react";
import { DashboardTopbar } from "@/components/topbars/dashboard-topbar";

type ShapeType =
  | "round-table"
  | "rect-table"
  | "kids-table"
  | "box"
  | "circle"
  | "divider"
  | "buffet"
  | "head-table"
  | "drinks";

type SeatingUse = "none" | "adult" | "kids" | "head";

type MapObject = {
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

const initialObjects: MapObject[] = [
  ...Array.from({ length: 8 }, (_, index): MapObject => ({
    id: `table-${index + 1}`,
    type: "round-table",
    name: `Table ${index + 1}`,
    x: 70 + (index % 4) * 80,
    y: 50 + Math.floor(index / 4) * 90,
    width: 58,
    height: 48,
    rotation: 0,
    seats: 10,
    seatingUse: "adult",
  })),
  {
    id: "mechitza",
    type: "divider",
    name: "Mechitza",
    x: 78,
    y: 178,
    width: 310,
    height: 12,
    rotation: 0,
    seats: 0,
    seatingUse: "none",
  },
  {
    id: "buffet",
    type: "buffet",
    name: "Buffet",
    x: 52,
    y: 218,
    width: 96,
    height: 30,
    rotation: 0,
    seats: 0,
    seatingUse: "none",
  },
  {
    id: "head-table",
    type: "head-table",
    name: "Head table",
    x: 187,
    y: 204,
    width: 108,
    height: 40,
    rotation: 0,
    seats: 12,
    seatingUse: "head",
  },
  {
    id: "drinks",
    type: "drinks",
    name: "Drinks",
    x: 366,
    y: 218,
    width: 66,
    height: 30,
    rotation: 0,
    seats: 0,
    seatingUse: "none",
  },
];

const shapeOptions: Array<{
  type: ShapeType;
  label: string;
}> = [
  { type: "round-table", label: "Round table" },
  { type: "rect-table", label: "Rect table" },
  { type: "kids-table", label: "Kids table" },
  { type: "box", label: "Box" },
  { type: "circle", label: "Circle" },
];

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-[#d8dde5] bg-white ${className}`}
    >
      {children}
    </section>
  );
}

function ShapePreview({ type }: { type: ShapeType }) {
  if (type === "divider") {
    return <span className="h-1 w-6 bg-[#36516b]" />;
  }

  const isCircle =
    type === "round-table" ||
    type === "kids-table" ||
    type === "circle";

  return (
    <span
      className={`h-5 w-5 border-2 border-[#36516b] bg-[#f7fbff] ${
        isCircle ? "rounded-full" : ""
      }`}
    />
  );
}

function ShapeButton({
  label,
  onClick,
  type,
}: {
  label: string;
  onClick: () => void;
  type: ShapeType;
}) {
  return (
    <button
      className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-[#d1dae5] bg-white px-2 text-[10px] font-black transition hover:border-[#1f4d73] hover:bg-[#eef6fc]"
      onClick={onClick}
      type="button"
    >
      <ShapePreview type={type} />
      {label}
    </button>
  );
}

function InspectorField({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      className="mb-1 block text-[10px] font-black uppercase tracking-[0.04em] text-[#59677c]"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}

function MapObjectView({
  object,
  selected,
  onSelect,
}: {
  object: MapObject;
  selected: boolean;
  onSelect: () => void;
}) {
  const isTable =
    object.type === "round-table" ||
    object.type === "kids-table" ||
    object.type === "circle";

  const isDashed =
    object.type === "buffet" || object.type === "drinks";

  const isDivider = object.type === "divider";

  return (
    <button
      aria-label={`Select ${object.name}`}
      className={`absolute flex flex-col items-center justify-center text-center text-[9px] font-black transition ${
        isTable ? "rounded-full" : "rounded-md"
      } ${
        isDashed
          ? "border border-dashed border-[#36516b] bg-[#f7fbff]"
          : isDivider
            ? "rounded-sm bg-[#344a60] text-white"
            : "border border-[#526c86] bg-white"
      } ${
        selected
          ? "z-10 ring-2 ring-[#1f5f91] ring-offset-2"
          : "hover:ring-2 hover:ring-[#8fbce3]"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      style={{
        height: object.height,
        left: object.x,
        top: object.y,
        transform: `rotate(${object.rotation}deg)`,
        width: object.width,
      }}
      type="button"
    >
      <span>{object.name}</span>

      {object.seats > 0 ? (
        <span className="text-[8px] font-medium">
          {object.seats} seats
        </span>
      ) : null}
    </button>
  );
}

export function HallRoomMapPage() {
  const [objects, setObjects] = useState<MapObject[]>(initialObjects);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    null,
  );
  const [preset, setPreset] = useState("Grand Hall");

  const selectedObject =
    objects.find((object) => object.id === selectedObjectId) ?? null;

  function updateSelectedObject(
    updates: Partial<Omit<MapObject, "id">>,
  ) {
    if (!selectedObjectId) {
      return;
    }

    setObjects((current) =>
      current.map((object) =>
        object.id === selectedObjectId
          ? { ...object, ...updates }
          : object,
      ),
    );
  }

  function addObject(type: ShapeType) {
    const id = `${type}-${crypto.randomUUID()}`;
    const tableShape =
      type === "round-table" || type === "kids-table";

    const newObject: MapObject = {
      id,
      type,
      name:
        type === "divider"
          ? "Mechitza divider"
          : type
              .split("-")
              .map(
                (part) =>
                  part.charAt(0).toUpperCase() + part.slice(1),
              )
              .join(" "),
      x: 180 + (objects.length % 4) * 25,
      y: 280 + (objects.length % 3) * 25,
      width: type === "divider" ? 250 : tableShape ? 60 : 80,
      height: type === "divider" ? 12 : tableShape ? 55 : 45,
      rotation: 0,
      seats: tableShape ? 10 : 0,
      seatingUse: type === "kids-table" ? "kids" : "none",
    };

    setObjects((current) => [...current, newObject]);
    setSelectedObjectId(id);
  }

  function duplicateSelectedObject() {
    if (!selectedObject) {
      return;
    }

    const duplicate: MapObject = {
      ...selectedObject,
      id: `${selectedObject.type}-${crypto.randomUUID()}`,
      name: `${selectedObject.name} copy`,
      x: selectedObject.x + 20,
      y: selectedObject.y + 20,
    };

    setObjects((current) => [...current, duplicate]);
    setSelectedObjectId(duplicate.id);
  }

  function deleteSelectedObject() {
    if (!selectedObjectId) {
      return;
    }

    setObjects((current) =>
      current.filter((object) => object.id !== selectedObjectId),
    );
    setSelectedObjectId(null);
  }

  function clearMap() {
    setObjects([]);
    setSelectedObjectId(null);
  }

  function loadPreset() {
    setObjects(initialObjects.map((object) => ({ ...object })));
    setSelectedObjectId(null);
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        showSearch={false}
        subtitle="Build default hall layouts with movable, resizable, rotatable objects."
        title="Hall Room Map"
        actionsSlot={
          <>
            <button
              className="h-11 whitespace-nowrap rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-bold text-[#17202a] shadow-sm transition hover:border-[#1f4d73]/60 hover:bg-[#eef4fa]"
              onClick={() => setSelectedObjectId(null)}
              type="button"
            >
              Clear selection
            </button>
            <button
              className="h-11 whitespace-nowrap rounded-xl bg-[#1f4d73] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#15344f]"
              type="button"
            >
              Save layout
            </button>
          </>
        }
      />

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3">
        <div className="mx-auto grid min-h-full min-w-0 max-w-[1800px] gap-3 xl:grid-cols-[220px_minmax(0,1fr)_250px]">
          <Panel>
            <header className="border-b border-[#d8dde5] px-3 py-2">
              <h2 className="text-sm font-black">Shape library</h2>
              <p className="mt-1 text-[10px] text-[#617086]">
                Click to add to the map.
              </p>
            </header>

            <div className="p-2">
              <div className="grid grid-cols-2 gap-2">
                {shapeOptions.map((shape) => (
                  <ShapeButton
                    key={shape.type}
                    label={shape.label}
                    onClick={() => addObject(shape.type)}
                    type={shape.type}
                  />
                ))}
              </div>

              <button
                className="mt-2 flex min-h-14 w-full flex-col items-center justify-center gap-2 rounded-lg border border-[#d1dae5] text-[10px] font-black hover:border-[#1f4d73] hover:bg-[#eef6fc]"
                onClick={() => addObject("divider")}
                type="button"
              >
                <ShapePreview type="divider" />
                Mechitza divider
              </button>

              <section className="mt-3 rounded-lg border border-[#d8dde5] p-2">
                <h3 className="text-[10px] font-black">
                  Hall presets
                </h3>

                <label
                  className="mt-2 block text-[9px] font-black uppercase tracking-wide text-[#59677c]"
                  htmlFor="hall-preset"
                >
                  Preset
                </label>

                <select
                  className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 text-sm"
                  id="hall-preset"
                  name="hallPreset"
                  onChange={(event) => setPreset(event.target.value)}
                  value={preset}
                >
                  <option>Grand Hall</option>
                  <option>Nachlas Yehuda A</option>
                  <option>Nachlas Yehuda B</option>
                  <option>Terrace Room</option>
                  <option>Small Hall</option>
                </select>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    className="h-9 rounded-lg border border-[#b9c2cf] bg-white text-[10px] font-black hover:bg-[#eef4fa]"
                    onClick={loadPreset}
                    type="button"
                  >
                    Load preset
                  </button>

                  <button
                    className="h-9 rounded-lg bg-[#1f4d73] text-[10px] font-black text-white hover:bg-[#15344f]"
                    type="button"
                  >
                    Save preset
                  </button>
                </div>

                <button
                  className="mt-2 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white text-[10px] font-black hover:bg-[#eef4fa]"
                  type="button"
                >
                  Add new preset
                </button>

                <button
                  className="mt-2 h-9 w-full rounded-lg border border-[#efb5ad] bg-white text-[10px] font-black text-[#c3291b] hover:bg-[#fff4f2]"
                  type="button"
                >
                  Delete custom preset
                </button>
              </section>

              <section className="mt-3 rounded-lg border border-[#d8dde5] p-2">
                <h3 className="text-[10px] font-black">Actions</h3>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    className="h-9 rounded-lg border border-[#b9c2cf] bg-white text-[10px] font-black enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedObject}
                    onClick={duplicateSelectedObject}
                    type="button"
                  >
                    Duplicate
                  </button>

                  <button
                    className="h-9 rounded-lg border border-[#efb5ad] bg-white text-[10px] font-black text-[#c3291b] enabled:hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedObject}
                    onClick={deleteSelectedObject}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </section>
            </div>
          </Panel>

          <Panel className="flex min-h-155 min-w-0 flex-col">
            <header className="flex flex-wrap items-center gap-2 border-b border-[#d8dde5] p-2">
              <h2 className="text-sm font-black">Hall Room Map</h2>

              <span className="rounded-lg border border-[#d8dde5] bg-[#f8fafc] px-3 py-2 text-[10px] font-bold text-[#617086]">
                Single-screen editor
              </span>

              <div className="ml-auto flex gap-2">
                <button
                  className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa]"
                  onClick={clearMap}
                  type="button"
                >
                  Clear
                </button>

                <button
                  className="h-9 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f]"
                  type="button"
                >
                  Save map
                </button>
              </div>
            </header>

            <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-2">
              <div
                className="relative min-h-134.5 w-full min-w-0 overflow-hidden rounded-lg border border-[#bdc9d6] bg-[#fbfdff] bg-[linear-gradient(#dce5ef_1px,transparent_1px),linear-gradient(90deg,#dce5ef_1px,transparent_1px)] bg-size-[20px_20px]"
                onClick={() => setSelectedObjectId(null)}
                role="presentation"
              >
                {objects.map((object) => (
                  <MapObjectView
                    key={object.id}
                    object={object}
                    onSelect={() => setSelectedObjectId(object.id)}
                    selected={selectedObjectId === object.id}
                  />
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <header className="border-b border-[#d8dde5] px-3 py-2">
              <h2 className="text-sm font-black">
                Object inspector
              </h2>

              <p className="mt-1 text-[10px] text-[#617086]">
                Selected shape settings.
              </p>
            </header>

            <div className="p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[#d8dde5] bg-[#f8fafc] p-2">
                  <strong className="block truncate text-base">
                    {selectedObject?.type ?? "None"}
                  </strong>

                  <span className="mt-2 block text-[9px] font-black uppercase text-[#617086]">
                    Type
                  </span>
                </div>

                <div className="rounded-lg border border-[#d8dde5] bg-[#f8fafc] p-2">
                  <strong className="block text-base">
                    {selectedObject?.rotation ?? 0}°
                  </strong>

                  <span className="mt-2 block text-[9px] font-black uppercase text-[#617086]">
                    Rotation
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <InspectorField htmlFor="object-name">
                  Name
                </InspectorField>

                <input
                  className="h-9 w-full rounded-lg border border-[#b9c2cf] px-2 text-sm disabled:bg-[#f5f6f8]"
                  disabled={!selectedObject}
                  id="object-name"
                  name="objectName"
                  onChange={(event) =>
                    updateSelectedObject({ name: event.target.value })
                  }
                  placeholder="Select object"
                  value={selectedObject?.name ?? ""}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <InspectorField htmlFor="object-width">
                    Width
                  </InspectorField>

                  <input
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] px-2 text-sm disabled:bg-[#f5f6f8]"
                    disabled={!selectedObject}
                    id="object-width"
                    min="10"
                    name="objectWidth"
                    onChange={(event) =>
                      updateSelectedObject({
                        width: Number(event.target.value),
                      })
                    }
                    type="number"
                    value={selectedObject?.width ?? ""}
                  />
                </div>

                <div>
                  <InspectorField htmlFor="object-height">
                    Height
                  </InspectorField>

                  <input
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] px-2 text-sm disabled:bg-[#f5f6f8]"
                    disabled={!selectedObject}
                    id="object-height"
                    min="10"
                    name="objectHeight"
                    onChange={(event) =>
                      updateSelectedObject({
                        height: Number(event.target.value),
                      })
                    }
                    type="number"
                    value={selectedObject?.height ?? ""}
                  />
                </div>

                <div>
                  <InspectorField htmlFor="object-seats">
                    Seats
                  </InspectorField>

                  <input
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] px-2 text-sm disabled:bg-[#f5f6f8]"
                    disabled={!selectedObject}
                    id="object-seats"
                    min="0"
                    name="objectSeats"
                    onChange={(event) =>
                      updateSelectedObject({
                        seats: Number(event.target.value),
                      })
                    }
                    type="number"
                    value={selectedObject?.seats ?? ""}
                  />
                </div>

                <div>
                  <InspectorField htmlFor="seating-use">
                    Seating use
                  </InspectorField>

                  <select
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 text-sm disabled:bg-[#f5f6f8]"
                    disabled={!selectedObject}
                    id="seating-use"
                    name="seatingUse"
                    onChange={(event) =>
                      updateSelectedObject({
                        seatingUse: event.target.value as SeatingUse,
                      })
                    }
                    value={selectedObject?.seatingUse ?? "none"}
                  >
                    <option value="none">No seating</option>
                    <option value="adult">Adult seating</option>
                    <option value="kids">Kids seating</option>
                    <option value="head">Head table</option>
                  </select>
                </div>

                <div>
                  <InspectorField htmlFor="object-x">X</InspectorField>

                  <input
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] px-2 text-sm disabled:bg-[#f5f6f8]"
                    disabled={!selectedObject}
                    id="object-x"
                    name="objectX"
                    onChange={(event) =>
                      updateSelectedObject({
                        x: Number(event.target.value),
                      })
                    }
                    type="number"
                    value={selectedObject?.x ?? ""}
                  />
                </div>

                <div>
                  <InspectorField htmlFor="object-y">Y</InspectorField>

                  <input
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] px-2 text-sm disabled:bg-[#f5f6f8]"
                    disabled={!selectedObject}
                    id="object-y"
                    name="objectY"
                    onChange={(event) =>
                      updateSelectedObject({
                        y: Number(event.target.value),
                      })
                    }
                    type="number"
                    value={selectedObject?.y ?? ""}
                  />
                </div>
              </div>

              <div className="mt-3">
                <InspectorField htmlFor="object-rotation">
                  Rotation
                </InspectorField>

                <input
                  className="h-9 w-full rounded-lg border border-[#b9c2cf] px-2 text-sm disabled:bg-[#f5f6f8]"
                  disabled={!selectedObject}
                  id="object-rotation"
                  max="360"
                  min="0"
                  name="objectRotation"
                  onChange={(event) =>
                    updateSelectedObject({
                      rotation: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={selectedObject?.rotation ?? ""}
                />
              </div>

              <p className="mt-3 text-[10px] leading-5 text-[#617086]">
                The inspector updates one selected object. Tables have
                a seat count and seating use. Double-click a label to
                rename it.
              </p>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
