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
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import {
  invalidateAuthenticatedQuery,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";

import { DiningDetailsPanel } from "@/features/dining/components/dining-details-panel";
import { DiningWorkspacePanel } from "@/features/dining/components/dining-workspace-panel";
import { DiningEventListPanel } from "@/features/dining/components/dining-event-list-panel";
import {
  buildDiningTablesFromHallMapPresetObjects,
  defaultTables,
  eventCounts,
  eventSchedule,
  eventTitle,
  isDiningSeatingTable,
  validTables,
  type DiningForm,
  type DiningPlan,
  type DiningPlanPayload,
  type DiningResponse,
  type DiningTableData,
  type HallMapPreset,
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
  const [isEventListExpanded, setIsEventListExpanded] = useState(true);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [tables, setTables] = useState<DiningTableData[]>([]);
  const [tableClipboard, setTableClipboard] = useState<DiningTableData[]>([]);
  const undoStackRef = useRef<DiningTableData[][]>([]);
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
    setSelectedTableIds([]);
    setCheckMessage("");
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

  function selectEvent(eventId: string) {
    setSelectedEventId(eventId);
    setSavedMessage("");
  }

  function rememberTablesSnapshot(snapshot = tables) {
    undoStackRef.current = [...undoStackRef.current.slice(-24), snapshot];
  }

  function setDiningSelection(
    tableId: string | null,
    options: { toggle?: boolean } = {}
  ) {
    setSelectedTableIds((current) => {
      if (!tableId) {
        setSelectedTableId(null);
        return [];
      }

      if (!options.toggle) {
        setSelectedTableId(tableId);
        return [tableId];
      }

      const next = current.includes(tableId)
        ? current.filter((id) => id !== tableId)
        : [...current, tableId];
      setSelectedTableId(next.at(-1) ?? null);
      return next;
    });
  }

  function clampTablePosition(table: DiningTableData, x: number, y: number) {
    const width = table.width ?? 72;
    const height = table.height ?? 72;

    return {
      x: Math.min(Math.max(0, x), 760 - width),
      y: Math.min(Math.max(0, y), 520 - height)
    };
  }

  function mapTypeForSide(side: TableSide) {
    if (side === "kids") return "kids-table";
    if (side === "head") return "head-table";
    return "round-table";
  }

  function addTable(side: TableSide = "men") {
    setSavedMessage("");
    resetError();
    rememberTablesSnapshot();
    const id = crypto.randomUUID();
    setTables((current) => [
      ...current,
      {
        id,
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
    setDiningSelection(id);
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
    rememberTablesSnapshot();
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

  function findHallMapPresetForSelectedEvent(presetId: string) {
    return (
      diningQuery.data?.hallMapPresets.find(
        (item) =>
          item.id === presetId && item.hallId === selectedEvent?.hall.id
      ) ?? null
    );
  }

  function setTablesFromPreset(preset: HallMapPreset) {
    const presetTables = buildDiningTablesFromHallMapPresetObjects(
      preset.objects
    );

    setTables(presetTables);
    setSelectedTableId(null);
    setSelectedTableIds([]);
    setSavedMessage("");
    setCheckMessage(
      `${preset.name} previewed with ${
        presetTables.filter(isDiningSeatingTable).length
      } seating tables. Save the dining plan to keep it.`
    );
  }

  function previewHallMapPreset(presetId: string) {
    setSelectedPresetId(presetId);
    setSavedMessage("");
    resetError();

    if (!presetId) {
      setCheckMessage("");
      return;
    }

    const preset = findHallMapPresetForSelectedEvent(presetId);
    if (!preset) {
      setCheckMessage("This preset is not assigned to the selected event's hall.");
      return;
    }

    rememberTablesSnapshot();
    setTablesFromPreset(preset);
  }

  function removeSelectedTable() {
    if (!selectedTableIds.length) return;
    setSavedMessage("");
    resetError();
    rememberTablesSnapshot();
    setTables((current) =>
      current
        .filter((table) => !selectedTableIds.includes(table.id))
        .map((table, index) => ({ ...table, number: index + 1 }))
    );
    setSelectedTableId(null);
    setSelectedTableIds([]);
  }

  function startTableDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    table: DiningTableData
  ) {
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.ctrlKey || event.metaKey) {
      setDiningSelection(table.id, { toggle: true });
    } else if (!selectedTableIds.includes(table.id)) {
      setDiningSelection(table.id);
    }
    setSavedMessage("");
    resetError();
    rememberTablesSnapshot();
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
      invalidateAuthenticatedQuery("/api/events");
      await diningQuery.refetch();
      setSavedMessage("Dining plan saved.");
    } catch {
      // Mutation errors are rendered in the details panel.
    }
  }

  useEffect(() => {
    function isEditableElement(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return (
        target.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      );
    }

    function handleKeyboardShortcuts(event: KeyboardEvent) {
      const isCtrl = event.ctrlKey || event.metaKey;

      if (isCtrl && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void savePlan();
        return;
      }

      if (isEditableElement(event.target)) return;

      const selectedIds = selectedTableIds.length
        ? selectedTableIds
        : selectedTableId
          ? [selectedTableId]
          : [];

      if (isCtrl && event.key.toLowerCase() === "a") {
        event.preventDefault();
        const allIds = tables.map((table) => table.id);
        setSelectedTableIds(allIds);
        setSelectedTableId(allIds.at(-1) ?? null);
        return;
      }

      if (isCtrl && event.key.toLowerCase() === "c") {
        if (!selectedIds.length) return;
        event.preventDefault();
        setTableClipboard(
          tables.filter((table) => selectedIds.includes(table.id))
        );
        return;
      }

      if (isCtrl && event.key.toLowerCase() === "v") {
        if (!tableClipboard.length) return;
        event.preventDefault();
        rememberTablesSnapshot();
        const pastedTables = tableClipboard.map((table, index) => {
          const nextPosition = clampTablePosition(
            table,
            (table.x ?? 0) + 24,
            (table.y ?? 0) + 24
          );

          return {
            ...table,
            ...nextPosition,
            id: crypto.randomUUID(),
            number: tables.length + index + 1
          };
        });
        setTables((current) => [...current, ...pastedTables]);
        setSelectedTableIds(pastedTables.map((table) => table.id));
        setSelectedTableId(pastedTables.at(-1)?.id ?? null);
        setSavedMessage("");
        resetError();
        return;
      }

      if (isCtrl && event.key.toLowerCase() === "z") {
        event.preventDefault();
        const previous = undoStackRef.current.at(-1);
        if (!previous) return;
        undoStackRef.current = undoStackRef.current.slice(0, -1);
        setTables(previous);
        setSelectedTableId(null);
        setSelectedTableIds([]);
        setSavedMessage("");
        resetError();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selectedIds.length) return;
        event.preventDefault();
        rememberTablesSnapshot();
        setTables((current) =>
          current
            .filter((table) => !selectedIds.includes(table.id))
            .map((table, index) => ({ ...table, number: index + 1 }))
        );
        setSelectedTableId(null);
        setSelectedTableIds([]);
        setSavedMessage("");
        resetError();
        return;
      }

      const movementByKey: Record<string, [number, number]> = {
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1]
      };
      const movement = movementByKey[event.key];

      if (!movement || !selectedIds.length) return;

      event.preventDefault();
      rememberTablesSnapshot();
      const step = event.shiftKey ? 10 : 1;
      setTables((current) =>
        current.map((table) => {
          if (!selectedIds.includes(table.id)) return table;
          return {
            ...table,
            ...clampTablePosition(
              table,
              (table.x ?? 0) + movement[0] * step,
              (table.y ?? 0) + movement[1] * step
            )
          };
        })
      );
      setSavedMessage("");
      resetError();
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);

    return () => window.removeEventListener("keydown", handleKeyboardShortcuts);
  // The shortcut listener is intentionally keyed to editor state; helper
  // functions are recreated by the component but read the same state below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    resetError,
    form,
    selectedTableId,
    selectedTableIds,
    selectedEvent,
    selectedPresetId,
    tableClipboard,
    tables
  ]);

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
              disabled={!selectedTableIds.length}
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
              <span className="text-xl lg:hidden">âœ“</span>
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
            isExpanded={isEventListExpanded}
            onSelectEvent={selectEvent}
            onSetEventPage={setEventPage}
            onToggleExpanded={() =>
              setIsEventListExpanded((isExpanded) => !isExpanded)
            }
            paginatedEvents={paginatedEvents}
            selectedEvent={selectedEvent}
            visibleEventsCount={visibleEvents.length}
          />

          <DiningWorkspacePanel
            addTable={addTable}
            availableHallMapPresets={availableHallMapPresets}
            dragTable={dragTable}
            hasPresetCoordinates={hasPresetCoordinates}
            isWorkspaceExpanded={isWorkspaceExpanded}
            removeSelectedTable={removeSelectedTable}
            savedMessage={savedMessage}
            selectedEvent={selectedEvent}
            selectedPresetId={selectedPresetId}
            selectedTableIds={selectedTableIds}
            setDiningSelection={setDiningSelection}
            setIsWorkspaceExpanded={setIsWorkspaceExpanded}
            setSavedMessage={setSavedMessage}
            setSelectedPresetId={previewHallMapPreset}
            startTableDrag={startTableDrag}
            stopTableDrag={stopTableDrag}
            tables={tables}
          />

          <div
            className={`xl:block ${isWorkspaceExpanded ? "block" : "hidden"}`}
          >
            <DiningDetailsPanel
              checkMessage={checkMessage}
              diningError={diningMutation.error}
              form={form}
              hasPresetCoordinates={hasPresetCoordinates}
              isSaving={diningMutation.isPending}
              menRequired={menRequired}
              onAddRequiredTables={addRequiredTables}
              onSetCheckMessage={setCheckMessage}
              onSetTables={setTables}
              onUpdateForm={updateForm}
              seatTotals={seatTotals}
              selectedTable={
                tables.find((table) => table.id === selectedTableId) ?? null
              }
              selectedTableId={selectedTableId}
              womenRequired={womenRequired}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
