"use client";

import { CompactSelect } from "@/components/ui/compact-select";
import { InspectorField } from "@/features/hall-room-map/components/hall-map-inspector-field";
import { Panel } from "@/features/hall-room-map/components/hall-map-panel";
import {
  type MapObject,
  type SeatingUse
} from "@/features/hall-room-map/components/hall-map-shared";

type HallMapObjectInspectorProps = {
  selectedObject: MapObject | null;
  onUpdateSelectedObject: (updates: Partial<Omit<MapObject, "id">>) => void;
};

export function HallMapObjectInspector({
  selectedObject,
  onUpdateSelectedObject
}: HallMapObjectInspectorProps) {
  return (
    <Panel className="order-3 block md:block">
      <header className="border-b border-[#d8dde5] px-3 py-2">
        <h2 className="text-sm font-black">Object inspector</h2>

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
          <InspectorField htmlFor="object-name">Name</InspectorField>

          <input
            className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
            disabled={!selectedObject}
            id="object-name"
            name="objectName"
            onChange={(event) =>
              onUpdateSelectedObject({ name: event.target.value })
            }
            placeholder="Select object"
            value={selectedObject?.name ?? ""}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <InspectorField htmlFor="object-width">Width</InspectorField>

            <input
              className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
              disabled={!selectedObject}
              id="object-width"
              min="10"
              name="objectWidth"
              onChange={(event) =>
                onUpdateSelectedObject({
                  width: Number(event.target.value)
                })
              }
              type="number"
              value={selectedObject?.width ?? ""}
            />
          </div>

          <div>
            <InspectorField htmlFor="object-height">Height</InspectorField>

            <input
              className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
              disabled={!selectedObject}
              id="object-height"
              min="10"
              name="objectHeight"
              onChange={(event) =>
                onUpdateSelectedObject({
                  height: Number(event.target.value)
                })
              }
              type="number"
              value={selectedObject?.height ?? ""}
            />
          </div>

          <div>
            <InspectorField htmlFor="object-seats">Seats</InspectorField>

            <input
              className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
              disabled={!selectedObject}
              id="object-seats"
              min="0"
              name="objectSeats"
              onChange={(event) =>
                onUpdateSelectedObject({
                  seats: Number(event.target.value)
                })
              }
              type="number"
              value={selectedObject?.seats ?? ""}
            />
          </div>

          <div>
            <InspectorField htmlFor="seating-use">Seating use</InspectorField>

            <CompactSelect
              disabled={!selectedObject}
              id="seating-use"
              onChange={(value) =>
                onUpdateSelectedObject({
                  seatingUse: value as SeatingUse
                })
              }
              options={[
                { label: "No seating", value: "none" },
                { label: "Adult seating", value: "adult" },
                { label: "Kids seating", value: "kids" },
                { label: "Head table", value: "head" }
              ]}
              value={selectedObject?.seatingUse ?? "none"}
            />
          </div>

          <div>
            <InspectorField htmlFor="object-x">X</InspectorField>

            <input
              className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
              disabled={!selectedObject}
              id="object-x"
              name="objectX"
              onChange={(event) =>
                onUpdateSelectedObject({
                  x: Number(event.target.value)
                })
              }
              type="number"
              value={selectedObject?.x ?? ""}
            />
          </div>

          <div>
            <InspectorField htmlFor="object-y">Y</InspectorField>

            <input
              className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
              disabled={!selectedObject}
              id="object-y"
              name="objectY"
              onChange={(event) =>
                onUpdateSelectedObject({
                  y: Number(event.target.value)
                })
              }
              type="number"
              value={selectedObject?.y ?? ""}
            />
          </div>
        </div>

        <div className="mt-3">
          <InspectorField htmlFor="object-rotation">Rotation</InspectorField>

          <input
            className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
            disabled={!selectedObject}
            id="object-rotation"
            max="360"
            min="0"
            name="objectRotation"
            onChange={(event) =>
              onUpdateSelectedObject({
                rotation: Number(event.target.value)
              })
            }
            type="number"
            value={selectedObject?.rotation ?? ""}
          />
        </div>

        <p className="mt-3 text-[10px] leading-5 text-[#617086]">
          The inspector updates one selected object. Tables have a seat count
          and seating use. Edit the name field to rename a shape.
        </p>
      </div>
    </Panel>
  );
}
