"use client";

import type { z } from "zod";

import { CompactSelect } from "@/components/ui/compact-select";
import { LiveNumberField } from "@/components/ui/number-field";
import { InspectorField } from "@/features/hall-room-map/components/hall-map-inspector-field";
import { Panel } from "@/features/hall-room-map/components/hall-map-panel";
import {
  type MapObject,
  type SeatingUse
} from "@/features/hall-room-map/components/hall-map-shared";
import { mapObjectFieldSchemas } from "@/features/hall-room-map/validations/hall-map.schema";

const inputClass =
  "h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]";

/**
 * A labelled wrapper around the shared live numeric field. These used to be
 * `type="number"` feeding `Number(event.target.value)` straight through; the
 * browser hands back "" for anything it cannot parse and `Number("")` is 0, so
 * clearing Width silently snapped the object to zero instead of saying anything.
 */
function NumericInspectorInput({
  id,
  name,
  label,
  schema,
  value,
  disabled,
  onCommit
}: {
  id: string;
  name: string;
  label: string;
  schema: z.ZodType<number>;
  value: number | null | undefined;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  return (
    <div>
      <InspectorField htmlFor={id}>{label}</InspectorField>

      <LiveNumberField
        className={inputClass}
        disabled={disabled}
        id={id}
        name={name}
        onCommit={onCommit}
        schema={schema}
        value={value}
      />
    </div>
  );
}

type HallMapObjectInspectorProps = {
  selectedObject: MapObject | null;
  onUpdateSelectedObject: (updates: Partial<Omit<MapObject, "id">>) => void;
};

export function HallMapObjectInspector({
  selectedObject,
  onUpdateSelectedObject
}: HallMapObjectInspectorProps) {
  const disabled = !selectedObject;
  // Remount the numeric boxes when the selection changes so a half-typed value
  // never carries over to a different object.
  const selectionKey = selectedObject?.id ?? "none";

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
            className={inputClass}
            disabled={disabled}
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
          <NumericInspectorInput
            disabled={disabled}
            id="object-width"
            key={`${selectionKey}-width`}
            label="Width"
            name="objectWidth"
            onCommit={(width) => onUpdateSelectedObject({ width })}
            schema={mapObjectFieldSchemas.width}
            value={selectedObject?.width}
          />

          <NumericInspectorInput
            disabled={disabled}
            id="object-height"
            key={`${selectionKey}-height`}
            label="Height"
            name="objectHeight"
            onCommit={(height) => onUpdateSelectedObject({ height })}
            schema={mapObjectFieldSchemas.height}
            value={selectedObject?.height}
          />

          <NumericInspectorInput
            disabled={disabled}
            id="object-seats"
            key={`${selectionKey}-seats`}
            label="Seats"
            name="objectSeats"
            onCommit={(seats) => onUpdateSelectedObject({ seats })}
            schema={mapObjectFieldSchemas.seats}
            value={selectedObject?.seats}
          />

          <div>
            <InspectorField htmlFor="seating-use">Seating use</InspectorField>

            <CompactSelect
              disabled={disabled}
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

          <NumericInspectorInput
            disabled={disabled}
            id="object-x"
            key={`${selectionKey}-x`}
            label="X"
            name="objectX"
            onCommit={(x) => onUpdateSelectedObject({ x })}
            schema={mapObjectFieldSchemas.x}
            value={selectedObject?.x}
          />

          <NumericInspectorInput
            disabled={disabled}
            id="object-y"
            key={`${selectionKey}-y`}
            label="Y"
            name="objectY"
            onCommit={(y) => onUpdateSelectedObject({ y })}
            schema={mapObjectFieldSchemas.y}
            value={selectedObject?.y}
          />
        </div>

        <div className="mt-3">
          <NumericInspectorInput
            disabled={disabled}
            id="object-rotation"
            key={`${selectionKey}-rotation`}
            label="Rotation"
            name="objectRotation"
            onCommit={(rotation) => onUpdateSelectedObject({ rotation })}
            schema={mapObjectFieldSchemas.rotation}
            value={selectedObject?.rotation}
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
