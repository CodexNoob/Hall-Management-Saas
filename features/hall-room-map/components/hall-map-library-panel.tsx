"use client";

import { CompactSelect } from "@/components/ui/compact-select";
import { Panel } from "@/features/hall-room-map/components/hall-map-panel";
import {
  ShapeButton,
  ShapePreview
} from "@/features/hall-room-map/components/hall-map-shape-library";
import {
  shapeOptions,
  type SavedHallMap,
  type ShapeType
} from "@/features/hall-room-map/components/hall-map-shared";

type HallOption = {
  id: string;
  name: string;
};

type HallMapLibraryPanelProps = {
  halls: HallOption[];
  hasSelectedHall: boolean;
  hasSelectedMap: boolean;
  hallMaps: SavedHallMap[];
  selectedHallId: string;
  selectedHallMaps: SavedHallMap[];
  selectedMapId: string;
  selectedObjectExists: boolean;
  onAddObject: (type: ShapeType) => void;
  onDeleteMap: () => void;
  onDeleteSelectedObject: () => void;
  onDuplicateSelectedObject: () => void;
  onLoadPreset: () => void;
  onNewMap: () => void;
  onRenameMap: () => void;
  onSavePreset: () => void;
  onSelectHall: (hallId: string) => void;
  onSelectMap: (map: SavedHallMap) => void;
};

export function HallMapLibraryPanel({
  halls,
  hasSelectedHall,
  hasSelectedMap,
  hallMaps,
  selectedHallId,
  selectedHallMaps,
  selectedMapId,
  selectedObjectExists,
  onAddObject,
  onDeleteMap,
  onDeleteSelectedObject,
  onDuplicateSelectedObject,
  onLoadPreset,
  onNewMap,
  onRenameMap,
  onSavePreset,
  onSelectHall,
  onSelectMap
}: HallMapLibraryPanelProps) {
  return (
    <Panel className="order-2 block md:block xl:order-1">
      <header className="border-b border-[#d8dde5] px-3 py-2">
        <h2 className="text-sm font-black">Shape library</h2>
        <p className="mt-1 text-[10px] text-[#617086]">
          Click to add to the map.
        </p>
      </header>

      <div className="p-2">
        <div className="grid grid-cols-2 gap-2 max-md:pointer-events-none max-md:opacity-60">
          {shapeOptions.map((shape) => (
            <ShapeButton
              disabled={!hasSelectedMap}
              key={shape.type}
              label={shape.label}
              onClick={() => onAddObject(shape.type)}
              type={shape.type}
            />
          ))}
        </div>

        <button
          className="mt-2 flex min-h-14 w-full flex-col items-center justify-center gap-2 rounded-lg border border-[#d1dae5] text-[10px] font-black enabled:hover:border-[#1f4d73] enabled:hover:bg-[#eef6fc] disabled:cursor-not-allowed disabled:opacity-45 max-md:pointer-events-none max-md:opacity-60"
          disabled={!hasSelectedMap}
          onClick={() => onAddObject("divider")}
          type="button"
        >
          <ShapePreview type="divider" />
          Mechitza divider
        </button>

        <section className="mt-3 rounded-lg border border-[#d8dde5] p-2">
          <h3 className="text-[10px] font-black">Hall presets</h3>

          <label
            className="mt-2 block text-[9px] font-black uppercase tracking-wide text-[#59677c]"
            htmlFor="hall-preset"
          >
            Preset
          </label>

          <CompactSelect
            disabled={!hasSelectedHall || selectedHallMaps.length === 0}
            id="hall-preset"
            onChange={(value) => {
              const nextMap = hallMaps.find((map) => map.id === value);
              if (nextMap) {
                onSelectMap(nextMap);
              }
            }}
            options={
              selectedHallMaps.length === 0
                ? [{ label: "No presets for this hall", value: "" }]
                : selectedHallMaps.map((map) => ({
                    label: map.name,
                    value: map.id
                  }))
            }
            value={selectedMapId}
          />

          <label
            className="mt-2 block text-[9px] font-black uppercase tracking-wide text-[#59677c]"
            htmlFor="assigned-hall"
          >
            Assigned hall
          </label>
          <CompactSelect
            disabled={halls.length === 0}
            id="assigned-hall"
            onChange={onSelectHall}
            options={[
              { label: "Select a hall", value: "" },
              ...halls.map((hall) => ({
                label: hall.name,
                value: hall.id
              }))
            ]}
            value={selectedHallId}
          />

          <div className="mt-2 grid grid-cols-2 gap-2 max-md:pointer-events-none max-md:opacity-60">
            <button
              className="h-9 min-w-0 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-1 text-[10px] font-black enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!hasSelectedMap}
              onClick={onLoadPreset}
              type="button"
            >
              Load preset
            </button>

            <button
              className="h-9 min-w-0 whitespace-nowrap rounded-lg bg-[#1f4d73] px-1 text-[10px] font-black text-white enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!hasSelectedMap}
              onClick={onSavePreset}
              type="button"
            >
              Save preset
            </button>
          </div>

          <button
            className="mt-2 h-9 w-full whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-2 text-[10px] font-black hover:bg-[#eef4fa] max-md:pointer-events-none max-md:opacity-60"
            onClick={onNewMap}
            type="button"
          >
            New hall room map
          </button>

          <div className="mt-2 grid grid-cols-2 gap-2 max-md:pointer-events-none max-md:opacity-60">
            <button
              className="h-9 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-1 text-[10px] font-black enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hasSelectedMap}
              onClick={onRenameMap}
              type="button"
            >
              Rename
            </button>
            <button
              className="h-9 whitespace-nowrap rounded-lg border border-[#efb5ad] bg-white px-1 text-[10px] font-black text-[#c3291b] enabled:hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hasSelectedMap}
              onClick={onDeleteMap}
              type="button"
            >
              Delete map
            </button>
          </div>
        </section>

        <section className="mt-3 rounded-lg border border-[#d8dde5] p-2 max-md:pointer-events-none max-md:opacity-60">
          <h3 className="text-[10px] font-black">Actions</h3>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white text-[10px] font-black enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedObjectExists}
              onClick={onDuplicateSelectedObject}
              type="button"
            >
              Duplicate
            </button>

            <button
              className="h-9 rounded-lg border border-[#efb5ad] bg-white text-[10px] font-black text-[#c3291b] enabled:hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedObjectExists}
              onClick={onDeleteSelectedObject}
              type="button"
            >
              Delete
            </button>
          </div>
        </section>
      </div>
    </Panel>
  );
}
