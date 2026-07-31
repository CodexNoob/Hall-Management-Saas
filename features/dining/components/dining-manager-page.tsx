"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { CompactSelect } from "@/components/ui/compact-select";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";

import { DiningDetailsPanel } from "@/features/dining/components/dining-details-panel";
import { DiningEventListPanel } from "@/features/dining/components/dining-event-list-panel";
import { Panel, FieldLabel } from "@/features/dining/components/dining-panel";
import {
  defaultTables,
  eventCounts,
  eventSchedule,
  eventTitle,
  isDiningSeatingTable,
  validPresetObjects,
  validTables,
  type DiningForm,
  type DiningPlan,
  type DiningPlanPayload,
  type DiningResponse,
  type DiningTableData,
  type TableSide
} from "@/features/dining/components/dining-shared";
export function DiningManagerPage() {
  const diningQuery = useAuthenticatedQuery<DiningResponse>("/api/dining");
  const diningMutation = useAuthenticatedMutation<
    DiningPlanPayload,
    { plan: DiningPlan }
  >("/api/dining", "PATCH");
  const { resetError } = diningMutation;
  const [pageSearchQuery] = useDashboardPageSearch("Dining Manager");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventPage, setEventPage] = useState(1);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [tables, setTables] = useState<DiningTableData[]>([]);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    scaleX: number;
    scaleY: number;
  } | null>(null);
  const [checkMessage, setCheckMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [form, setForm] = useState<DiningForm>({
    countType: "People",
    adultCount: 0,
    childrenCount: 0,
    menWaiters: 0,
    womenWaiters: 0,
    tablecloth: "",
    washingTime: "",
    specialNotes: ""
  });

  const events = useMemo(
    () => diningQuery.data?.events ?? [],
    [diningQuery.data]
  );
  const normalizedSearch = pageSearchQuery.trim().toLowerCase();
  const visibleEvents = events.filter((event) =>
    [
      eventTitle(event),
      event.hall.name,
      event.packageName,
      event.eventStatus,
      eventSchedule(event)
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch)
  );
  const eventPageCount = Math.max(1, Math.ceil(visibleEvents.length / 4));
  const paginatedEvents = visibleEvents.slice(
    (eventPage - 1) * 4,
    eventPage * 4
  );
  const firstEventPage = Math.min(
    Math.max(1, eventPage - 2),
    Math.max(1, eventPageCount - 4)
  );
  const eventPageNumbers = Array.from(
    { length: Math.min(5, eventPageCount) },
    (_, index) => firstEventPage + index
  );
  const selectedEvent =
    events.find((event) => event.id === selectedEventId) ?? events[0] ?? null;
  const availableHallMapPresets = (
    diningQuery.data?.hallMapPresets ?? []
  ).filter((preset) => preset.hallId === selectedEvent?.hall.id);

  useEffect(() => {
    if (!selectedEventId && events[0]) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  useEffect(() => {
    setEventPage(1);
  }, [pageSearchQuery]);

  useEffect(() => {
    setEventPage((current) => Math.min(current, eventPageCount));
  }, [eventPageCount]);

  useEffect(() => {
    if (!selectedEvent) return;
    const counts = eventCounts(selectedEvent);
    const plan = selectedEvent.diningPlan;
    setForm({
      countType: plan?.countType ?? "People",
      adultCount: plan?.adultCount ?? counts.adults,
      childrenCount: plan?.childrenCount ?? counts.children,
      menWaiters: plan?.menWaiters ?? Math.ceil(selectedEvent.waitersCount / 2),
      womenWaiters:
        plan?.womenWaiters ?? Math.floor(selectedEvent.waitersCount / 2),
      tablecloth: plan?.tablecloth ?? selectedEvent.tableclothName ?? "Ivory",
      washingTime: plan?.washingTime ?? selectedEvent.washingTime ?? "",
      specialNotes: plan?.specialNotes ?? selectedEvent.notes ?? ""
    });
    const storedTables = validTables(plan?.tables);
    setTables(storedTables.length ? storedTables : defaultTables());
    setSelectedPresetId(plan?.hallMapPresetId ?? "");
    setSelectedTableId(null);
    setCheckMessage("");
    setSavedMessage("");
    resetError();
  }, [resetError, selectedEvent]);

  const seatTotals = tables.reduce(
    (totals, table) =>
      isDiningSeatingTable(table)
        ? {
            ...totals,
            [table.side]: totals[table.side] + table.seats
          }
        : totals,
    { men: 0, women: 0, kids: 0, head: 0 }
  );
  const menRequired = Math.ceil(form.adultCount / 2);
  const womenRequired = form.adultCount - menRequired;
  const hasPresetCoordinates = tables.some(
    (table) =>
      typeof table.x === "number" &&
      typeof table.y === "number" &&
      typeof table.width === "number" &&
      typeof table.height === "number"
  );

  function updateForm<K extends keyof DiningForm>(
    field: K,
    value: DiningForm[K]
  ) {
    setSavedMessage("");
    resetError();
    setForm((current) => ({ ...current, [field]: value }));
  }

  function mapTypeForSide(side: TableSide) {
    if (side === "kids") return "kids-table";
    if (side === "head") return "head-table";
    return "round-table";
  }

  function addTable(side: TableSide = "men") {
    setSavedMessage("");
    resetError();
    setTables((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        height: side === "head" ? 46 : 58,
        isSeating: true,
        mapType: mapTypeForSide(side),
        number: current.length + 1,
        seats: side === "head" ? 12 : 10,
        side,
        width: side === "head" ? 98 : 58,
        x: 330 + ((current.length % 5) - 2) * 22,
        y: 225 + (Math.floor(current.length / 5) % 5) * 22
      }
    ]);
  }

  function addRequiredTables() {
    const requirements: Array<[TableSide, number]> = [
      ["men", Math.max(0, menRequired - seatTotals.men)],
      ["women", Math.max(0, womenRequired - seatTotals.women)],
      ["kids", Math.max(0, form.childrenCount - seatTotals.kids)]
    ];
    const requiredTableCount = requirements.reduce(
      (total, [, missingSeats]) => total + Math.ceil(missingSeats / 10),
      0
    );
    if (requiredTableCount === 0) {
      setCheckMessage("Seating is already sufficient for this event.");
      return;
    }
    setSavedMessage("");
    resetError();
    setTables((current) => {
      const next = [...current];
      for (const [side, missingSeats] of requirements) {
        const count = Math.ceil(missingSeats / 10);
        for (let index = 0; index < count; index += 1) {
          next.push({
            id: crypto.randomUUID(),
            height: 58,
            isSeating: true,
            mapType: mapTypeForSide(side),
            number: next.length + 1,
            seats: 10,
            side,
            width: 58,
            x: 330 + ((next.length % 5) - 2) * 22,
            y: 225 + (Math.floor(next.length / 5) % 5) * 22
          });
        }
      }
      return next;
    });
    setCheckMessage("Required tables were added to the dining layout.");
  }

  function applyHallMapPreset() {
    const preset = diningQuery.data?.hallMapPresets.find(
      (item) =>
        item.id === selectedPresetId && item.hallId === selectedEvent?.hall.id
    );
    if (!preset) {
      setCheckMessage("Select a map preset assigned to this event's hall.");
      return;
    }

    let adultIndex = 0;
    const presetTables = validPresetObjects(preset.objects).map(
      (object, index): DiningTableData => {
        let side: TableSide;
        if (object.seatingUse === "kids") {
          side = "kids";
        } else if (object.seatingUse === "head") {
          side = "head";
        } else if (object.seatingUse === "adult") {
          side = adultIndex % 2 === 0 ? "men" : "women";
          adultIndex += 1;
        } else {
          side = "men";
        }
        const isSeating = object.seats > 0 && object.seatingUse !== "none";
        return {
          id: crypto.randomUUID(),
          isSeating,
          mapObjectId: object.id,
          mapType: object.type,
          name: object.name,
          number: index + 1,
          rotation: object.rotation,
          seats: object.seats,
          side,
          x: object.x,
          y: object.y,
          width: object.width,
          height: object.height
        };
      }
    );

    setTables(presetTables);
    setSelectedTableId(null);
    setSavedMessage("");
    setCheckMessage(
      `${preset.name} applied with ${
        presetTables.filter(isDiningSeatingTable).length
      } seating tables. Save the dining plan to keep it.`
    );
  }

  function removeSelectedTable() {
    if (!selectedTableId) return;
    setSavedMessage("");
    resetError();
    setTables((current) =>
      current
        .filter((table) => table.id !== selectedTableId)
        .map((table, index) => ({ ...table, number: index + 1 }))
    );
    setSelectedTableId(null);
  }

  function startTableDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    table: DiningTableData
  ) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedTableId(table.id);
    setSavedMessage("");
    resetError();
    const container = event.currentTarget.parentElement;
    const bounds = container?.getBoundingClientRect();
    dragRef.current = {
      id: table.id,
      pointerId: event.pointerId,
      scaleX: bounds ? 760 / bounds.width : 1,
      scaleY: bounds ? 520 / bounds.height : 1,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: table.x ?? 0,
      startY: table.y ?? 0
    };
  }

  function dragTable(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setTables((current) =>
      current.map((table) => {
        if (table.id !== drag.id) return table;
        const width = table.width ?? 72;
        const height = table.height ?? 72;
        const nextX =
          drag.startX + (event.clientX - drag.startClientX) * drag.scaleX;
        const nextY =
          drag.startY + (event.clientY - drag.startClientY) * drag.scaleY;
        return {
          ...table,
          x: Math.min(Math.max(0, nextX), 760 - width),
          y: Math.min(Math.max(0, nextY), 520 - height)
        };
      })
    );
  }

  function stopTableDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }

  async function savePlan() {
    if (!selectedEvent) return;
    try {
      await diningMutation.mutate({
        eventId: selectedEvent.id,
        hallMapPresetId: selectedPresetId || null,
        ...form,
        tablecloth: form.tablecloth || undefined,
        washingTime: form.washingTime || undefined,
        specialNotes: form.specialNotes || undefined,
        tables
      });
      await diningQuery.refetch();
      setSavedMessage("Dining plan saved.");
    } catch {
      // Mutation errors are rendered in the details panel.
    }
  }

  if (diningQuery.isLoading || diningQuery.error || !diningQuery.data) {
    return (
      <DashboardPageState
        error={diningQuery.error}
        isLoading={diningQuery.isLoading}
        onRetry={diningQuery.refetch}
        subtitle="Select an event, adjust the hall layout, and prepare the dining sheet."
        title="Dining Manager"
      />
    );
  }

  if (!selectedEvent) {
    return (
      <DashboardPageState
        emptyMessage="Create an event before preparing a dining plan."
        emptyTitle="No dining events yet"
        isEmpty
        onRetry={diningQuery.refetch}
        subtitle="Select an event, adjust the hall layout, and prepare the dining sheet."
        title="Dining Manager"
      />
    );
  }

  return (
    <div className="flex h-dvh min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        actionsSlot={
          <>
            <button
              className="hidden h-11 rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-bold hover:bg-[#eef4fa] lg:block"
              disabled={!selectedTableId}
              onClick={removeSelectedTable}
              type="button"
            >
              Remove table
            </button>
            <button
              className="flex h-9 w-8 items-center justify-center bg-transparent text-[#1f4d73] lg:h-11 lg:w-auto lg:rounded-xl lg:bg-[#1f4d73] lg:px-4 lg:text-sm lg:font-bold lg:text-white"
              disabled={diningMutation.isPending}
              onClick={savePlan}
              type="button"
            >
              <span className="text-xl lg:hidden">✓</span>
              <span className="hidden lg:inline">
                {diningMutation.isPending ? "Saving..." : "Save dining plan"}
              </span>
            </button>
          </>
        }
        compactMobileActions
        subtitle="Select an event, adjust the hall layout, and prepare the dining sheet."
        title="Dining Manager"
      />

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-2 sm:p-3">
        <div className="mx-auto grid min-h-full w-full min-w-0 max-w-[1800px] gap-3 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(500px,1fr)_310px]">
          <DiningEventListPanel
            eventPage={eventPage}
            eventPageCount={eventPageCount}
            eventPageNumbers={eventPageNumbers}
            onSelectEvent={setSelectedEventId}
            onSetEventPage={setEventPage}
            paginatedEvents={paginatedEvents}
            selectedEvent={selectedEvent}
            visibleEventsCount={visibleEvents.length}
          />

          <Panel className="flex min-h-125 min-w-0 flex-col sm:min-h-155 lg:min-h-[calc(100dvh-120px)] xl:min-h-0">
            <header className="border-b border-[#d8dde5] p-3">
              <h2 className="truncate text-sm font-black">
                {eventTitle(selectedEvent)}
              </h2>
              <p className="mt-1 truncate text-xs text-[#617086]">
                {selectedEvent.hall.name} · {eventSchedule(selectedEvent)}
              </p>
              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[#d8dde5] bg-[#f8fafc] p-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <FieldLabel htmlFor="hall-map-preset">
                    Hall map preset
                  </FieldLabel>
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
                <button
                  className="h-9 shrink-0 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!selectedPresetId}
                  onClick={applyHallMapPreset}
                  type="button"
                >
                  Apply preset
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="h-9 flex-1 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa] sm:flex-none"
                  onClick={() => addTable("men")}
                  type="button"
                >
                  + Adult table
                </button>
                <button
                  className="h-9 flex-1 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa] sm:flex-none"
                  onClick={() => addTable("kids")}
                  type="button"
                >
                  + Kids table
                </button>
                <button
                  className="h-9 flex-1 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa] sm:flex-none"
                  onClick={() => addTable("head")}
                  type="button"
                >
                  + Head table
                </button>
                <button
                  className="h-9 flex-1 whitespace-nowrap rounded-lg border border-[#efb5ad] bg-white px-3 text-xs font-black text-[#b42318] enabled:hover:bg-[#fff4f2] disabled:opacity-40 sm:flex-none"
                  disabled={!selectedTableId}
                  onClick={removeSelectedTable}
                  type="button"
                >
                  Remove selected
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-2">
              <div className="min-h-105 min-w-0 rounded-lg border border-[#bdc9d6] bg-[#fbfdff] bg-[linear-gradient(#dce5ef_1px,transparent_1px),linear-gradient(90deg,#dce5ef_1px,transparent_1px)] bg-size-[21px_21px] p-4 sm:min-h-133.75 sm:p-5">
                {hasPresetCoordinates ? (
                  <div className="relative mx-auto aspect-[760/520] w-full max-w-[760px]">
                    {tables.map((table) => {
                      const isRound =
                        table.mapType === "round-table" ||
                        table.mapType === "kids-table" ||
                        table.mapType === "circle";
                      const isDivider = table.mapType === "divider";
                      const isServiceShape =
                        table.mapType === "buffet" ||
                        table.mapType === "drinks";
                      const isSeating = isDiningSeatingTable(table);

                      return (
                        <button
                          className={`absolute flex touch-none cursor-move flex-col items-center justify-center overflow-hidden px-1 text-center select-none ${
                            isDivider
                              ? "rounded bg-[#344a60] text-white shadow-none"
                              : "border bg-white shadow-sm"
                          } ${
                            selectedTableId === table.id
                              ? "border-[#1f4d73] ring-2 ring-[#8fbce3]"
                              : isServiceShape
                                ? "border-dashed border-[#526c86]"
                                : "border-[#526c86]"
                          } ${isRound ? "rounded-full" : "rounded-lg"}`}
                          key={table.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedTableId(table.id);
                          }}
                          onPointerCancel={stopTableDrag}
                          onPointerDown={(event) =>
                            startTableDrag(event, table)
                          }
                          onPointerMove={dragTable}
                          onPointerUp={stopTableDrag}
                          style={{
                            left: `${((table.x ?? 0) / 760) * 100}%`,
                            top: `${((table.y ?? 0) / 520) * 100}%`,
                            width: `${((table.width ?? 72) / 760) * 100}%`,
                            height: `${((table.height ?? 72) / 520) * 100}%`,
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
                ) : (
                  <>
                    <div className="grid grid-cols-3 justify-items-center gap-5 sm:grid-cols-4 lg:grid-cols-5">
                      {tables.map((table) => (
                        <button
                          className={`flex h-16 w-16 flex-col items-center justify-center rounded-full border bg-white text-center shadow-sm ${
                            selectedTableId === table.id
                              ? "border-[#1f4d73] ring-2 ring-[#8fbce3]"
                              : "border-[#526c86]"
                          }`}
                          key={table.id}
                          onClick={() => setSelectedTableId(table.id)}
                          type="button"
                        >
                          <strong className="text-[10px]">
                            {table.name || `Table ${table.number}`}
                          </strong>
                          <span className="text-[9px]">
                            {table.seats} seats
                          </span>
                          <span className="text-[8px] uppercase text-[#617086]">
                            {table.side}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="mx-auto mt-8 flex h-6 max-w-96 items-center justify-center rounded bg-[#344a60] text-[10px] font-black text-white">
                      Mechitza
                    </div>
                  </>
                )}
              </div>
            </div>
          </Panel>

          <DiningDetailsPanel
            checkMessage={checkMessage}
            diningError={diningMutation.error}
            form={form}
            hasPresetCoordinates={hasPresetCoordinates}
            isSaving={diningMutation.isPending}
            menRequired={menRequired}
            onAddRequiredTables={addRequiredTables}
            onSavePlan={savePlan}
            onSetCheckMessage={setCheckMessage}
            onSetTables={setTables}
            onUpdateForm={updateForm}
            savedMessage={savedMessage}
            seatTotals={seatTotals}
            selectedTable={
              tables.find((table) => table.id === selectedTableId) ?? null
            }
            selectedTableId={selectedTableId}
            womenRequired={womenRequired}
          />
        </div>
      </main>
    </div>
  );
}
