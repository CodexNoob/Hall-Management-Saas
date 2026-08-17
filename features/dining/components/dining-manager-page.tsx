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
  cloneDiningLayoutTables,
  defaultTables,
  DINING_MAP_MAX_SCALE,
  DINING_MAP_MIN_SCALE,
  DINING_MAP_WORLD_ORIGIN,
  DINING_MAP_WORLD_SIZE,
  diningTableRequirements,
  findMatchingDiningLayout,
  generateDiningAutoLayout,
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
  const [mapScale, setMapScale] = useState(1);
  const mapScaleRef = useRef(1);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const mapSurfaceRef = useRef<HTMLDivElement>(null);
  const mapPanRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const [tableClipboard, setTableClipboard] = useState<DiningTableData[]>([]);
  const undoStackRef = useRef<DiningTableData[][]>([]);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
    scaleX: number;
    scaleY: number;
  } | null>(null);
  const [checkMessage, setCheckMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const savedMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
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
    const nextTables = storedTables.length ? storedTables : defaultTables();
    setTables(nextTables);
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

  useEffect(() => {
    mapScaleRef.current = mapScale;
  }, [mapScale]);

  useEffect(() => {
    if (!hasPresetCoordinates) return;

    mapScaleRef.current = 1;
    setMapScale(1);
    window.requestAnimationFrame(() => {
      const viewport = mapViewportRef.current;
      if (!viewport) return;
      viewport.scrollTo({
        left: DINING_MAP_WORLD_ORIGIN - viewport.clientWidth / 2,
        top: DINING_MAP_WORLD_ORIGIN - viewport.clientHeight / 2
      });
    });
  }, [hasPresetCoordinates, selectedEventId]);

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

  function showSavedMessage(message: string) {
    if (savedMessageTimerRef.current) {
      clearTimeout(savedMessageTimerRef.current);
    }

    setSavedMessage(message);
    savedMessageTimerRef.current = setTimeout(() => {
      setSavedMessage("");
      savedMessageTimerRef.current = null;
    }, 2600);
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
      x: Math.round(
        Math.min(
          Math.max(-DINING_MAP_WORLD_ORIGIN, x),
          DINING_MAP_WORLD_ORIGIN - width
        )
      ),
      y: Math.round(
        Math.min(
          Math.max(-DINING_MAP_WORLD_ORIGIN, y),
          DINING_MAP_WORLD_ORIGIN - height
        )
      )
    };
  }

  function setDiningMapZoom(nextScale: number) {
    const viewport = mapViewportRef.current;
    const previousScale = mapScaleRef.current || 1;
    const scale = Math.min(
      DINING_MAP_MAX_SCALE,
      Math.max(DINING_MAP_MIN_SCALE, nextScale)
    );

    if (!viewport) {
      mapScaleRef.current = scale;
      setMapScale(scale);
      return;
    }

    const worldCenter = {
      x: (viewport.scrollLeft + viewport.clientWidth / 2) / previousScale,
      y: (viewport.scrollTop + viewport.clientHeight / 2) / previousScale
    };
    mapScaleRef.current = scale;
    setMapScale(scale);
    window.requestAnimationFrame(() => {
      const currentViewport = mapViewportRef.current;
      if (!currentViewport) return;
      currentViewport.scrollTo({
        left: Math.max(
          0,
          worldCenter.x * scale - currentViewport.clientWidth / 2
        ),
        top: Math.max(
          0,
          worldCenter.y * scale - currentViewport.clientHeight / 2
        )
      });
    });
  }

  function fitDiningMapTables(tablesToFit = tables) {
    const viewport = mapViewportRef.current;
    const positionedTables = tablesToFit.filter(
      (table) => typeof table.x === "number" && typeof table.y === "number"
    );
    if (!viewport || !positionedTables.length) return;

    const bounds = positionedTables.reduce(
      (current, table) => ({
        minX: Math.min(current.minX, table.x ?? 0),
        minY: Math.min(current.minY, table.y ?? 0),
        maxX: Math.max(current.maxX, (table.x ?? 0) + (table.width ?? 72)),
        maxY: Math.max(current.maxY, (table.y ?? 0) + (table.height ?? 72))
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
    );
    const scale = Math.min(
      (viewport.clientWidth - 64) / Math.max(1, bounds.maxX - bounds.minX),
      (viewport.clientHeight - 64) / Math.max(1, bounds.maxY - bounds.minY)
    );
    const nextScale = Math.min(
      DINING_MAP_MAX_SCALE,
      Math.max(DINING_MAP_MIN_SCALE, scale)
    );
    mapScaleRef.current = nextScale;
    setMapScale(nextScale);
    window.requestAnimationFrame(() => {
      const currentViewport = mapViewportRef.current;
      if (!currentViewport) return;
      currentViewport.scrollTo({
        left:
          (DINING_MAP_WORLD_ORIGIN + (bounds.minX + bounds.maxX) / 2) *
            nextScale -
          currentViewport.clientWidth / 2,
        top:
          (DINING_MAP_WORLD_ORIGIN + (bounds.minY + bounds.maxY) / 2) *
            nextScale -
          currentViewport.clientHeight / 2
      });
    });
  }

  function startDiningMapPan(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = mapViewportRef.current;
    if (event.button !== 0 || !viewport) return;
    if (
      event.target instanceof Element &&
      event.target.closest("[data-dining-map-object], [data-dining-map-control]")
    ) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    mapPanRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop
    };
  }

  function panDiningMap(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = mapPanRef.current;
    const viewport = mapViewportRef.current;
    if (!pan || pan.pointerId !== event.pointerId || !viewport) return;
    event.preventDefault();
    viewport.scrollLeft = pan.startScrollLeft - (event.clientX - pan.startClientX);
    viewport.scrollTop = pan.startScrollTop - (event.clientY - pan.startClientY);
  }

  function stopDiningMapPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (mapPanRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    mapPanRef.current = null;
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

  function autoLayoutTables() {
    if (!selectedEvent) return;

    const requirements = diningTableRequirements({
      childrenCount: form.childrenCount,
      menRequired,
      womenRequired
    });
    const previousEvent = findMatchingDiningLayout({
      currentEventId: selectedEvent.id,
      events,
      requirements
    });
    const nextTables = previousEvent?.diningPlan
      ? cloneDiningLayoutTables(validTables(previousEvent.diningPlan.tables))
      : generateDiningAutoLayout(requirements);

    setSavedMessage("");
    resetError();
    rememberTablesSnapshot();
    setTables(nextTables);
    setSelectedTableId(null);
    setSelectedTableIds([]);
    window.requestAnimationFrame(() => fitDiningMapTables(nextTables));
    setCheckMessage(
      previousEvent
        ? `Auto layout reused ${eventTitle(previousEvent)} because it has the same table count.`
        : "Auto layout generated the required men, women, and kids tables."
    );
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
    window.requestAnimationFrame(() => fitDiningMapTables(presetTables));
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
    const bounds = mapSurfaceRef.current?.getBoundingClientRect();
    dragRef.current = {
      id: table.id,
      pointerId: event.pointerId,
      scaleX: bounds ? DINING_MAP_WORLD_SIZE / bounds.width : 1,
      scaleY: bounds ? DINING_MAP_WORLD_SIZE / bounds.height : 1,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: table.x ?? 0,
      startY: table.y ?? 0,
      startScrollLeft: mapViewportRef.current?.scrollLeft ?? 0,
      startScrollTop: mapViewportRef.current?.scrollTop ?? 0
    };
  }

  function dragTable(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const viewport = mapViewportRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !viewport) return;
    const viewportBounds = viewport.getBoundingClientRect();
    const edge = 48;
    const panStep = 24;
    if (event.clientX < viewportBounds.left + edge) viewport.scrollLeft -= panStep;
    if (event.clientX > viewportBounds.right - edge) viewport.scrollLeft += panStep;
    if (event.clientY < viewportBounds.top + edge) viewport.scrollTop -= panStep;
    if (event.clientY > viewportBounds.bottom - edge) viewport.scrollTop += panStep;
    setTables((current) =>
      current.map((table) => {
        if (table.id !== drag.id) return table;
        const width = table.width ?? 72;
        const height = table.height ?? 72;
        const nextX =
          drag.startX +
          (event.clientX - drag.startClientX +
            viewport.scrollLeft -
            drag.startScrollLeft) *
            drag.scaleX;
        const nextY =
          drag.startY +
          (event.clientY - drag.startClientY +
            viewport.scrollTop -
            drag.startScrollTop) *
            drag.scaleY;
        return {
          ...table,
          x: Math.min(
            Math.max(-DINING_MAP_WORLD_ORIGIN, nextX),
            DINING_MAP_WORLD_ORIGIN - width
          ),
          y: Math.min(
            Math.max(-DINING_MAP_WORLD_ORIGIN, nextY),
            DINING_MAP_WORLD_ORIGIN - height
          )
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
      showSavedMessage("Dining plan saved.");
    } catch {
      // Mutation errors are rendered in the details panel.
    }
  }

  useEffect(
    () => () => {
      if (savedMessageTimerRef.current) {
        clearTimeout(savedMessageTimerRef.current);
      }
    },
    []
  );

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
              aria-label={
                diningMutation.isPending
                  ? "Saving dining plan"
                  : "Save dining plan"
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-transparent text-[#1f4d73] shadow-none transition enabled:hover:text-[#15344f] disabled:cursor-not-allowed disabled:opacity-45 lg:h-11 lg:w-auto lg:whitespace-nowrap lg:rounded-xl lg:bg-[#1f4d73] lg:px-4 lg:text-sm lg:font-bold lg:text-white lg:shadow-sm lg:enabled:hover:bg-[#15344f] lg:enabled:hover:text-white"
              disabled={diningMutation.isPending}
              onClick={savePlan}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-6 w-6 lg:hidden"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M5 4h12l2 2v14H5z" />
                <path d="M8 4v6h8V4M8 20v-6h8v6" />
              </svg>
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

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 sm:p-3">
        <div className="mx-auto grid min-h-full w-full min-w-0 max-w-[1800px] gap-3 sm:gap-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(500px,1fr)_310px]">
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
            mapScale={mapScale}
            mapSurfaceRef={mapSurfaceRef}
            mapViewportRef={mapViewportRef}
            onFitMap={fitDiningMapTables}
            onMapPanEnd={stopDiningMapPan}
            onMapPanMove={panDiningMap}
            onMapPanStart={startDiningMapPan}
            onZoomIn={() => setDiningMapZoom(mapScaleRef.current * 1.25)}
            onZoomOut={() => setDiningMapZoom(mapScaleRef.current / 1.25)}
            onZoomReset={() => setDiningMapZoom(1)}
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
              onAutoLayoutTables={autoLayoutTables}
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
