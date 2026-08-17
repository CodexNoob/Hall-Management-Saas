"use client";

import {
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useRef
} from "react";
import { CompactSelect } from "@/components/ui/compact-select";
import { FieldLabel, Panel } from "@/features/dining/components/dining-panel";
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

type DiningEvent = DiningResponse["events"][number];
type HallMapPreset = NonNullable<DiningResponse["hallMapPresets"]>[number];

export function DiningWorkspacePanel({
  addTable,
  availableHallMapPresets,
  dragTable,
  hasPresetCoordinates,
  isWorkspaceExpanded,
  mapScale,
  mapSurfaceRef,
  mapViewportRef,
  onFitMap,
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
  isWorkspaceExpanded: boolean;
  mapScale: number;
  mapSurfaceRef: RefObject<HTMLDivElement | null>;
  mapViewportRef: RefObject<HTMLDivElement | null>;
  onFitMap: () => void;
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
  const smoothScrollRef = useRef<{
    element: HTMLElement | null;
    frame: number | null;
    targetLeft: number;
    targetTop: number;
  }>({
    element: null,
    frame: null,
    targetLeft: 0,
    targetTop: 0
  });

  useEffect(
    () => () => {
      if (smoothScrollRef.current.frame !== null) {
        window.cancelAnimationFrame(smoothScrollRef.current.frame);
      }
    },
    []
  );

  function scrollPageFromMapWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const workspaceScroller = event.currentTarget.closest(
      "[data-dining-workspace-scroll]"
    );
    const mainScroller = event.currentTarget.closest("main");
    const pageScroller =
      workspaceScroller instanceof HTMLElement &&
      workspaceScroller.scrollHeight > workspaceScroller.clientHeight
        ? workspaceScroller
        : mainScroller;

    if (!(pageScroller instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();

    const wheelUnit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? pageScroller.clientHeight
          : 1;
    const scrollState = smoothScrollRef.current;

    if (scrollState.element !== pageScroller) {
      scrollState.element = pageScroller;
      scrollState.targetLeft = pageScroller.scrollLeft;
      scrollState.targetTop = pageScroller.scrollTop;
    }

    scrollState.targetLeft = Math.max(
      0,
      Math.min(
        pageScroller.scrollWidth - pageScroller.clientWidth,
        scrollState.targetLeft + event.deltaX * wheelUnit * 0.42
      )
    );
    scrollState.targetTop = Math.max(
      0,
      Math.min(
        pageScroller.scrollHeight - pageScroller.clientHeight,
        scrollState.targetTop + event.deltaY * wheelUnit * 0.42
      )
    );

    if (scrollState.frame !== null) {
      return;
    }

    const animateScroll = () => {
      const state = smoothScrollRef.current;
      const scroller = state.element;

      if (!scroller) {
        state.frame = null;
        return;
      }

      const nextLeft =
        scroller.scrollLeft + (state.targetLeft - scroller.scrollLeft) * 0.24;
      const nextTop =
        scroller.scrollTop + (state.targetTop - scroller.scrollTop) * 0.24;
      const isSettled =
        Math.abs(nextLeft - state.targetLeft) < 0.5 &&
        Math.abs(nextTop - state.targetTop) < 0.5;

      scroller.scrollLeft = isSettled ? state.targetLeft : nextLeft;
      scroller.scrollTop = isSettled ? state.targetTop : nextTop;
      state.frame = isSettled ? null : window.requestAnimationFrame(animateScroll);
    };

    scrollState.frame = window.requestAnimationFrame(animateScroll);
  }

  return (
    <Panel className="flex min-h-0 min-w-0 flex-col overflow-hidden sm:min-h-125 lg:min-h-[calc(100dvh-120px)] xl:min-h-0">
      <header className="border-b border-[#d8dde5] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black">
              {eventTitle(selectedEvent)}
            </h2>
            <p className="mt-1 truncate text-xs text-[#617086]">
              {selectedEvent.hall.name} Â· {eventSchedule(selectedEvent)}
            </p>
          </div>
          <button
            aria-expanded={isWorkspaceExpanded}
            aria-label={
              isWorkspaceExpanded
                ? "Collapse dining workspace"
                : "Expand dining workspace"
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
            <FieldLabel htmlFor="hall-map-preset">Hall map preset</FieldLabel>
            <CompactSelect
              id="hall-map-preset"
              onChange={(value) => {
                setSelectedPresetId(value);
                setSavedMessage("");
              }}
              options={[
                {
                  label: availableHallMapPresets.length
                    ? "Select a preset"
                    : `No presets assigned to ${selectedEvent.hall.name}`,
                  value: ""
                },
                ...availableHallMapPresets.map((preset) => ({
                  label: preset.name,
                  value: preset.id
                }))
              ]}
              value={selectedPresetId}
            />
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
            Remove selected
          </button>
        </div>
      </header>
      <div
        className={`min-h-0 flex-1 overflow-auto overscroll-contain p-2.5 sm:p-3 lg:block ${
          isWorkspaceExpanded ? "block" : "hidden"
        }`}
        data-dining-workspace-scroll="true"
      >
        <div
          className="relative min-h-90 min-w-0 overflow-hidden rounded-lg border border-[#bdc9d6] bg-[#fbfdff] bg-[linear-gradient(#dce5ef_1px,transparent_1px),linear-gradient(90deg,#dce5ef_1px,transparent_1px)] bg-size-[20px_20px] sm:min-h-133.75"
          onWheel={scrollPageFromMapWheel}
        >
          {savedMessage ? (
            <div
              className="absolute left-1/2 top-3 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full border border-[#9fd9bd] bg-[#ecfdf3] px-4 py-2 text-center text-xs font-black text-[#087047] shadow-lg"
              role="status"
            >
              {savedMessage}
            </div>
          ) : null}
          {hasPresetCoordinates ? (
            <>
            <div
              className="absolute top-3 right-3 z-20 flex overflow-hidden rounded-lg border border-[#9eacbc] bg-white/95 shadow-md backdrop-blur"
              data-dining-map-control="true"
            >
              <button
                aria-label="Zoom dining map out"
                className="h-9 w-9 text-lg font-black hover:bg-[#eef4fa] disabled:opacity-40"
                disabled={mapScale <= DINING_MAP_MIN_SCALE}
                onClick={onZoomOut}
                type="button"
              >
                −
              </button>
              <button
                aria-label="Reset dining map zoom"
                className="h-9 min-w-14 border-x border-[#d8dde5] px-2 text-[10px] font-black hover:bg-[#eef4fa]"
                onClick={onZoomReset}
                type="button"
              >
                {Math.round(mapScale * 100)}%
              </button>
              <button
                aria-label="Zoom dining map in"
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
                Fit
              </button>
            </div>
            <div
              aria-label="Dining map grid"
              className="relative min-h-90 cursor-grab touch-none overflow-hidden active:cursor-grabbing sm:min-h-133.75"
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
                const isRound =
                  table.mapType === "round-table" ||
                  table.mapType === "kids-table" ||
                  table.mapType === "circle";
                const isDivider = table.mapType === "divider";
                const isServiceShape =
                  table.mapType === "buffet" || table.mapType === "drinks";
                const isSeating = isDiningSeatingTable(table);

                return (
                  <button
                    data-dining-map-object="true"
                    className={`absolute flex touch-none cursor-move flex-col items-center justify-center overflow-hidden px-1 text-center select-none ${
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
                Mechitza
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
