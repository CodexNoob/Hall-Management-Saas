"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { CompactSelect } from "@/components/ui/compact-select";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { HallMapLibraryPanel } from "@/features/hall-room-map/components/hall-map-library-panel";
import { MapObjectView } from "@/features/hall-room-map/components/hall-map-object-view";
import { HallMapObjectInspector } from "@/features/hall-room-map/components/hall-map-object-inspector";
import { Panel } from "@/features/hall-room-map/components/hall-map-panel";
import {
  DESIGN_MAP_HEIGHT,
  DESIGN_MAP_WIDTH,
  HALL_MAP_STORAGE_KEY,
  MAP_VIEWPORT_PADDING,
  clampViewportPosition,
  getMapObjectBounds,
  initialHallMaps,
  type HallMapsResponse,
  type MapObject,
  type SaveHallMapInput,
  type SavedHallMap,
  type ShapeType
} from "@/features/hall-room-map/components/hall-map-shared";
export function HallRoomMapPage() {
  const hallMapsQuery =
    useAuthenticatedQuery<HallMapsResponse>("/api/hall-maps");
  const createMapMutation = useAuthenticatedMutation<
    SaveHallMapInput,
    { preset: SavedHallMap }
  >("/api/hall-maps", "POST");
  const updateMapMutation = useAuthenticatedMutation<
    SaveHallMapInput & { id: string },
    { preset: SavedHallMap }
  >("/api/hall-maps", "PATCH");
  const deleteMapMutation = useAuthenticatedMutation<
    { id: string },
    { deleted: true }
  >("/api/hall-maps", "DELETE");
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [hallMaps, setHallMaps] = useState<SavedHallMap[]>(initialHallMaps);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [selectedMapId, setSelectedMapId] = useState("");
  const [selectedHallId, setSelectedHallId] = useState("");
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [mapDialogMode, setMapDialogMode] = useState<"create" | "rename">(
    "create"
  );
  const [mapName, setMapName] = useState("");
  const [mapHallId, setMapHallId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [mapScale, setMapScale] = useState(1);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const latestObjectsRef = useRef<MapObject[]>(objects);
  const objectClipboardRef = useRef<MapObject[]>([]);
  const undoStackRef = useRef<MapObject[][]>([]);
  const mapScaleRef = useRef(1);
  const panRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
    moved: boolean;
  } | null>(null);
  const suppressNextMapClickRef = useRef(false);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latestObjectsRef.current = objects;
  }, [objects]);

  useEffect(() => {
    mapScaleRef.current = mapScale;
  }, [mapScale]);

  const centerMapViewport = useCallback((nextObjects?: MapObject[]) => {
    window.requestAnimationFrame(() => {
      const viewport = mapViewportRef.current;
      const map = mapRef.current;

      if (!viewport || !map) {
        return;
      }

      const targetObjects = nextObjects ?? latestObjectsRef.current;
      const bounds = getMapObjectBounds(targetObjects);
      const maxLeft = viewport.scrollWidth - viewport.clientWidth;
      const maxTop = viewport.scrollHeight - viewport.clientHeight;

      if (!bounds) {
        viewport.scrollTo({
          left: clampViewportPosition(maxLeft / 2, maxLeft),
          top: clampViewportPosition(maxTop / 2, maxTop)
        });
        return;
      }

      const scale = mapScaleRef.current;
      const centerX = ((bounds.minX + bounds.maxX) / 2) * scale;
      const centerY = ((bounds.minY + bounds.maxY) / 2) * scale;

      viewport.scrollTo({
        left: clampViewportPosition(
          centerX - viewport.clientWidth / 2 + MAP_VIEWPORT_PADDING,
          maxLeft
        ),
        top: clampViewportPosition(
          centerY - viewport.clientHeight / 2 + MAP_VIEWPORT_PADDING,
          maxTop
        )
      });
    });
  }, []);

  const updateMapScale = useCallback(() => {
    const viewport = mapViewportRef.current;

    if (!viewport) {
      return;
    }

    const availableWidth = Math.max(0, viewport.clientWidth - 16);
    const nextScale = Math.min(1, availableWidth / DESIGN_MAP_WIDTH);

    mapScaleRef.current = nextScale;
    setMapScale((current) =>
      Math.abs(current - nextScale) < 0.01 ? current : nextScale
    );
    centerMapViewport();
  }, [centerMapViewport]);

  const selectedObject =
    objects.find((object) => object.id === selectedObjectId) ?? null;
  const selectedObjectIdSet = new Set(selectedObjectIds);
  const selectedMap = hallMaps.find((map) => map.id === selectedMapId) ?? null;
  const hasSelectedHall = Boolean(selectedHallId);
  const hasSelectedMap = Boolean(
    selectedMap && selectedMap.hallId === selectedHallId
  );
  const selectedHallMaps = hallMaps.filter(
    (map) => map.hallId === selectedHallId
  );

  useEffect(() => {
    window.localStorage.removeItem(HALL_MAP_STORAGE_KEY);
    setHallMaps((current) => current.filter((map) => Boolean(map.hallId)));
    centerMapViewport();
  }, [centerMapViewport]);

  useEffect(() => {
    updateMapScale();

    const viewport = mapViewportRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && viewport
        ? new ResizeObserver(updateMapScale)
        : null;

    if (resizeObserver && viewport) {
      resizeObserver.observe(viewport);
    }

    window.addEventListener("resize", updateMapScale);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateMapScale);
    };
  }, [selectedMapId, updateMapScale]);

  useEffect(() => {
    if (!hallMapsQuery.data) return;
    const hallMapData = hallMapsQuery.data;

    window.localStorage.removeItem(HALL_MAP_STORAGE_KEY);
    const nextMaps = hallMapData.presets.filter((map) => Boolean(map.hallId));
    setHallMaps(nextMaps);
    setSelectedHallId((currentHallId) => {
      const nextHallId = hallMapData.halls.some(
        (hall) => hall.id === currentHallId
      )
        ? currentHallId
        : "";
      setSelectedMapId((currentMapId) => {
        if (!nextHallId) {
          setObjects([]);
          clearObjectSelection();
          return "";
        }
        const currentMap = nextMaps.find(
          (map) => map.id === currentMapId && map.hallId === nextHallId
        );
        const nextMap =
          currentMap ??
          nextMaps.find((map) => map.hallId === nextHallId) ??
          null;
        setObjects(nextMap?.objects.map((object) => ({ ...object })) ?? []);
        return nextMap?.id ?? "";
      });
      return nextHallId;
    });
  }, [hallMapsQuery.data]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    },
    []
  );

  function showFeedback(message: string) {
    setFeedback(message);
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = setTimeout(() => setFeedback(""), 2600);
  }

  function rememberObjectsSnapshot(snapshot = latestObjectsRef.current) {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-24),
      snapshot.map((object) => ({ ...object }))
    ];
  }

  function clearObjectSelection() {
    setSelectedObjectId(null);
    setSelectedObjectIds([]);
  }

  function selectSingleObject(objectId: string | null) {
    setSelectedObjectId(objectId);
    setSelectedObjectIds(objectId ? [objectId] : []);
  }

  function selectObjectFromPointer(
    objectId: string,
    event: Pick<ReactPointerEvent<HTMLButtonElement>, "ctrlKey" | "metaKey">
  ) {
    if (!event.ctrlKey && !event.metaKey) {
      selectSingleObject(objectId);
      return;
    }

    setSelectedObjectIds((current) => {
      const exists = current.includes(objectId);
      const next = exists
        ? current.filter((id) => id !== objectId)
        : [...current, objectId];

      setSelectedObjectId(next.at(-1) ?? null);
      return next;
    });
  }

  function clampObjectPosition(object: MapObject, x: number, y: number) {
    return {
      x: Math.round(
        Math.min(Math.max(0, x), Math.max(0, DESIGN_MAP_WIDTH - object.width))
      ),
      y: Math.round(
        Math.min(Math.max(0, y), Math.max(0, DESIGN_MAP_HEIGHT - object.height))
      )
    };
  }

  function getActiveObjectIds() {
    return selectedObjectIds.length
      ? selectedObjectIds
      : selectedObjectId
        ? [selectedObjectId]
        : [];
  }

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return Boolean(
        target.closest("input, textarea, select, [contenteditable='true']")
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      const isModifier = event.ctrlKey || event.metaKey;

      if (isModifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveCurrentMap();
        return;
      }

      if (!hasSelectedMap || isTypingTarget(event.target)) {
        return;
      }

      const activeIds = getActiveObjectIds();
      const activeIdSet = new Set(activeIds);

      if (isModifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        const allIds = latestObjectsRef.current.map((object) => object.id);
        setSelectedObjectIds(allIds);
        setSelectedObjectId(allIds.at(-1) ?? null);
        showFeedback(allIds.length ? `${allIds.length} shapes selected.` : "No shapes to select.");
        return;
      }

      if (isModifier && event.key.toLowerCase() === "c") {
        if (!activeIds.length) return;
        event.preventDefault();
        objectClipboardRef.current = latestObjectsRef.current
          .filter((object) => activeIdSet.has(object.id))
          .map((object) => ({ ...object }));
        showFeedback(`${objectClipboardRef.current.length} shape copied.`);
        return;
      }

      if (isModifier && event.key.toLowerCase() === "v") {
        const copiedObjects = objectClipboardRef.current;
        if (!copiedObjects.length) return;
        event.preventDefault();
        rememberObjectsSnapshot();
        const pastedObjects = copiedObjects.map((object, index) => {
          const nextPosition = clampObjectPosition(
            object,
            object.x + 24 + index * 6,
            object.y + 24 + index * 6
          );

          return {
            ...object,
            id: `${object.type}-${crypto.randomUUID()}`,
            name: `${object.name} copy`,
            ...nextPosition
          };
        });
        setObjects((current) => [...current, ...pastedObjects]);
        setSelectedObjectIds(pastedObjects.map((object) => object.id));
        setSelectedObjectId(pastedObjects.at(-1)?.id ?? null);
        showFeedback(`${pastedObjects.length} shape pasted.`);
        return;
      }

      if (isModifier && event.key.toLowerCase() === "z") {
        const previousSnapshot = undoStackRef.current.at(-1);
        if (!previousSnapshot) return;
        event.preventDefault();
        undoStackRef.current = undoStackRef.current.slice(0, -1);
        setObjects(previousSnapshot.map((object) => ({ ...object })));
        clearObjectSelection();
        showFeedback("Undo applied.");
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (!activeIds.length) return;
        event.preventDefault();
        rememberObjectsSnapshot();
        setObjects((current) =>
          current.filter((object) => !activeIdSet.has(object.id))
        );
        clearObjectSelection();
        showFeedback(
          activeIds.length === 1 ? "Shape deleted." : `${activeIds.length} shapes deleted.`
        );
        return;
      }

      const movementByKey: Record<string, { x: number; y: number }> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }
      };
      const movement = movementByKey[event.key];

      if (!movement || !activeIds.length) {
        return;
      }

      event.preventDefault();
      rememberObjectsSnapshot();
      const step = event.shiftKey ? 10 : 1;
      setObjects((current) =>
        current.map((object) => {
          if (!activeIdSet.has(object.id)) {
            return object;
          }

          return {
            ...object,
            ...clampObjectPosition(
              object,
              object.x + movement.x * step,
              object.y + movement.y * step
            )
          };
        })
      );
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasSelectedMap, objects, selectedMap, selectedObjectId, selectedObjectIds]);

  function updateSelectedObject(updates: Partial<Omit<MapObject, "id">>) {
    if (!selectedObjectId) {
      return;
    }

    setObjects((current) =>
      current.map((object) =>
        object.id === selectedObjectId ? { ...object, ...updates } : object
      )
    );
  }

  function addObject(type: ShapeType) {
    if (!hasSelectedMap) {
      showFeedback("Create or select a hall room map first.");
      return;
    }

    const id = `${type}-${crypto.randomUUID()}`;
    const circleShape =
      type === "round-table" || type === "kids-table" || type === "circle";
    const dimensions: Record<ShapeType, { width: number; height: number }> = {
      "round-table": { width: 68, height: 68 },
      "rect-table": { width: 96, height: 48 },
      "kids-table": { width: 68, height: 68 },
      box: { width: 80, height: 54 },
      circle: { width: 68, height: 68 },
      divider: { width: 250, height: 12 },
      buffet: { width: 100, height: 38 },
      "head-table": { width: 112, height: 48 },
      drinks: { width: 82, height: 38 }
    };
    const seats =
      type === "head-table"
        ? 12
        : type === "rect-table"
          ? 10
          : type === "round-table" || type === "kids-table"
            ? 10
            : 0;

    const newObject: MapObject = {
      id,
      type,
      name:
        type === "divider"
          ? "Mechitza divider"
          : type
              .split("-")
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(" "),
      x: 180 + (objects.length % 4) * 25,
      y: 280 + (objects.length % 3) * 25,
      width: dimensions[type].width,
      height: dimensions[type].height,
      rotation: 0,
      seats,
      seatingUse:
        type === "kids-table"
          ? "kids"
          : type === "head-table"
            ? "head"
            : circleShape || type === "rect-table"
              ? "adult"
              : "none"
    };

    rememberObjectsSnapshot();
    setObjects((current) => [...current, newObject]);
    selectSingleObject(id);
    showFeedback(`${newObject.name} added.`);
  }

  function startMapPan(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = mapViewportRef.current;

    if (event.button !== 0 || !viewport) {
      return;
    }

    const target = event.target;

    if (target instanceof Element && target.closest("[data-map-object]")) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop,
      moved: false
    };
  }

  function panMap(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    const viewport = mapViewportRef.current;

    if (!pan || pan.pointerId !== event.pointerId || !viewport) {
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - pan.startClientX;
    const deltaY = event.clientY - pan.startClientY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      pan.moved = true;
    }

    viewport.scrollLeft = pan.startScrollLeft - deltaX;
    viewport.scrollTop = pan.startScrollTop - deltaY;
  }

  function stopMapPan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;

    if (!pan || pan.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    suppressNextMapClickRef.current = pan.moved;
    panRef.current = null;
  }

  function startDragging(
    event: ReactPointerEvent<HTMLButtonElement>,
    object: MapObject
  ) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!selectedObjectIds.includes(object.id)) {
      selectObjectFromPointer(object.id, event);
    }
    rememberObjectsSnapshot();
    dragRef.current = {
      id: object.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: object.x,
      startY: object.y
    };
  }

  function dragObject(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const map = mapRef.current;

    if (!drag || drag.pointerId !== event.pointerId || !map) {
      return;
    }

    event.preventDefault();
    setObjects((current) =>
      current.map((object) => {
        if (object.id !== drag.id) {
          return object;
        }

        const scale = mapScaleRef.current || 1;
        const nextX = drag.startX + (event.clientX - drag.startClientX) / scale;
        const nextY = drag.startY + (event.clientY - drag.startClientY) / scale;

        return {
          ...object,
          x: Math.round(
            Math.min(
              Math.max(0, nextX),
              Math.max(0, DESIGN_MAP_WIDTH - object.width)
            )
          ),
          y: Math.round(
            Math.min(
              Math.max(0, nextY),
              Math.max(0, DESIGN_MAP_HEIGHT - object.height)
            )
          )
        };
      })
    );
  }

  function stopDragging(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }

  function duplicateSelectedObject() {
    if (!selectedObject) {
      return;
    }

    rememberObjectsSnapshot();
    const duplicate: MapObject = {
      ...selectedObject,
      id: `${selectedObject.type}-${crypto.randomUUID()}`,
      name: `${selectedObject.name} copy`,
      ...clampObjectPosition(
        selectedObject,
        selectedObject.x + 20,
        selectedObject.y + 20
      )
    };

    setObjects((current) => [...current, duplicate]);
    selectSingleObject(duplicate.id);
    showFeedback(`${selectedObject.name} duplicated.`);
  }

  function deleteSelectedObject() {
    const activeIds = getActiveObjectIds();

    if (!activeIds.length) {
      return;
    }

    const activeIdSet = new Set(activeIds);
    rememberObjectsSnapshot();
    setObjects((current) =>
      current.filter((object) => !activeIdSet.has(object.id))
    );
    clearObjectSelection();
    showFeedback(
      activeIds.length === 1 ? "Shape deleted." : `${activeIds.length} shapes deleted.`
    );
  }

  function clearMap() {
    if (!selectedMap || objects.length === 0) {
      return;
    }
    if (!window.confirm("Clear every shape from this hall room map?")) {
      return;
    }
    rememberObjectsSnapshot();
    setObjects([]);
    clearObjectSelection();
    showFeedback("Map cleared. Save the map to keep this change.");
  }

  function loadPreset() {
    if (!selectedMap) {
      return;
    }

    const nextObjects = selectedMap.objects.map((object) => ({ ...object }));
    setObjects(nextObjects);
    clearObjectSelection();
    centerMapViewport(nextObjects);
    showFeedback(`${selectedMap.name} loaded.`);
  }

  async function saveCurrentMap() {
    if (!selectedMap) {
      openCreateMapDialog();
      return;
    }
    if (!selectedMap.hallId) {
      showFeedback("Assign this preset to a hall before saving.");
      return;
    }

    try {
      const payload = {
        name: selectedMap.name,
        hallId: selectedMap.hallId,
        objects: objects.map((object) => ({ ...object }))
      };
      const result = await updateMapMutation.mutate({
        ...payload,
        id: selectedMap.id
      });
      setSelectedMapId(result.preset.id);
      await hallMapsQuery.refetch();
      showFeedback(
        `${result.preset.name} saved to ${result.preset.hall?.name}.`
      );
    } catch {
      showFeedback(
        createMapMutation.error ??
          updateMapMutation.error ??
          "Unable to save this preset."
      );
    }
  }

  function openCreateMapDialog() {
    setMapDialogMode("create");
    setMapName("");
    setMapHallId(selectedHallId);
    setIsMapDialogOpen(true);
  }

  function openRenameMapDialog() {
    if (!selectedMap) {
      return;
    }

    setMapDialogMode("rename");
    setMapName(selectedMap.name);
    setMapHallId(selectedMap.hallId);
    setIsMapDialogOpen(true);
  }

  async function submitMapDialog() {
    const trimmedName = mapName.trim();
    if (!trimmedName || !mapHallId) {
      return;
    }

    try {
      if (mapDialogMode === "rename" && selectedMap) {
        const result = await updateMapMutation.mutate({
          id: selectedMap.id,
          name: trimmedName,
          hallId: mapHallId,
          objects
        });
        setSelectedMapId(result.preset.id);
        setSelectedHallId(result.preset.hallId);
        await hallMapsQuery.refetch();
        showFeedback(`Map renamed to ${trimmedName}.`);
      } else {
        const result = await createMapMutation.mutate({
          name: trimmedName,
          hallId: mapHallId,
          objects: []
        });
        setSelectedMapId(result.preset.id);
        setSelectedHallId(result.preset.hallId);
        setObjects([]);
        clearObjectSelection();
        await hallMapsQuery.refetch();
        showFeedback(`${trimmedName} created for ${result.preset.hall?.name}.`);
      }

      setIsMapDialogOpen(false);
      setMapName("");
    } catch {
      showFeedback(
        createMapMutation.error ??
          updateMapMutation.error ??
          "Unable to save this map."
      );
    }
  }

  async function deleteCurrentMap() {
    if (!selectedMap) {
      return;
    }

    if (!window.confirm(`Delete "${selectedMap.name}" permanently?`)) {
      return;
    }

    const deletedMapName = selectedMap.name;
    const nextMaps = hallMaps.filter((map) => map.id !== selectedMap.id);
    const nextSelectedMap = nextMaps[0];
    try {
      await deleteMapMutation.mutate({ id: selectedMap.id });
      await hallMapsQuery.refetch();
      setSelectedMapId(nextSelectedMap?.id ?? "");
      setObjects(
        nextSelectedMap
          ? nextSelectedMap.objects.map((object) => ({ ...object }))
          : []
      );
      clearObjectSelection();
      showFeedback(`${deletedMapName} deleted.`);
    } catch {
      showFeedback(deleteMapMutation.error ?? "Unable to delete this map.");
    }
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        compactMobileActions
        showSearch={false}
        subtitle="Build default hall layouts with movable, resizable, rotatable objects."
        title="Hall Room Map"
        actionsSlot={
          <>
            <button
              className="hidden h-11 whitespace-nowrap rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-bold text-[#17202a] shadow-sm transition enabled:hover:border-[#1f4d73]/60 enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-45 lg:block"
              disabled={!selectedObjectIds.length && !selectedObject}
              onClick={clearObjectSelection}
              type="button"
            >
              Clear selection
            </button>
            <button
              aria-label="Save layout"
              className="hidden h-9 w-9 items-center justify-center rounded-lg bg-transparent text-[#1f4d73] shadow-none transition enabled:hover:text-[#15344f] disabled:cursor-not-allowed disabled:opacity-45 md:flex lg:h-11 lg:w-auto lg:whitespace-nowrap lg:rounded-xl lg:bg-[#1f4d73] lg:px-4 lg:text-sm lg:font-bold lg:text-white lg:shadow-sm lg:enabled:hover:bg-[#15344f] lg:enabled:hover:text-white"
              disabled={!hasSelectedMap}
              onClick={saveCurrentMap}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-6 w-6 lg:hidden"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 4h12l2 2v14H5z" />
                <path d="M8 4v6h8V4M8 20v-6h8v6" />
              </svg>
              <span className="hidden lg:inline">Save layout</span>
            </button>
          </>
        }
      />

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-2 sm:p-3">
        <div className="mx-auto grid min-h-full w-full min-w-0 max-w-[1800px] gap-3 md:grid-cols-2 xl:grid-cols-[250px_minmax(0,1fr)_270px]">
          <HallMapLibraryPanel
            hallMaps={hallMaps}
            halls={hallMapsQuery.data?.halls ?? []}
            hasSelectedHall={hasSelectedHall}
            hasSelectedMap={hasSelectedMap}
            onAddObject={addObject}
            onDeleteMap={deleteCurrentMap}
            onDeleteSelectedObject={deleteSelectedObject}
            onDuplicateSelectedObject={duplicateSelectedObject}
            onLoadPreset={loadPreset}
            onNewMap={openCreateMapDialog}
            onRenameMap={openRenameMapDialog}
            onSavePreset={saveCurrentMap}
            onSelectHall={(hallId) => {
              const nextMap =
                hallMaps.find((map) => map.hallId === hallId) ?? null;
              setSelectedHallId(hallId);
              setSelectedMapId(nextMap?.id ?? "");
              setObjects(
                nextMap?.objects.map((object) => ({ ...object })) ?? []
              );
              clearObjectSelection();
            }}
            onSelectMap={(nextMap) => {
              setSelectedMapId(nextMap.id);
              setObjects(nextMap.objects.map((object) => ({ ...object })));
              clearObjectSelection();
            }}
            selectedHallId={selectedHallId}
            selectedHallMaps={selectedHallMaps}
            selectedMapId={selectedMapId}
            selectedObjectExists={Boolean(selectedObject)}
          />

          <Panel className="order-1 flex min-h-0 min-w-0 flex-col md:col-span-2 xl:order-2 xl:col-span-1">
            <header className="flex items-center gap-2 border-b border-[#d8dde5] p-2">
              <h2 className="min-w-0 flex-1 truncate text-sm font-black">
                Hall Room Map
              </h2>

              <span className="hidden rounded-lg border border-[#d8dde5] bg-[#f8fafc] px-3 py-2 text-[10px] font-bold text-[#617086] md:inline-flex">
                Single-screen editor
              </span>

              <span className="ml-auto inline-flex rounded-lg border border-[#b9c2cf] bg-[#f5f6f8] px-3 py-2 text-[10px] font-black uppercase text-[#516174] md:hidden">
                View only
              </span>

              <div className="ml-auto hidden shrink-0 gap-2 md:flex">
                <button
                  className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!hasSelectedMap || objects.length === 0}
                  onClick={clearMap}
                  type="button"
                >
                  Clear
                </button>

                <button
                  className="h-9 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!hasSelectedMap}
                  onClick={saveCurrentMap}
                  type="button"
                >
                  Save map
                </button>
              </div>
            </header>

            <div
              className="min-h-[360px] min-w-0 flex-1 cursor-grab touch-none overflow-hidden rounded-lg border border-[#bdc9d6] bg-[#fbfdff] p-2 active:cursor-grabbing md:min-h-[430px] lg:min-h-[500px] xl:min-h-0"
              onPointerCancel={stopMapPan}
              onPointerDown={startMapPan}
              onPointerMove={panMap}
              onPointerUp={stopMapPan}
              ref={mapViewportRef}
              style={{
                backgroundImage:
                  "linear-gradient(#dce5ef 1px, transparent 1px), linear-gradient(90deg, #dce5ef 1px, transparent 1px)",
                backgroundSize: "20px 20px"
              }}
            >
              <div
                className="relative mx-auto"
                style={{
                  height: DESIGN_MAP_HEIGHT * mapScale,
                  width: DESIGN_MAP_WIDTH * mapScale
                }}
              >
                <div
                  className="relative max-md:pointer-events-none"
                  onClick={() => {
                    if (suppressNextMapClickRef.current) {
                      suppressNextMapClickRef.current = false;
                      return;
                    }

                    clearObjectSelection();
                  }}
                  ref={mapRef}
                  role="presentation"
                  style={{
                    height: DESIGN_MAP_HEIGHT,
                    transform: `scale(${mapScale})`,
                    transformOrigin: "top left",
                    width: DESIGN_MAP_WIDTH
                  }}
                >
                  {objects.map((object) => (
                    <MapObjectView
                      key={object.id}
                      object={object}
                      onDragEnd={stopDragging}
                      onDragMove={dragObject}
                      onDragStart={(event) => startDragging(event, object)}
                      onSelect={(event) => selectObjectFromPointer(object.id, event)}
                      selected={selectedObjectIdSet.has(object.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <HallMapObjectInspector
            onUpdateSelectedObject={updateSelectedObject}
            selectedObject={selectedObject}
          />
        </div>
      </main>

      <div
        aria-live="polite"
        className={`pointer-events-none fixed bottom-5 left-1/2 z-90 -translate-x-1/2 rounded-xl bg-[#07162d] px-4 py-2 text-center text-sm font-bold text-white shadow-xl transition ${
          feedback ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
        role="status"
      >
        {feedback}
      </div>

      {isMapDialogOpen ? (
        <div
          className="pointer-events-auto fixed inset-0 z-100 flex items-center justify-center bg-[#07162d]/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsMapDialogOpen(false);
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="hall-map-dialog-title"
            aria-modal="true"
            className="w-full max-w-md overflow-visible rounded-2xl border border-[#d8dde5] bg-white shadow-2xl"
            role="dialog"
          >
            <header className="flex items-center gap-3 border-b border-[#d8dde5] px-5 py-4">
              <h2
                className="min-w-0 flex-1 text-lg font-black"
                id="hall-map-dialog-title"
              >
                {mapDialogMode === "create"
                  ? "New hall room map"
                  : "Rename hall room map"}
              </h2>
              <button
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md text-2xl leading-none hover:bg-[#eef4fa]"
                onClick={() => setIsMapDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <form
              className="p-5"
              onSubmit={(event) => {
                event.preventDefault();
                submitMapDialog();
              }}
            >
              <label
                className="text-xs font-black uppercase tracking-wide text-[#59677c]"
                htmlFor="hall-map-name"
              >
                Map name
              </label>
              <input
                autoFocus
                className="mt-2 h-11 w-full rounded-xl border border-[#b9c2cf] px-3 text-sm outline-none focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15"
                id="hall-map-name"
                onChange={(event) => setMapName(event.target.value)}
                placeholder="Example: Main Ballroom"
                value={mapName}
              />
              <label
                className="mt-4 block text-xs font-black uppercase tracking-wide text-[#59677c]"
                htmlFor="hall-map-assignment"
              >
                Assign to hall
              </label>
              <CompactSelect
                id="hall-map-assignment"
                onChange={(value) => setMapHallId(value)}
                options={[
                  { label: "Select a hall", value: "" },
                  ...(hallMapsQuery.data?.halls ?? []).map((hall) => ({
                    label: hall.name,
                    value: hall.id
                  }))
                ]}
                value={mapHallId}
              />
              <div className="mt-5 flex justify-end gap-2">
                <button
                  className="h-10 rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-bold hover:bg-[#eef4fa]"
                  onClick={() => setIsMapDialogOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="h-10 rounded-xl bg-[#1f4d73] px-4 text-sm font-bold text-white hover:bg-[#15344f] disabled:opacity-50"
                  disabled={
                    !mapName.trim() ||
                    !mapHallId ||
                    createMapMutation.isPending ||
                    updateMapMutation.isPending
                  }
                  type="submit"
                >
                  {mapDialogMode === "create" ? "Create map" : "Save name"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
