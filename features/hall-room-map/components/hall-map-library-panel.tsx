"use client";

import { useState } from "react";
import { CompactSelect } from "@/components/ui/compact-select";
import { Panel } from "@/features/hall-room-map/components/hall-map-panel";
import {
  ShapeButton,
  ShapePreview
} from "@/features/hall-room-map/components/hall-map-shape-library";
import {
  shapeOptions,
  type SavedHallMap,
  type ShapeLibraryItem,
  type ShapeType
} from "@/features/hall-room-map/components/hall-map-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

type HallOption = {
  id: string;
  name: string;
};

type NewTableInput = {
  name: string;
  shapeType: "round-table" | "rect-table";
  width: number;
  height: number;
  seats: number;
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
  shapeLibrary: ShapeLibraryItem[];
  hasFloorPlan: boolean;
  onAddObject: (type: ShapeType) => void;
  onAddShapeLibraryObject: (shape: ShapeLibraryItem) => void;
  onAddTableRows: (input: {
    type: "round-table" | "rect-table";
    count: number;
    perRow: number;
    seats: number;
  }) => void;
  onCopyMapToHall: (hallId: string) => void;
  onCreateShapeLibraryItem: (input: NewTableInput) => Promise<void>;
  onDeleteMap: () => void;
  onDeleteSelectedObject: () => void;
  onDuplicateSelectedObject: () => void;
  onLoadPreset: () => void;
  onNewMap: () => void;
  onRemoveFloorPlan: () => void;
  onRenameMap: () => void;
  onSavePreset: () => void;
  onSelectHall: (hallId: string) => void;
  onSelectMap: (map: SavedHallMap) => void;
  onUploadFloorPlan: (file: File) => void;
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
  shapeLibrary,
  hasFloorPlan,
  onAddObject,
  onAddShapeLibraryObject,
  onAddTableRows,
  onCopyMapToHall,
  onCreateShapeLibraryItem,
  onDeleteMap,
  onDeleteSelectedObject,
  onDuplicateSelectedObject,
  onLoadPreset,
  onNewMap,
  onRemoveFloorPlan,
  onRenameMap,
  onSavePreset,
  onSelectHall,
  onSelectMap,
  onUploadFloorPlan
}: HallMapLibraryPanelProps) {
  const { t } = useAppLanguage();
  const [isNewTableOpen, setIsNewTableOpen] = useState(false);
  const [rowsForm, setRowsForm] = useState({
    count: "8",
    perRow: "4",
    seats: "10"
  });
  const [copyTargetHallId, setCopyTargetHallId] = useState("");
  const [newTableError, setNewTableError] = useState("");
  const [newTableForm, setNewTableForm] = useState({
    name: "",
    seats: "10",
    shapeType: "round-table" as "round-table" | "rect-table",
    width: "68"
  });

  async function submitNewTable() {
    const size = Number(newTableForm.width);
    const seats = Number(newTableForm.seats);

    if (!newTableForm.name.trim() || !Number.isFinite(size) || size < 10) {
      setNewTableError(t("hallMap.enterTableNameAndSize"));
      return;
    }

    if (!Number.isFinite(seats) || seats < 0) {
      setNewTableError(t("hallMap.enterValidCapacity"));
      return;
    }

    try {
      setNewTableError("");
      await onCreateShapeLibraryItem({
        name: newTableForm.name,
        shapeType: newTableForm.shapeType,
        width: size,
        height: size,
        seats
      });
      setIsNewTableOpen(false);
      setNewTableForm({
        name: "",
        seats: "10",
        shapeType: "round-table",
        width: "68"
      });
    } catch (error) {
      setNewTableError(
        error instanceof Error ? error.message : t("hallMap.tableSaveFailed")
      );
    }
  }

  return (
    <>
      <Panel className="order-2 block md:block xl:order-1">
        <header className="border-b border-[#d8dde5] px-3 py-2">
          <h2 className="text-sm font-black">{t("hallMap.shapeLibrary")}</h2>
          <p className="mt-1 text-[10px] text-[#617086]">
            {t("hallMap.clickToAdd")}
          </p>
        </header>

        <div className="p-2">
          <div className="grid grid-cols-2 gap-2 max-md:pointer-events-none max-md:opacity-60">
            {shapeOptions.map((shape) => (
              <ShapeButton
                disabled={!hasSelectedMap}
                key={shape.type}
                label={t(shape.labelKey)}
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
            {t("hallMap.mechitzaDivider")}
          </button>

          <button
            className="mt-2 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 text-[10px] font-black enabled:hover:border-[#1f4d73] enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-45 max-md:pointer-events-none max-md:opacity-60"
            disabled={!hasSelectedMap}
            onClick={() => setIsNewTableOpen(true)}
            type="button"
          >
            {t("hallMap.newTable")}
          </button>

          <section className="mt-3 rounded-lg border border-[#d8dde5] p-2 max-md:pointer-events-none max-md:opacity-60">
            <h3 className="text-[10px] font-black">{t("hallMap.addInRows")}</h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="min-w-0">
                <span className="block text-[9px] font-black uppercase tracking-wide text-[#59677c]">
                  {t("hallMap.tables")}
                </span>
                <input
                  className="mt-1 h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs"
                  inputMode="numeric"
                  name="rowTablesCount"
                  onChange={(event) =>
                    setRowsForm((current) => ({
                      ...current,
                      count: event.target.value
                    }))
                  }
                  value={rowsForm.count}
                />
              </label>
              <label className="min-w-0">
                <span className="block text-[9px] font-black uppercase tracking-wide text-[#59677c]">
                  {t("hallMap.perRow")}
                </span>
                <input
                  className="mt-1 h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs"
                  inputMode="numeric"
                  name="rowTablesPerRow"
                  onChange={(event) =>
                    setRowsForm((current) => ({
                      ...current,
                      perRow: event.target.value
                    }))
                  }
                  value={rowsForm.perRow}
                />
              </label>
              <label className="min-w-0">
                {/* Visible text is short so all three labels stay on one line
                    and the inputs align. The accessible name stays
                    t("hallMap.seatsPerTable") - a bare "Seats" would collide with the
                    inspector's field of the same name. */}
                <span
                  aria-hidden="true"
                  className="block whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-[#59677c]"
                >
                  {t("hallMap.seats")}
                </span>
                <input
                  aria-label={t("hallMap.seatsPerTable")}
                  className="mt-1 h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs"
                  inputMode="numeric"
                  name="rowTablesSeats"
                  onChange={(event) =>
                    setRowsForm((current) => ({
                      ...current,
                      seats: event.target.value
                    }))
                  }
                  value={rowsForm.seats}
                />
              </label>
            </div>
            <button
              className="mt-2 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 text-[10px] font-black enabled:hover:border-[#1f4d73] enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={
                !hasSelectedMap ||
                !Number.isFinite(Number(rowsForm.count)) ||
                Number(rowsForm.count) < 1
              }
              onClick={() =>
                onAddTableRows({
                  type: "round-table",
                  count: Math.min(100, Math.max(1, Number(rowsForm.count))),
                  perRow: Math.min(20, Math.max(1, Number(rowsForm.perRow))),
                  seats: Math.min(100, Math.max(0, Number(rowsForm.seats)))
                })
              }
              type="button"
            >
              {t("hallMap.addRoundInRows")}
            </button>
          </section>

          <section className="mt-3 rounded-lg border border-[#d8dde5] p-2">
            <h3 className="text-[10px] font-black">{t("hallMap.customTables")}</h3>
            {shapeLibrary.length ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {shapeLibrary.map((shape) => (
                  <ShapeButton
                    disabled={!hasSelectedMap}
                    key={shape.id}
                    label={shape.name}
                    onClick={() => onAddShapeLibraryObject(shape)}
                    type={shape.shapeType}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-[#617086]">
                {t("hallMap.savedTablesHere")}
              </p>
            )}
          </section>

          <section className="mt-3 rounded-lg border border-[#d8dde5] p-2">
            <h3 className="text-[10px] font-black">{t("hallMap.hallPresets")}</h3>

            <label
              className="mt-2 block text-[9px] font-black uppercase tracking-wide text-[#59677c]"
              htmlFor="hall-preset"
            >
              {t("hallMap.preset")}
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
                  ? [{ label: t("hallMap.noPresetsForHall"), value: "" }]
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
              {t("hallMap.assignedHall")}
            </label>
            <CompactSelect
              disabled={halls.length === 0}
              id="assigned-hall"
              onChange={onSelectHall}
              options={[
                { label: t("hallMap.selectHall"), value: "" },
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
                {t("hallMap.loadPreset")}
              </button>

              <button
                className="h-9 min-w-0 whitespace-nowrap rounded-lg bg-[#1f4d73] px-1 text-[10px] font-black text-white enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!hasSelectedMap}
                onClick={onSavePreset}
                type="button"
              >
                {t("hallMap.savePreset")}
              </button>
            </div>

            <button
              className="mt-2 h-9 w-full whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-2 text-[10px] font-black hover:bg-[#eef4fa] max-md:pointer-events-none max-md:opacity-60"
              onClick={onNewMap}
              type="button"
            >
              {t("hallMap.newMap")}
            </button>

            <div className="mt-2 grid grid-cols-2 gap-2 max-md:pointer-events-none max-md:opacity-60">
              <button
                className="h-9 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-1 text-[10px] font-black enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!hasSelectedMap}
                onClick={onRenameMap}
                type="button"
              >
                {t("hallMap.rename")}
              </button>
              <button
                className="h-9 whitespace-nowrap rounded-lg border border-[#efb5ad] bg-white px-1 text-[10px] font-black text-[#c3291b] enabled:hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!hasSelectedMap}
                onClick={onDeleteMap}
                type="button"
              >
                {t("hallMap.deleteMap")}
              </button>
            </div>

            {halls.length > 1 ? (
              <div className="mt-2 max-md:pointer-events-none max-md:opacity-60">
                <label
                  className="block text-[9px] font-black uppercase tracking-wide text-[#59677c]"
                  htmlFor="copy-map-target"
                >
                  {t("hallMap.copyMapTo")}
                </label>
                <div className="mt-1 flex gap-2">
                  <div className="min-w-0 flex-1">
                    <CompactSelect
                      disabled={!hasSelectedMap}
                      id="copy-map-target"
                      onChange={setCopyTargetHallId}
                      options={[
                        { label: t("hallMap.chooseHall"), value: "" },
                        ...halls
                          .filter((hall) => hall.id !== selectedHallId)
                          .map((hall) => ({
                            label: hall.name,
                            value: hall.id
                          }))
                      ]}
                      value={copyTargetHallId}
                    />
                  </div>
                  <button
                    className="h-8 shrink-0 rounded-lg border border-[#b9c2cf] bg-white px-2 text-[10px] font-black enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50 sm:h-9"
                    disabled={!hasSelectedMap || !copyTargetHallId}
                    onClick={() => {
                      onCopyMapToHall(copyTargetHallId);
                      setCopyTargetHallId("");
                    }}
                    type="button"
                  >
                    {t("hallMap.copy")}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-2 max-md:pointer-events-none max-md:opacity-60">
              <span className="block text-[9px] font-black uppercase tracking-wide text-[#59677c]">
                {t("hallMap.floorPlan")}
              </span>
              <div className="mt-1 flex gap-2">
                <label
                  // `relative` is load-bearing: the sr-only input inside is
                  // position:absolute, and with no positioned ancestor it
                  // resolves against the document - escaping the app's
                  // overflow-hidden root and adding a window scrollbar.
                  className={`relative flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-lg border border-[#b9c2cf] bg-white px-2 text-[10px] font-black hover:bg-[#eef4fa] ${
                    hasSelectedMap ? "" : "pointer-events-none opacity-50"
                  }`}
                >
                  {hasFloorPlan ? t("hallMap.replaceImage") : t("hallMap.uploadImage")}
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    aria-label={t("hallMap.uploadFloorPlan")}
                    className="sr-only"
                    disabled={!hasSelectedMap}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) onUploadFloorPlan(file);
                      event.target.value = "";
                    }}
                    type="file"
                  />
                </label>
                {hasFloorPlan ? (
                  <button
                    className="h-9 shrink-0 rounded-lg border border-[#efb5ad] bg-white px-2 text-[10px] font-black text-[#c3291b] hover:bg-[#fff4f2]"
                    onClick={onRemoveFloorPlan}
                    type="button"
                  >
                    {t("common.remove")}
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-[9px] leading-4 text-[#617086]">
                {t("hallMap.floorPlanHint")}
              </p>
            </div>
          </section>

          <section className="mt-3 rounded-lg border border-[#d8dde5] p-2 max-md:pointer-events-none max-md:opacity-60">
            <h3 className="text-[10px] font-black">{t("common.actions")}</h3>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                className="h-9 rounded-lg border border-[#b9c2cf] bg-white text-[10px] font-black enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedObjectExists}
                onClick={onDuplicateSelectedObject}
                type="button"
              >
                {t("hallMap.duplicate")}
              </button>

              <button
                className="h-9 rounded-lg border border-[#efb5ad] bg-white text-[10px] font-black text-[#c3291b] enabled:hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedObjectExists}
                onClick={onDeleteSelectedObject}
                type="button"
              >
                {t("common.delete")}
              </button>
            </div>
          </section>
        </div>
      </Panel>

      {isNewTableOpen ? (
        <div
          className="pointer-events-auto fixed inset-0 z-100 flex items-center justify-center bg-[#07162d]/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsNewTableOpen(false);
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="new-table-dialog-title"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-2xl"
            role="dialog"
          >
            <header className="flex items-center gap-3 border-b border-[#d8dde5] px-5 py-4">
              <h2
                className="min-w-0 flex-1 text-lg font-black"
                id="new-table-dialog-title"
              >
                {t("hallMap.newTable")}
              </h2>
              <button
                aria-label={t("common.close")}
                className="flex h-9 w-9 items-center justify-center rounded-md text-2xl leading-none hover:bg-[#eef4fa]"
                onClick={() => setIsNewTableOpen(false)}
                type="button"
              >
                x
              </button>
            </header>
            <form
              className="space-y-4 p-5"
              onSubmit={(event) => {
                event.preventDefault();
                void submitNewTable();
              }}
            >
              <label
                className="block text-xs font-black uppercase tracking-wide text-[#59677c]"
                htmlFor="new-table-name"
              >
                {t("hallMap.tableName")}
              </label>
              <input
                autoFocus
                className="h-11 w-full rounded-xl border border-[#b9c2cf] px-3 text-sm outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                id="new-table-name"
                onChange={(event) =>
                  setNewTableForm((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
                placeholder={t("hallMap.tableNameExample")}
                required
                value={newTableForm.name}
              />

              <label
                className="block text-xs font-black uppercase tracking-wide text-[#59677c]"
                htmlFor="new-table-shape"
              >
                {t("hallMap.shape")}
              </label>
              <select
                className="h-11 w-full rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                id="new-table-shape"
                onChange={(event) => {
                  const shapeType = event.target.value as
                    | "round-table"
                    | "rect-table";
                  setNewTableForm((current) => ({
                    ...current,
                    shapeType
                  }));
                }}
                value={newTableForm.shapeType}
              >
                <option value="round-table">{t("hallMap.roundTable")}</option>
                <option value="rect-table">{t("hallMap.squareTable")}</option>
              </select>

              <label
                className="block text-xs font-black uppercase tracking-wide text-[#59677c]"
                htmlFor="new-table-size"
              >
                {t("hallMap.realSize")}
              </label>
              <input
                className="h-11 w-full rounded-xl border border-[#b9c2cf] px-3 text-sm outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                id="new-table-size"
                min={10}
                max={5000}
                onChange={(event) =>
                  setNewTableForm((current) => ({
                    ...current,
                    width: event.target.value
                  }))
                }
                placeholder={
                  newTableForm.shapeType === "round-table"
                    ? "Diameter"
                    : "Side"
                }
                required
                type="number"
                value={newTableForm.width}
              />

              <label
                className="block text-xs font-black uppercase tracking-wide text-[#59677c]"
                htmlFor="new-table-capacity"
              >
                {t("hallMap.capacitySeats")}
              </label>
              <input
                className="h-11 w-full rounded-xl border border-[#b9c2cf] px-3 text-sm outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                id="new-table-capacity"
                min={0}
                max={1000}
                onChange={(event) =>
                  setNewTableForm((current) => ({
                    ...current,
                    seats: event.target.value
                  }))
                }
                placeholder={t("hallMap.numberOfSeats")}
                required
                type="number"
                value={newTableForm.seats}
              />

              {newTableError ? (
                <p className="rounded-lg border border-[#f3b8ae] bg-[#fff4f2] px-3 py-2 text-xs font-bold text-[#b42318]">
                  {newTableError}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  className="h-10 rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-bold hover:bg-[#eef4fa]"
                  onClick={() => setIsNewTableOpen(false)}
                  type="button"
                >
                  {t("common.cancel")}
                </button>
                <button
                  className="h-10 rounded-xl bg-[#1f4d73] px-4 text-sm font-bold text-white hover:bg-[#15344f]"
                  type="submit"
                >
                  {t("hallMap.saveTable")}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
