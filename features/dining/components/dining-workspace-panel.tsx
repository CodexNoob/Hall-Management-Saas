"use client";

import {
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction
} from "react";
import { CompactSelect } from "@/components/ui/compact-select";
import { TableSeats } from "@/components/shared/table-seats";
import { FieldLabel, Panel } from "@/components/ui/panel";
import {
  getDefaultSeatingSides,
  isRoundSeatingShape
} from "@/lib/hall-map/seating";
import {
  DINING_MAP_MAX_SCALE,
  DINING_MAP_MIN_SCALE,
  DINING_MAP_WORLD_ORIGIN,
  DINING_MAP_WORLD_SIZE,
  eventSchedule,
  eventTitle,
  isDiningSeatingTable,
  type DiningResponse,
  type DiningTableData,
  type TableSide
} from "@/features/dining/components/dining-shared";
import { LineIcon } from "@/features/events/components/event-manager-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

type DiningEvent = DiningResponse["events"][number];
type HallMapPreset = NonNullable<DiningResponse["hallMapPresets"]>[number];

export function DiningWorkspacePanel({
  addTable,
  availableHallMapPresets,
  dragTable,
  hasPresetCoordinates,
  isPresetModified,
  isWorkspaceExpanded,
  seatRequirements,
  seatTotals,
  mapScale,
  mapSurfaceRef,
  mapViewportRef,
  onFitMap,
  onResetToPreset,
  onMapPanEnd,
  onMapPanMove,
  onMapPanStart,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  removeSelectedTable,
  savedMessage,
  selectedEvent,
  selectedPresetId,
  selectedTableIds,
  setDiningSelection,
  setIsWorkspaceExpanded,
  setSavedMessage,
  setSelectedPresetId,
  startTableDrag,
  stopTableDrag,
  tables
}: {
  addTable: (side?: TableSide) => void;
  availableHallMapPresets: HallMapPreset[];
  dragTable: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  hasPresetCoordinates: boolean;
  isPresetModified: boolean;
  isWorkspaceExpanded: boolean;
  seatRequirements: { men: number; women: number; kids: number };
  seatTotals: { men: number; women: number; kids: number };
  mapScale: number;
  mapSurfaceRef: RefObject<HTMLDivElement | null>;
  mapViewportRef: RefObject<HTMLDivElement | null>;
  onFitMap: () => void;
  onResetToPreset: () => void;
  onMapPanEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onMapPanMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onMapPanStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  removeSelectedTable: () => void;
  savedMessage: string;
  selectedEvent: DiningEvent;
  selectedPresetId: string;
  selectedTableIds: string[];
  setDiningSelection: (id: string, options?: { toggle?: boolean }) => void;
  setIsWorkspaceExpanded: Dispatch<SetStateAction<boolean>>;
  setSavedMessage: Dispatch<SetStateAction<string>>;
  setSelectedPresetId: (presetId: string) => void;
  startTableDrag: (
    event: ReactPointerEvent<HTMLButtonElement>,
    table: DiningTableData
  ) => void;
  stopTableDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  tables: DiningTableData[];
}) {
  const { t } = useAppLanguage();
  const seatsRequired =
    seatRequirements.men + seatRequirements.women + seatRequirements.kids;
  const seatsProvided = seatTotals.men + seatTotals.women + seatTotals.kids;
  // Short on any single side counts as short, even if the overall total looks
  // sufficient: men cannot be seated at the women's tables.
  const isSeatingShort =
    seatTotals.men < seatRequirements.men ||
    seatTotals.women < seatRequirements.women ||
    seatTotals.kids < seatRequirements.kids;

  return (
    // No max-height: the page grid stretches every column to the same row
    // height, and capping this one left it ending short of the Events and
    // Dining details columns beside it. The map fills whatever height the row
    // gives, so the three columns finish level.
    <Panel className="flex min-h-0 min-w-0 flex-col overflow-hidden sm:min-h-125 lg:min-h-[calc(100dvh-120px)] xl:min-h-0">
      <header className="border-b border-[#d8dde5] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black">
              {eventTitle(selectedEvent)}
            </h2>
            <p className="mt-1 truncate text-xs text-[#617086]">
              {selectedEvent.hall.name} {"\u00b7"}{" "}
              {eventSchedule(selectedEvent, t)}
            </p>
          </div>

          {/* Seated against required, at a glance. The details panel breaks
              this down per side; this is the number a planner checks while
              dragging tables, without looking away from the board. */}
          <span
            aria-label={t("dining.seatsProvided")}
            className={`hidden shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-black sm:inline-flex ${
              isSeatingShort
                ? "border-[#f3b4ae] bg-[#fef2f1] text-[#b42318]"
                : "border-[#a6e7c3] bg-[#ecfdf3] text-[#087047]"
            }`}
            title={`Men ${seatTotals.men}/${seatRequirements.men} · Women ${seatTotals.women}/${seatRequirements.women} · Kids ${seatTotals.kids}/${seatRequirements.kids}`}
          >
            {seatsProvided}/{seatsRequired} seats
            {isSeatingShort ? ` · short ${seatsRequired - seatsProvided}` : ""}
          </span>
          <button
            aria-expanded={isWorkspaceExpanded}
            aria-label={
              isWorkspaceExpanded
                ? t("dining.collapseWorkspace")
                : t("dining.expandWorkspace")
            }
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#1f4d73] transition hover:bg-[#eef4fa] lg:hidden"
            onClick={() => setIsWorkspaceExpanded((isExpanded) => !isExpanded)}
            type="button"
          >
            <LineIcon
              name="chevron"
              className={`h-5 w-5 transition-transform ${
                isWorkspaceExpanded ? "rotate-90" : ""
              }`}
            />
          </button>
        </div>
        <div
          className={`mt-3 flex-col gap-2 rounded-lg border border-[#d8dde5] bg-[#f8fafc] p-2.5 sm:flex-row sm:items-end lg:flex ${
            isWorkspaceExpanded ? "flex" : "hidden"
          }`}
        >
          <div className="min-w-0 flex-1">
            <FieldLabel htmlFor="hall-map-preset">{t("dining.hallMapPreset")}</FieldLabel>
            <CompactSelect
              id="hall-map-preset"
              onChange={(value) => {
                setSelectedPresetId(value);
                setSavedMessage("");
              }}
              options={[
                {
                  label: availableHallMapPresets.length
                    ? t("dining.selectPreset")
                    : t("dining.noPresetsFor", {
                        hall: selectedEvent.hall.name
                      }),
                  value: ""
                },
                ...availableHallMapPresets.map((preset) => ({
                  label: preset.name,
                  value: preset.id
                }))
              ]}
              value={selectedPresetId}
            />

            {/* Names the relationship the dropdown alone cannot: these tables
                are a copy, and this one has been rearranged since. Editing
                here never writes back to the preset. */}
            {isPresetModified ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-[#f0d08a] bg-[#fffaeb] px-2 py-1 text-[10px] font-black text-[#93600b]">
                  {t("dining.modifiedThisEvent")}
                </span>
                <button
                  className="rounded-md border border-[#b9c2cf] bg-white px-2 py-1 text-[10px] font-black hover:bg-[#eef4fa]"
                  onClick={onResetToPreset}
                  type="button"
                >
                  {t("dining.resetToPreset")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div
          className={`mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:flex ${
            isWorkspaceExpanded ? "flex" : "hidden"
          }`}
        >
          <button
            className="h-9 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-2 text-[11px] font-black hover:bg-[#eef4fa] sm:flex-none sm:px-3 sm:text-xs"
            onClick={() => addTable("men")}
            type="button"
          >
            + Adult table
          </button>
          <button
            className="h-9 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-2 text-[11px] font-black hover:bg-[#eef4fa] sm:flex-none sm:px-3 sm:text-xs"
            onClick={() => addTable("kids")}
            type="button"
          >
            + Kids table
          </button>
          <button
            className="h-9 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-2 text-[11px] font-black hover:bg-[#eef4fa] sm:flex-none sm:px-3 sm:text-xs"
            onClick={() => addTable("head")}
            type="button"
          >
            + Head table
          </button>
          <button
            className="h-9 min-w-0 rounded-lg border border-[#efb5ad] bg-white px-2 text-[11px] font-black text-[#b42318] enabled:hover:bg-[#fff4f2] disabled:opacity-40 sm:flex-none sm:px-3 sm:text-xs"
            disabled={!selectedTableIds.length}
            onClick={removeSelectedTable}
            type="button"
          >
            {t("dining.removeSelected")}
          </button>
        </div>
      </header>
      <div
        // A flex column so the map can grow into the panel. As a block it could
        // not, and the gap below the board was dead space.
        // No overscroll-contain. It stopped the wheel from chaining out to the
        // page once this container was involved, which is what the board's
        // hand-rolled smooth-scroll existed to work around - and that
        // workaround left a requestAnimationFrame loop running forever,
        // dragging the page back to a stale offset on every scroll made
        // anywhere else. Native chaining does the job and cannot go stale.
        className={`min-h-0 flex-1 flex-col overflow-auto p-2.5 sm:p-3 lg:flex ${
          isWorkspaceExpanded ? "flex" : "hidden"
        }`}
        data-dining-workspace-scroll="true"
      >
        <div
          // A low floor on purpose. The previous 535px minimum was taller than
          // the space a capped panel actually offers on a short screen, so the
          // board overflowed instead of fitting. flex-1 sizes it to whatever is
          // there, and it grows on taller screens.
          className="relative min-h-64 min-w-0 flex-1 overflow-hidden rounded-lg border border-[#bdc9d6] bg-[#fbfdff] bg-[linear-gradient(#dce5ef_1px,transparent_1px),linear-gradient(90deg,#dce5ef_1px,transparent_1px)] bg-size-[20px_20px]"
        >
          {savedMessage ? (
            // Same treatment as the hall map's saved confirmation, so a save
            // reads the same way in both modules. Fixed to the viewport, not
            // the board: the board can be scrolled out of view (and sits far
            // below the Save button on mobile), and a message pinned to it
            // fired into invisible space. Under the topbar it is visible at
            // every scroll position, on every screen size.
            <div
              className="pointer-events-none fixed left-1/2 top-17 z-50 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border border-[#a6e7c3] bg-[#ecfdf3]/95 px-4 py-3 text-[#065f46] shadow-lg backdrop-blur lg:top-22"
              role="status"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#12b76a] text-sm font-black text-white"
              >
                ✓
              </span>
              <p className="min-w-0 text-sm font-black">{savedMessage}</p>
            </div>
          ) : null}
          {hasPresetCoordinates ? (
            <>
            <div
              className="absolute top-3 right-3 z-20 flex overflow-hidden rounded-lg border border-[#9eacbc] bg-white/95 shadow-md backdrop-blur"
              data-dining-map-control="true"
            >
              <button
                aria-label={t("dining.zoomOut")}
                className="h-9 w-9 text-lg font-black hover:bg-[#eef4fa] disabled:opacity-40"
                disabled={mapScale <= DINING_MAP_MIN_SCALE}
                onClick={onZoomOut}
                type="button"
              >
                −
              </button>
              <button
                aria-label={t("dining.resetZoom")}
                className="h-9 min-w-14 border-x border-[#d8dde5] px-2 text-[10px] font-black hover:bg-[#eef4fa]"
                onClick={onZoomReset}
                type="button"
              >
                {Math.round(mapScale * 100)}%
              </button>
              <button
                aria-label={t("dining.zoomIn")}
                className="h-9 w-9 text-lg font-black hover:bg-[#eef4fa] disabled:opacity-40"
                disabled={mapScale >= DINING_MAP_MAX_SCALE}
                onClick={onZoomIn}
                type="button"
              >
                +
              </button>
              <button
                className="h-9 border-l border-[#d8dde5] px-3 text-[10px] font-black hover:bg-[#eef4fa]"
                onClick={() => onFitMap()}
                type="button"
              >
                {t("dining.fit")}
              </button>
            </div>
            <div
              aria-label={t("dining.mapGrid")}
              // Fills the wrapper instead of carrying its own fixed height.
              // `contain: size` means it takes no size from its 20,000-unit
              // contents, so the inset has to supply it.
              className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
              onPointerCancel={onMapPanEnd}
              onPointerDown={onMapPanStart}
              onPointerMove={onMapPanMove}
              onPointerUp={onMapPanEnd}
              ref={mapViewportRef}
              style={{ contain: "size" }}
            >
              <div
                className="relative"
                style={{
                  height: DINING_MAP_WORLD_SIZE * mapScale,
                  width: DINING_MAP_WORLD_SIZE * mapScale
                }}
              >
                <div
                  className="relative"
                  ref={mapSurfaceRef}
                  style={{
                    backgroundColor: "#fbfdff",
                    backgroundImage:
                      "linear-gradient(#dce5ef 1px, transparent 1px), linear-gradient(90deg, #dce5ef 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                    height: DINING_MAP_WORLD_SIZE,
                    transform: `scale(${mapScale})`,
                    transformOrigin: "top left",
                    width: DINING_MAP_WORLD_SIZE
                  }}
                >
                {tables.map((table) => {
                const isRound = isRoundSeatingShape(table.mapType);
                const isDivider = table.mapType === "divider";
                const isServiceShape =
                  table.mapType === "buffet" || table.mapType === "drinks";
                const isSeating = isDiningSeatingTable(table);

                return (
                  <button
                    data-dining-map-object="true"
                    // overflow-visible so the chairs, which sit outside the
                    // table box, are not clipped. The name below clips itself
                    // via line-clamp.
                    className={`absolute flex touch-none cursor-move flex-col items-center justify-center overflow-visible px-1 text-center select-none ${
                      isDivider
                        ? "rounded bg-[#344a60] text-white shadow-none"
                        : "border bg-white shadow-sm"
                    } ${
                      selectedTableIds.includes(table.id)
                        ? "border-[#1f4d73] ring-2 ring-[#8fbce3]"
                        : isServiceShape
                          ? "border-dashed border-[#526c86]"
                          : "border-[#526c86]"
                    } ${isRound ? "rounded-full" : "rounded-lg"}`}
                    key={table.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDiningSelection(table.id, {
                        toggle: event.ctrlKey || event.metaKey
                      });
                    }}
                    onPointerCancel={stopTableDrag}
                    onPointerDown={(event) => startTableDrag(event, table)}
                    onPointerMove={dragTable}
                    onPointerUp={stopTableDrag}
                    style={{
                      left: (table.x ?? 0) + DINING_MAP_WORLD_ORIGIN,
                      top: (table.y ?? 0) + DINING_MAP_WORLD_ORIGIN,
                      width: table.width ?? 72,
                      height: table.height ?? 72,
                      transform: `rotate(${table.rotation ?? 0}deg)`
                    }}
                    type="button"
                  >
                    <TableSeats
                      height={table.height ?? 72}
                      round={isRound}
                      seats={isSeating ? table.seats : 0}
                      sides={
                        table.seatingSides ??
                        getDefaultSeatingSides(table.mapType)
                      }
                      width={table.width ?? 72}
                    />

                    <strong
                      className={`line-clamp-2 leading-3 ${
                        isDivider ? "text-[10px]" : "text-[10px]"
                      }`}
                    >
                      {table.name || `Table ${table.number}`}
                    </strong>
                    {isSeating ? (
                      <>
                        <span className="text-[8px] leading-3">
                          {table.seats} seats
                        </span>
                        <span className="text-[7px] uppercase leading-3 text-[#617086]">
                          {table.side}
                        </span>
                      </>
                    ) : null}
                  </button>
                );
              })}
                </div>
              </div>
            </div>
            </>
          ) : (
            <div className="p-3 sm:p-5">
              <div className="grid grid-cols-3 justify-items-center gap-3 sm:grid-cols-4 sm:gap-5 lg:grid-cols-5">
                {tables.map((table) => (
                  <button
                    className={`flex h-15 w-15 flex-col items-center justify-center rounded-full border bg-white text-center shadow-sm sm:h-16 sm:w-16 ${
                      selectedTableIds.includes(table.id)
                        ? "border-[#1f4d73] ring-2 ring-[#8fbce3]"
                        : "border-[#526c86]"
                    }`}
                    key={table.id}
                    onClick={(event) =>
                      setDiningSelection(table.id, {
                        toggle: event.ctrlKey || event.metaKey
                      })
                    }
                    type="button"
                  >
                    <strong className="text-[10px]">
                      {table.name || `Table ${table.number}`}
                    </strong>
                    <span className="text-[9px]">{table.seats} seats</span>
                    <span className="text-[8px] uppercase text-[#617086]">
                      {table.side}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mx-auto mt-8 flex h-6 max-w-96 items-center justify-center rounded bg-[#344a60] text-[10px] font-black text-white">
                {t("dining.mechitza")}
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
