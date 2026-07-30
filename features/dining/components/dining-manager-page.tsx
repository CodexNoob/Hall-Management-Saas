"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { CompactSelect } from "@/components/ui/compact-select";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";

import { Panel, FieldLabel } from "@/features/dining/components/dining-panel";
import { SeatingRow } from "@/features/dining/components/dining-seating-row";
import {
  defaultTables,
  eventCounts,
  eventSchedule,
  eventTitle,
  tableclothOptions,
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
    (totals, table) => ({
      ...totals,
      [table.side]: totals[table.side] + table.seats
    }),
    { men: 0, women: 0, kids: 0, head: 0 }
  );
  const menRequired = Math.ceil(form.adultCount / 2);
  const womenRequired = form.adultCount - menRequired;

  function updateForm<K extends keyof DiningForm>(
    field: K,
    value: DiningForm[K]
  ) {
    setSavedMessage("");
    resetError();
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addTable(side: TableSide = "men") {
    setTables((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        number: current.length + 1,
        seats: side === "head" ? 12 : 10,
        side
      }
    ]);
  }

  function addRequiredTables() {
    const requirements: Array<[TableSide, number]> = [
      ["men", Math.max(0, menRequired - seatTotals.men)],
      ["women", Math.max(0, womenRequired - seatTotals.women)],
      ["kids", Math.max(0, form.childrenCount - seatTotals.kids)]
    ];
    setTables((current) => {
      const next = [...current];
      for (const [side, missingSeats] of requirements) {
        const count = Math.ceil(missingSeats / 10);
        for (let index = 0; index < count; index += 1) {
          next.push({
            id: crypto.randomUUID(),
            number: next.length + 1,
            seats: 10,
            side
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
    const presetTables = validPresetObjects(preset.objects)
      .filter((object) => object.seats > 0 && object.seatingUse !== "none")
      .map((object, index): DiningTableData => {
        let side: TableSide;
        if (object.seatingUse === "kids") {
          side = "kids";
        } else if (object.seatingUse === "head") {
          side = "head";
        } else {
          side = adultIndex % 2 === 0 ? "men" : "women";
          adultIndex += 1;
        }
        return {
          id: crypto.randomUUID(),
          number: index + 1,
          seats: object.seats,
          side
        };
      });

    setTables(presetTables);
    setSelectedTableId(null);
    setSavedMessage("");
    setCheckMessage(
      `${preset.name} applied with ${presetTables.length} seating tables. Save the dining plan to keep it.`
    );
  }

  function removeSelectedTable() {
    if (!selectedTableId) return;
    setTables((current) =>
      current
        .filter((table) => table.id !== selectedTableId)
        .map((table, index) => ({ ...table, number: index + 1 }))
    );
    setSelectedTableId(null);
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
          <Panel>
            <header className="border-b border-[#d8dde5] px-3 py-2">
              <h2 className="text-sm font-black">Events</h2>
              <p className="mt-1 text-xs text-[#617086]">
                Select an organization event.
              </p>
            </header>
            <div className="max-h-80 space-y-2 overflow-y-auto p-2 lg:max-h-none">
              {paginatedEvents.map((event) => {
                const counts = eventCounts(event);
                return (
                  <button
                    className={`w-full rounded-xl border p-3 text-left ${
                      selectedEvent.id === event.id
                        ? "border-[#1f5f91] bg-[#eef6fc]"
                        : "border-[#c9d2de] bg-white hover:bg-[#f8fafc]"
                    }`}
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    type="button"
                  >
                    <strong className="block truncate text-sm">
                      {eventTitle(event)}
                    </strong>
                    <p className="mt-1 text-xs leading-5 text-[#55708d]">
                      {event.hall.name} · {eventSchedule(event)} ·{" "}
                      {counts.adults + counts.children} guests
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded-full border border-[#b9ddcf] bg-[#effbf6] px-2 py-0.5 text-[10px] font-black text-[#087047]">
                        {event.eventStatus}
                      </span>
                      {event.diningPlan ? (
                        <span className="rounded-full border border-[#b9c2cf] bg-white px-2 py-0.5 text-[10px] font-black">
                          Plan saved
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
              {visibleEvents.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#c7d0dc] p-4 text-center text-xs font-bold text-[#617086]">
                  No events match the search.
                </p>
              ) : null}
              {visibleEvents.length > 0 ? (
                <nav
                  aria-label="Dining event pages"
                  className="flex flex-wrap items-center justify-center gap-1 border-t border-[#d8dde5] pt-3"
                >
                  <button
                    aria-label="Previous event page"
                    className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-[#b9c2cf] bg-white px-2 text-xs font-black enabled:hover:bg-[#eef4fa] disabled:opacity-40"
                    disabled={eventPage === 1}
                    onClick={() =>
                      setEventPage((current) => Math.max(1, current - 1))
                    }
                    type="button"
                  >
                    ‹
                  </button>
                  {eventPageNumbers.map((page) => (
                    <button
                      aria-current={eventPage === page ? "page" : undefined}
                      className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-black ${
                        eventPage === page
                          ? "border-[#1f4d73] bg-[#1f4d73] text-white"
                          : "border-[#b9c2cf] bg-white hover:bg-[#eef4fa]"
                      }`}
                      key={page}
                      onClick={() => setEventPage(page)}
                      type="button"
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    aria-label="Next event page"
                    className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-[#b9c2cf] bg-white px-2 text-xs font-black enabled:hover:bg-[#eef4fa] disabled:opacity-40"
                    disabled={eventPage === eventPageCount}
                    onClick={() =>
                      setEventPage((current) =>
                        Math.min(eventPageCount, current + 1)
                      )
                    }
                    type="button"
                  >
                    ›
                  </button>
                </nav>
              ) : null}
            </div>
          </Panel>

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
                        Table {table.number}
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
            </div>
          </Panel>

          <Panel className="min-w-0 lg:col-span-2 xl:col-span-1">
            <header className="border-b border-[#d8dde5] px-3 py-2">
              <h2 className="text-sm font-black">Dining details</h2>
              <p className="mt-1 text-xs text-[#617086]">
                Event-specific setup saved to Supabase.
              </p>
            </header>
            <div className="space-y-3 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="count-type">Count type</FieldLabel>
                  <CompactSelect
                    id="count-type"
                    onChange={(value) =>
                      updateForm("countType", value as DiningForm["countType"])
                    }
                    options={[
                      { label: "People", value: "People" },
                      { label: "Couples", value: "Couples" }
                    ]}
                    value={form.countType}
                  />
                </div>
                {[
                  ["adultCount", "Adults"],
                  ["childrenCount", "Children"],
                  ["menWaiters", "Men waiters"],
                  ["womenWaiters", "Women waiters"]
                ].map(([field, label]) => (
                  <div key={field}>
                    <FieldLabel htmlFor={field}>{label}</FieldLabel>
                    <input
                      className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm"
                      id={field}
                      min="0"
                      onChange={(event) =>
                        updateForm(
                          field as keyof Pick<
                            DiningForm,
                            | "adultCount"
                            | "childrenCount"
                            | "menWaiters"
                            | "womenWaiters"
                          >,
                          Number(event.target.value)
                        )
                      }
                      type="number"
                      value={form[field as keyof DiningForm] as number}
                    />
                  </div>
                ))}
                <div>
                  <FieldLabel htmlFor="tablecloth">Tablecloth</FieldLabel>
                  <CompactSelect
                    id="tablecloth"
                    onChange={(value) => updateForm("tablecloth", value)}
                    options={tableclothOptions.map((option) => ({
                      label: option,
                      value: option
                    }))}
                    value={form.tablecloth ?? ""}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="washing-time">Washing time</FieldLabel>
                  <input
                    className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm"
                    id="washing-time"
                    onChange={(event) =>
                      updateForm("washingTime", event.target.value)
                    }
                    type="time"
                    value={form.washingTime}
                  />
                </div>
              </div>

              {selectedTableId ? (
                <div className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
                  <FieldLabel htmlFor="table-side">
                    Selected table use
                  </FieldLabel>
                  <CompactSelect
                    id="table-side"
                    onChange={(value) =>
                      setTables((current) =>
                        current.map((table) =>
                          table.id === selectedTableId
                            ? {
                                ...table,
                                side: value as TableSide
                              }
                            : table
                        )
                      )
                    }
                    options={[
                      { label: "Men", value: "men" },
                      { label: "Women", value: "women" },
                      { label: "Kids", value: "kids" },
                      { label: "Head table", value: "head" }
                    ]}
                    value={
                      tables.find((table) => table.id === selectedTableId)
                        ?.side ?? "men"
                    }
                  />
                </div>
              ) : null}

              <section className="rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-3">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-[#59677c]">
                  Seating check
                </h3>
                <div className="mt-3 space-y-3">
                  <SeatingRow
                    current={seatTotals.men}
                    label="Men"
                    maximum={menRequired}
                  />
                  <SeatingRow
                    current={seatTotals.women}
                    label="Women"
                    maximum={womenRequired}
                  />
                  <SeatingRow
                    current={seatTotals.kids}
                    label="Kids"
                    maximum={form.childrenCount}
                  />
                </div>
                {checkMessage ? (
                  <p className="mt-3 text-xs font-bold text-[#315573]">
                    {checkMessage}
                  </p>
                ) : null}
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <button
                    className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-2 text-[10px] font-black hover:bg-[#eef4fa]"
                    onClick={() =>
                      setCheckMessage(
                        seatTotals.men >= menRequired &&
                          seatTotals.women >= womenRequired &&
                          seatTotals.kids >= form.childrenCount
                          ? "Seating is sufficient for all guests."
                          : "More seating is required."
                      )
                    }
                    type="button"
                  >
                    Check seating
                  </button>
                  <button
                    className="h-9 min-w-0 whitespace-nowrap rounded-lg bg-[#1f4d73] px-3 text-[10px] font-black text-white hover:bg-[#15344f]"
                    onClick={addRequiredTables}
                    type="button"
                  >
                    Add required tables
                  </button>
                </div>
              </section>

              <div>
                <FieldLabel htmlFor="special-notes">Special notes</FieldLabel>
                <textarea
                  className="min-h-20 w-full resize-y rounded-lg border border-[#b9c2cf] px-2 py-2 text-xs"
                  id="special-notes"
                  onChange={(event) =>
                    updateForm("specialNotes", event.target.value)
                  }
                  value={form.specialNotes}
                />
              </div>
              {diningMutation.error ? (
                <p className="text-xs font-bold text-[#b42318]">
                  {diningMutation.error}
                </p>
              ) : null}
              {savedMessage ? (
                <p className="text-xs font-bold text-[#087047]">
                  {savedMessage}
                </p>
              ) : null}
              <button
                className="h-10 w-full rounded-lg bg-[#1f4d73] text-sm font-black text-white hover:bg-[#15344f] disabled:opacity-50"
                disabled={diningMutation.isPending}
                onClick={savePlan}
                type="button"
              >
                {diningMutation.isPending ? "Saving..." : "Save dining plan"}
              </button>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
