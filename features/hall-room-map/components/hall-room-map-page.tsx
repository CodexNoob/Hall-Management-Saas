"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { DashboardLoadingIndicator } from "@/components/ui/dashboard-loading-indicator";
import { useHallMapKeyboardShortcuts } from "@/features/hall-room-map/hooks/use-hall-map-keyboard-shortcuts";
import { HallMapDialog } from "@/features/hall-room-map/components/hall-map-dialog";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { HallMapLibraryPanel } from "@/features/hall-room-map/components/hall-map-library-panel";
import { MapObjectView } from "@/features/hall-room-map/components/hall-map-object-view";
import { HallMapObjectInspector } from "@/features/hall-room-map/components/hall-map-object-inspector";
import { Panel } from "@/features/hall-room-map/components/hall-map-panel";
import {
  HALL_MAP_STORAGE_KEY,
  MAP_WORLD_ORIGIN,
  MAP_WORLD_SIZE,
  MAP_VIEWPORT_PADDING,
  clampObjectToMap,
  clampViewportPosition,
  defaultShapeDimensions,
  findObjectIdsInRegion,
  findOverlappingObjectIds,
  generateTableRows,
  getMapObjectBounds,
  getRotationFromPointer,
  initialHallMaps,
  normalizeWorldRect,
  snapToGrid,
  summarizeSeats,
  type HallMapsResponse,
  type WorldRect,
  type MapObject,
  type ResizeEdge,
  type SaveHallMapInput,
  type SavedHallMap,
  type ShapeLibraryItem,
  type ShapeType,
  type TableRowsInput,
  resizeMapObjectFromEdge
} from "@/features/hall-room-map/components/hall-map-shared";
import { HallMapPrintSheet } from "@/features/hall-room-map/components/hall-map-print-sheet";
import {
  getFloorPlanUrl,
  uploadHallFloorPlan
} from "@/features/hall-room-map/lib/upload-floor-plan";
import { useAppLanguage } from "@/components/providers/app-language-provider";

const MIN_MAP_SCALE = 0.05;
const MAX_MAP_SCALE = 2;
const MAP_ZOOM_FACTOR = 1.25;

export function HallRoomMapPage() {
  const { t } = useAppLanguage();
  const hallMapsQuery =
    useAuthenticatedQuery<HallMapsResponse>("/api/hall-maps");
  const createMapMutation = useAuthenticatedMutation<
    SaveHallMapInput,
    { preset: SavedHallMap }
  >("/api/hall-maps", "POST");
  // Partial on purpose: the PATCH schema is partial server-side, and callers
  // like the floor-plan handlers update one field without resending the layout.
  const updateMapMutation = useAuthenticatedMutation<
    Partial<SaveHallMapInput> & { id: string },
    { preset: SavedHallMap }
  >("/api/hall-maps", "PATCH");
  const deleteMapMutation = useAuthenticatedMutation<
    { id: string },
    { deleted: true }
  >("/api/hall-maps", "DELETE");
  const createShapeMutation = useAuthenticatedMutation<
    {
      name: string;
      shapeType: "round-table" | "rect-table";
      width: number;
      height: number;
      seats: number;
    },
    { shape: ShapeLibraryItem }
  >("/api/hall-map-shapes", "POST");
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [hallMaps, setHallMaps] = useState<SavedHallMap[]>(initialHallMaps);
  const [shapeLibrary, setShapeLibrary] = useState<ShapeLibraryItem[]>([]);
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
  const [saveConfirmation, setSaveConfirmation] = useState<{
    title: string;
    detail: string;
  } | null>(null);
  const [mapScale, setMapScale] = useState(1);
  const [mapDimensions, setMapDimensions] = useState({
    width: MAP_WORLD_SIZE,
    height: MAP_WORLD_SIZE
  });
  // Right-drag box select. Held in world coordinates and drawn inside the
  // scaled surface, so the box stays anchored to the floor plan if the map is
  // scrolled or zoomed part-way through the drag.
  const [marquee, setMarquee] = useState<WorldRect | null>(null);
  const marqueeRef = useRef<{
    pointerId: number;
    additive: boolean;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  // Placement snapping to the 20px visual grid. Alt while dragging bypasses it.
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const latestObjectsRef = useRef<MapObject[]>(objects);
  const objectClipboardRef = useRef<MapObject[]>([]);
  const undoStackRef = useRef<MapObject[][]>([]);
  const redoStackRef = useRef<MapObject[][]>([]);
  const mapScaleRef = useRef(1);
  const mapDimensionsRef = useRef(mapDimensions);
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
    objectId: string;
    usesMultiSelect: boolean;
    moved: boolean;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPositions: Record<string, { x: number; y: number }>;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const suppressNextObjectClickRef = useRef(false);
  const resizeRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    object: MapObject;
    edge: ResizeEdge;
  } | null>(null);
  const rotateRef = useRef<{
    pointerId: number;
    centerClientX: number;
    centerClientY: number;
    startPointerAngle: number;
    startRotation: number;
    objectId: string;
  } | null>(null);
  const shortcutsRef = useRef<HTMLDetailsElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveConfirmationTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const selectedMapBackgroundPath =
    hallMaps.find((map) => map.id === selectedMapId)?.backgroundPath ?? null;

  // The floor-plan bucket is private, so rendering needs a short-lived signed
  // URL. Refreshed whenever the selected map's stored path changes.
  useEffect(() => {
    let cancelled = false;

    if (!selectedMapBackgroundPath) {
      setFloorPlanUrl(null);
      return;
    }

    getFloorPlanUrl(selectedMapBackgroundPath).then((url) => {
      if (!cancelled) setFloorPlanUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedMapBackgroundPath]);

  useEffect(() => {
    latestObjectsRef.current = objects;
  }, [objects]);

  useEffect(() => {
    mapScaleRef.current = mapScale;
  }, [mapScale]);

  useEffect(() => {
    mapDimensionsRef.current = mapDimensions;
  }, [mapDimensions]);

  useEffect(() => {
    function closeShortcutsWhenClickingOutside(event: PointerEvent) {
      const shortcuts = shortcutsRef.current;

      if (
        shortcuts?.hasAttribute("open") &&
        event.target instanceof Node &&
        !shortcuts.contains(event.target)
      ) {
        shortcuts.removeAttribute("open");
      }
    }

    document.addEventListener("pointerdown", closeShortcutsWhenClickingOutside);

    return () =>
      document.removeEventListener(
        "pointerdown",
        closeShortcutsWhenClickingOutside
      );
  }, []);

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
          left: clampViewportPosition(MAP_WORLD_ORIGIN - viewport.clientWidth / 2, maxLeft),
          top: clampViewportPosition(MAP_WORLD_ORIGIN - viewport.clientHeight / 2, maxTop)
        });
        return;
      }

      const scale = mapScaleRef.current;
      const centerX = (MAP_WORLD_ORIGIN + (bounds.minX + bounds.maxX) / 2) * scale;
      const centerY = (MAP_WORLD_ORIGIN + (bounds.minY + bounds.maxY) / 2) * scale;

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

    const nextDimensions = { width: MAP_WORLD_SIZE, height: MAP_WORLD_SIZE };

    mapDimensionsRef.current = nextDimensions;
    setMapDimensions((current) =>
      Math.abs(current.width - nextDimensions.width) < 0.5 &&
      Math.abs(current.height - nextDimensions.height) < 0.5
        ? current
        : nextDimensions
    );
    centerMapViewport();
  }, [centerMapViewport]);

  function setMapZoom(
    nextScale: number,
    worldCenter?: { x: number; y: number },
    viewportAnchor?: { x: number; y: number }
  ) {
    const viewport = mapViewportRef.current;
    const currentScale = mapScaleRef.current || 1;
    const scale = Math.min(MAX_MAP_SCALE, Math.max(MIN_MAP_SCALE, nextScale));

    if (!viewport) {
      mapScaleRef.current = scale;
      setMapScale(scale);
      return;
    }

    const anchor = viewportAnchor ?? {
      x: viewport.clientWidth / 2,
      y: viewport.clientHeight / 2
    };
    const center = worldCenter ?? {
      x: (viewport.scrollLeft + anchor.x) / currentScale,
      y: (viewport.scrollTop + anchor.y) / currentScale
    };

    mapScaleRef.current = scale;
    setMapScale(scale);

    window.requestAnimationFrame(() => {
      const currentViewport = mapViewportRef.current;

      if (!currentViewport) return;

      const maxLeft = currentViewport.scrollWidth - currentViewport.clientWidth;
      const maxTop = currentViewport.scrollHeight - currentViewport.clientHeight;
      currentViewport.scrollTo({
        left: clampViewportPosition(
          center.x * scale - anchor.x,
          maxLeft
        ),
        top: clampViewportPosition(
          center.y * scale - anchor.y,
          maxTop
        )
      });
    });
  }

  function zoomMap(direction: "in" | "out") {
    const factor = direction === "in" ? MAP_ZOOM_FACTOR : 1 / MAP_ZOOM_FACTOR;
    setMapZoom(mapScaleRef.current * factor);
  }

  function zoomMapAtPointer(
    direction: "in" | "out",
    clientX: number,
    clientY: number
  ) {
    const viewport = mapViewportRef.current;

    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const anchor = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
    const currentScale = mapScaleRef.current || 1;
    const worldPoint = {
      x: (viewport.scrollLeft + anchor.x) / currentScale,
      y: (viewport.scrollTop + anchor.y) / currentScale
    };
    const factor = direction === "in" ? MAP_ZOOM_FACTOR : 1 / MAP_ZOOM_FACTOR;

    setMapZoom(currentScale * factor, worldPoint, anchor);
  }

  function resetMapZoom() {
    setMapZoom(1);
  }

  function fitObjectsToViewport(
    targetObjects: MapObject[],
    options: { allowZoomIn?: boolean } = {}
  ) {
    const viewport = mapViewportRef.current;
    const bounds = getMapObjectBounds(targetObjects);

    if (!viewport || !bounds) {
      setMapZoom(1, { x: MAP_WORLD_ORIGIN, y: MAP_WORLD_ORIGIN });
      return;
    }

    const horizontalPadding = 64;
    const verticalPadding = 64;
    const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
    const fitScale = Math.min(
      (viewport.clientWidth - horizontalPadding) / boundsWidth,
      (viewport.clientHeight - verticalPadding) / boundsHeight
    );
    const scale = options.allowZoomIn ? fitScale : Math.min(1, fitScale);

    setMapZoom(scale, {
      x: MAP_WORLD_ORIGIN + (bounds.minX + bounds.maxX) / 2,
      y: MAP_WORLD_ORIGIN + (bounds.minY + bounds.maxY) / 2
    });
  }

  function fitAllShapes() {
    fitObjectsToViewport(latestObjectsRef.current, { allowZoomIn: true });
  }

  const selectedObject =
    objects.find((object) => object.id === selectedObjectId) ?? null;
  const selectedObjectIdSet = new Set(selectedObjectIds);
  const hasSelectedObject = selectedObjectIds.length > 0 || Boolean(selectedObject);
  const selectedMap = hallMaps.find((map) => map.id === selectedMapId) ?? null;
  const selectedHall =
    hallMapsQuery.data?.halls.find((hall) => hall.id === selectedHallId) ??
    null;
  const seatSummary = summarizeSeats(objects);
  const isOverCapacity =
    typeof selectedHall?.capacity === "number" &&
    selectedHall.capacity > 0 &&
    seatSummary.total > selectedHall.capacity;
  const overlappingObjectIds = useMemo(
    () => findOverlappingObjectIds(objects),
    [objects]
  );
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
    setShapeLibrary(hallMapData.shapeLibrary ?? []);
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

      if (saveConfirmationTimerRef.current) {
        clearTimeout(saveConfirmationTimerRef.current);
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

  function showSaveConfirmation(preset: SavedHallMap) {
    setSaveConfirmation({
      title: t("hallMap.layoutSaved"),
      detail: `${preset.name} is saved${preset.hall?.name ? ` to ${preset.hall.name}` : ""}.`
    });

    if (saveConfirmationTimerRef.current) {
      clearTimeout(saveConfirmationTimerRef.current);
    }

    saveConfirmationTimerRef.current = setTimeout(
      () => setSaveConfirmation(null),
      6000
    );
  }

  function rememberObjectsSnapshot(snapshot = latestObjectsRef.current) {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-24),
      snapshot.map((object) => ({ ...object }))
    ];
    // A fresh edit forks history: whatever was undone is no longer reachable.
    redoStackRef.current = [];
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
    event: Pick<
      ReactPointerEvent<HTMLButtonElement>,
      "ctrlKey" | "metaKey" | "shiftKey"
    >
  ) {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
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

  // Single bounds implementation for drag, keyboard nudge, paste, duplicate and
  // inspector edits, so they cannot disagree about where the map ends.
  function clampObjectPosition(object: MapObject, x: number, y: number) {
    const position = clampObjectToMap(
      object,
      x + MAP_WORLD_ORIGIN,
      y + MAP_WORLD_ORIGIN,
      MAP_WORLD_SIZE,
      MAP_WORLD_SIZE
    );
    return {
      x: position.x - MAP_WORLD_ORIGIN,
      y: position.y - MAP_WORLD_ORIGIN
    };
  }

  function getActiveObjectIds() {
    return selectedObjectIds.length
      ? selectedObjectIds
      : selectedObjectId
        ? [selectedObjectId]
        : [];
  }

  useHallMapKeyboardShortcuts({
    clampObjectPosition,
    clearObjectSelection,
    fitAllShapes,
    getActiveObjectIds,
    hasSelectedMap,
    latestObjectsRef,
    objectClipboardRef,
    objects,
    redoStackRef,
    rememberObjectsSnapshot,
    resetMapZoom,
    saveCurrentMap,
    selectedMap,
    selectedObjectId,
    selectedObjectIds,
    setObjects,
    setSelectedObjectId,
    setSelectedObjectIds,
    showFeedback,
    t,
    undoStackRef,
    zoomIn: () => zoomMap("in"),
    zoomOut: () => zoomMap("out"),
    zoomAtPointer: zoomMapAtPointer
  });

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
      showFeedback(t("hallMap.selectMapFirst"));
      return;
    }

    const id = `${type}-${crypto.randomUUID()}`;
    const circleShape =
      type === "round-table" || type === "kids-table" || type === "circle";
    const dimensions = defaultShapeDimensions;
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
          ? t("hallMap.mechitzaDivider")
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

  function addShapeLibraryObject(shape: ShapeLibraryItem) {
    if (!hasSelectedMap) {
      showFeedback(t("hallMap.selectMapFirst"));
      return;
    }

    const newObject: MapObject = {
      id: `${shape.shapeType}-${crypto.randomUUID()}`,
      type: shape.shapeType,
      name: shape.name,
      x: 180 + (objects.length % 4) * 25,
      y: 280 + (objects.length % 3) * 25,
      width: shape.width,
      height: shape.height,
      rotation: 0,
      seats: shape.seats,
      seatingUse: "adult"
    };

    rememberObjectsSnapshot();
    setObjects((current) => [...current, newObject]);
    selectSingleObject(newObject.id);
    showFeedback(`${newObject.name} added.`);
  }

  /** World-space map coordinates at the centre of what the user can see. */
  function getViewportCenterWorld() {
    const viewport = mapViewportRef.current;
    const scale = mapScaleRef.current || 1;

    if (!viewport) return { x: 0, y: 0 };

    return {
      x:
        (viewport.scrollLeft + viewport.clientWidth / 2) / scale -
        MAP_WORLD_ORIGIN,
      y:
        (viewport.scrollTop + viewport.clientHeight / 2) / scale -
        MAP_WORLD_ORIGIN
    };
  }

  function addTableRows(
    input: Pick<TableRowsInput, "type" | "count" | "perRow" | "seats">
  ) {
    if (!hasSelectedMap) {
      showFeedback(t("hallMap.selectMapFirst"));
      return;
    }

    const center = getViewportCenterWorld();
    const added = generateTableRows({
      ...input,
      centerX: center.x,
      centerY: center.y,
      startNumber: objects.length + 1
    });

    if (!added.length) return;

    rememberObjectsSnapshot();
    setObjects((current) => [...current, ...added]);
    setSelectedObjectIds(added.map((object) => object.id));
    setSelectedObjectId(added.at(-1)?.id ?? null);
    showFeedback(t("hallMap.tablesAddedInRows", { count: added.length }));
  }

  async function copyMapToHall(targetHallId: string) {
    if (!selectedMap) return;

    const targetHall = hallMapsQuery.data?.halls.find(
      (hall) => hall.id === targetHallId
    );

    if (!targetHall) return;

    try {
      const result = await createMapMutation.mutate({
        name: `${selectedMap.name} (${targetHall.name})`,
        hallId: targetHall.id,
        objects: objects.map((object) => ({ ...object })),
        // The image is organization-scoped, not hall-scoped, so both presets
        // may point at the same stored file.
        backgroundPath: selectedMap.backgroundPath ?? null
      });
      await hallMapsQuery.refetch();
      showFeedback(
        t("hallMap.copiedToHall", {
          name: result.preset.name,
          hall: targetHall.name
        })
      );
    } catch (error) {
      showFeedback(
        error instanceof Error ? error.message : t("hallMap.copyFailed")
      );
    }
  }

  async function uploadFloorPlan(file: File) {
    if (!selectedMap) return;

    try {
      const path = await uploadHallFloorPlan(file);
      await updateMapMutation.mutate({
        id: selectedMap.id,
        backgroundPath: path
      });
      await hallMapsQuery.refetch();
      showFeedback(t("hallMap.floorPlanAdded"));
    } catch (error) {
      showFeedback(
        error instanceof Error
          ? error.message
          : t("hallMap.floorPlanUploadFailed")
      );
    }
  }

  async function removeFloorPlan() {
    if (!selectedMap?.backgroundPath) return;

    try {
      await updateMapMutation.mutate({
        id: selectedMap.id,
        backgroundPath: null
      });
      await hallMapsQuery.refetch();
      setFloorPlanUrl(null);
      showFeedback(t("hallMap.floorPlanRemoved"));
    } catch (error) {
      showFeedback(
        error instanceof Error
          ? error.message
          : t("hallMap.floorPlanRemoveFailed")
      );
    }
  }

  async function createShapeLibraryItem(input: {
    name: string;
    shapeType: "round-table" | "rect-table";
    width: number;
    height: number;
    seats: number;
  }) {
    const { shape } = await createShapeMutation.mutate(input);
    setShapeLibrary((current) => [...current, shape]);
    await hallMapsQuery.refetch();
    showFeedback(t("hallMap.savedToLibrary", { name: shape.name }));
  }

  /**
   * Pointer position in object coordinates.
   *
   * Measured off the rendered surface rather than the `mapScale` state: the
   * two can disagree by a fraction while a zoom settles, and a marquee that
   * lands a few units off the cursor picks up the wrong shapes.
   */
  function toWorldPoint(clientX: number, clientY: number) {
    const surface = mapRef.current;
    if (!surface) return null;

    const rect = surface.getBoundingClientRect();
    const scale = rect.width / MAP_WORLD_SIZE;
    if (!Number.isFinite(scale) || scale <= 0) return null;

    return {
      x: (clientX - rect.left) / scale - MAP_WORLD_ORIGIN,
      y: (clientY - rect.top) / scale - MAP_WORLD_ORIGIN
    };
  }

  // Right-drag draws a selection box; left-drag still pans. The three handlers
  // below try the marquee first and otherwise hand the event to the pan
  // functions untouched, so panning behaves exactly as it always has.
  function startMarquee(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 2) return false;

    const target = event.target;
    if (target instanceof Element && target.closest("[data-map-object]")) {
      return false;
    }

    const origin = toWorldPoint(event.clientX, event.clientY);
    if (!origin) return false;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    marqueeRef.current = {
      pointerId: event.pointerId,
      // Shift keeps what is already selected, matching Shift-click.
      additive: event.shiftKey,
      originX: origin.x,
      originY: origin.y,
      moved: false
    };
    setMarquee({
      minX: origin.x,
      minY: origin.y,
      maxX: origin.x,
      maxY: origin.y
    });
    return true;
  }

  function updateMarquee(event: ReactPointerEvent<HTMLDivElement>) {
    const active = marqueeRef.current;
    if (!active || active.pointerId !== event.pointerId) return false;

    const point = toWorldPoint(event.clientX, event.clientY);
    if (!point) return true;

    if (
      Math.abs(point.x - active.originX) > 2 ||
      Math.abs(point.y - active.originY) > 2
    ) {
      active.moved = true;
    }

    event.preventDefault();
    setMarquee(
      normalizeWorldRect({ x: active.originX, y: active.originY }, point)
    );
    return true;
  }

  function commitMarquee(event: ReactPointerEvent<HTMLDivElement>) {
    const active = marqueeRef.current;
    if (!active || active.pointerId !== event.pointerId) return false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    marqueeRef.current = null;
    const region = marquee;
    setMarquee(null);

    // A right-click that never moved is not a selection gesture; leave the
    // current selection alone rather than silently clearing it.
    if (!active.moved || !region) return true;

    const hits = findObjectIdsInRegion(objects, region);
    const nextIds = active.additive
      ? Array.from(new Set([...selectedObjectIds, ...hits]))
      : hits;

    setSelectedObjectIds(nextIds);
    setSelectedObjectId(nextIds.at(-1) ?? null);
    showFeedback(
      nextIds.length === 1
        ? t("hallMap.oneShapeSelected")
        : t("hallMap.shapesSelected", { count: nextIds.length })
    );
    return true;
  }

  function handleMapPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (startMarquee(event)) return;
    startMapPan(event);
  }

  function handleMapPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (updateMarquee(event)) return;
    panMap(event);
  }

  function handleMapPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (commitMarquee(event)) return;
    stopMapPan(event);
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
    if (!pan.moved) {
      clearObjectSelection();
    }
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
    const usesMultiSelect = event.shiftKey || event.ctrlKey || event.metaKey;
    const isAlreadySelected = selectedObjectIds.includes(object.id);
    let objectIds: string[];

    if (usesMultiSelect) {
      objectIds = isAlreadySelected
        ? selectedObjectIds.filter((id) => id !== object.id)
        : [...selectedObjectIds, object.id];
      setSelectedObjectIds(objectIds);
      setSelectedObjectId(objectIds.at(-1) ?? null);
    } else if (isAlreadySelected) {
      objectIds = selectedObjectIds;
    } else {
      objectIds = [object.id];
      selectSingleObject(object.id);
    }

    suppressNextObjectClickRef.current = true;
    // No snapshot yet: every selection click starts here, and snapshotting on
    // pointerdown filled the undo stack with no-op entries - and, since redo
    // forks on fresh edits, a plain click would erase the redo stack. The
    // snapshot is taken in dragObject the moment movement actually starts.
    dragRef.current = {
      objectId: object.id,
      usesMultiSelect,
      moved: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPositions: Object.fromEntries(
        latestObjectsRef.current
          .filter((candidate) => objectIds.includes(candidate.id))
          .map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }])
      ),
      startScrollLeft: mapViewportRef.current?.scrollLeft ?? 0,
      startScrollTop: mapViewportRef.current?.scrollTop ?? 0
    };
  }

  function dragObject(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const map = mapRef.current;
    const viewport = mapViewportRef.current;

    if (!drag || drag.pointerId !== event.pointerId || !map || !viewport) {
      return;
    }

    event.preventDefault();

    // Measure the map itself rather than reading mapScaleRef: the ref is written
    // on every resize while the rendered scale only commits past a 0.01
    // threshold, so the two can drift apart mid-drag.
    const rect = map.getBoundingClientRect();
    const dimensions = mapDimensionsRef.current;
    const scaleX = rect.width > 0 ? rect.width / dimensions.width : 1;
    const scaleY = rect.height > 0 ? rect.height / dimensions.height : 1;
    const viewportRect = viewport.getBoundingClientRect();
    const edge = 48;
    const panStep = 24;
    if (event.clientX < viewportRect.left + edge) viewport.scrollLeft -= panStep;
    if (event.clientX > viewportRect.right - edge) viewport.scrollLeft += panStep;
    if (event.clientY < viewportRect.top + edge) viewport.scrollTop -= panStep;
    if (event.clientY > viewportRect.bottom - edge) viewport.scrollTop += panStep;
    // Total displacement from the pointer-down anchor, never an accumulated
    // delta, so a dropped move event cannot bias the result.
    const deltaX =
      (event.clientX - drag.startClientX +
        viewport.scrollLeft -
        drag.startScrollLeft) /
        scaleX;
    const deltaY =
      (event.clientY - drag.startClientY +
        viewport.scrollTop -
        drag.startScrollTop) /
        scaleY;

    if (
      !drag.moved &&
      (Math.abs(event.clientX - drag.startClientX) > 3 ||
        Math.abs(event.clientY - drag.startClientY) > 3 ||
        Math.abs(viewport.scrollLeft - drag.startScrollLeft) > 3 ||
        Math.abs(viewport.scrollTop - drag.startScrollTop) > 3)
    ) {
      drag.moved = true;
      // First real movement: snapshot the pre-drag state for undo. Positions
      // may already have shifted by a few sub-threshold pixels, so rebuild
      // them from the recorded starts rather than trusting current state.
      rememberObjectsSnapshot(
        latestObjectsRef.current.map((object) => {
          const start = drag.startPositions[object.id];
          return start ? { ...object, x: start.x, y: start.y } : { ...object };
        })
      );
    }

    // Snap the shared delta, not each object: snapping positions individually
    // would collapse a multi-selection's relative offsets onto the grid. The
    // anchor object lands on the grid and everything else keeps its distance.
    // Alt bypasses for free-hand placement.
    const anchor = drag.startPositions[drag.objectId];
    const applySnap = isSnapEnabled && !event.altKey && anchor;
    const effectiveDeltaX = applySnap
      ? snapToGrid(anchor.x + deltaX) - anchor.x
      : deltaX;
    const effectiveDeltaY = applySnap
      ? snapToGrid(anchor.y + deltaY) - anchor.y
      : deltaY;

    setObjects((current) =>
      current.map((object) => {
        const start = drag.startPositions[object.id];

        return start
          ? {
              ...object,
              ...clampObjectPosition(
                object,
                start.x + effectiveDeltaX,
                start.y + effectiveDeltaY
              )
            }
          : object;
      })
    );
  }

  function stopDragging(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (event.type === "pointercancel") {
      suppressNextObjectClickRef.current = false;
    } else if (!drag.moved && !drag.usesMultiSelect) {
      selectSingleObject(drag.objectId);
    }
    dragRef.current = null;
  }

  function startResizing(
    event: ReactPointerEvent<HTMLSpanElement>,
    object: MapObject,
    edge: ResizeEdge
  ) {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectSingleObject(object.id);
    rememberObjectsSnapshot();
    resizeRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      object: { ...object },
      edge
    };
  }

  function resizeObject(event: ReactPointerEvent<HTMLSpanElement>) {
    const resize = resizeRef.current;
    const map = mapRef.current;

    if (!resize || resize.pointerId !== event.pointerId || !map) return;

    event.preventDefault();
    event.stopPropagation();
    const rect = map.getBoundingClientRect();
    const dimensions = mapDimensionsRef.current;
    const scaleX = rect.width > 0 ? rect.width / dimensions.width : 1;
    const scaleY = rect.height > 0 ? rect.height / dimensions.height : 1;
    const resized = resizeMapObjectFromEdge(
      resize.object,
      resize.edge,
      (event.clientX - resize.startClientX) / scaleX,
      (event.clientY - resize.startClientY) / scaleY
    );
    const position = clampObjectPosition(resized, resized.x, resized.y);

    setObjects((current) =>
      current.map((object) =>
        object.id === resize.object.id
          ? { ...resized, ...position }
          : object
      )
    );
  }

  function stopResizing(event: ReactPointerEvent<HTMLSpanElement>) {
    if (resizeRef.current?.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
  }

  function startRotating(
    event: ReactPointerEvent<HTMLSpanElement>,
    object: MapObject
  ) {
    if (event.button !== 0) return;

    const objectElement = event.currentTarget.closest("[data-map-object]");
    const objectRect = objectElement?.getBoundingClientRect();

    if (!objectRect) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectSingleObject(object.id);
    rememberObjectsSnapshot();
    const centerClientX = objectRect.left + objectRect.width / 2;
    const centerClientY = objectRect.top + objectRect.height / 2;
    rotateRef.current = {
      pointerId: event.pointerId,
      centerClientX,
      centerClientY,
      startPointerAngle: Math.atan2(
        event.clientY - centerClientY,
        event.clientX - centerClientX
      ) * (180 / Math.PI),
      startRotation: object.rotation,
      objectId: object.id
    };
  }

  function rotateObject(event: ReactPointerEvent<HTMLSpanElement>) {
    const rotate = rotateRef.current;

    if (!rotate || rotate.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    const currentPointerAngle = Math.atan2(
      event.clientY - rotate.centerClientY,
      event.clientX - rotate.centerClientX
    ) * (180 / Math.PI);
    const rotation = getRotationFromPointer(
      rotate.startRotation,
      rotate.startPointerAngle,
      currentPointerAngle,
      event.shiftKey
    );

    setObjects((current) =>
      current.map((object) =>
        object.id === rotate.objectId ? { ...object, rotation } : object
      )
    );
  }

  function stopRotating(event: ReactPointerEvent<HTMLSpanElement>) {
    if (rotateRef.current?.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    rotateRef.current = null;
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
      activeIds.length === 1
        ? t("hallMap.shapeDeleted")
        : t("hallMap.shapesDeleted", { count: activeIds.length })
    );
  }

  function clearMap() {
    if (!selectedMap || objects.length === 0) {
      return;
    }
    if (!window.confirm(t("hallMap.clearEveryShape"))) {
      return;
    }
    rememberObjectsSnapshot();
    setObjects([]);
    clearObjectSelection();
    showFeedback(t("hallMap.mapCleared"));
  }

  function loadPreset() {
    if (!selectedMap) {
      return;
    }

    const nextObjects = selectedMap.objects.map((object) => ({ ...object }));
    setObjects(nextObjects);
    clearObjectSelection();
    window.requestAnimationFrame(() => fitObjectsToViewport(nextObjects));
    showFeedback(`${selectedMap.name} loaded.`);
  }

  function selectMapAndFit(nextMap: SavedHallMap | null) {
    const nextObjects = nextMap?.objects.map((object) => ({ ...object })) ?? [];

    setSelectedMapId(nextMap?.id ?? "");
    setObjects(nextObjects);
    clearObjectSelection();

    if (nextObjects.length > 0) {
      window.requestAnimationFrame(() => fitObjectsToViewport(nextObjects));
    } else {
      centerMapViewport(nextObjects);
    }
  }

  async function saveCurrentMap() {
    if (!selectedMap) {
      openCreateMapDialog();
      return;
    }
    if (!selectedMap.hallId) {
      showFeedback(t("hallMap.assignPresetFirst"));
      return;
    }

    setIsSavingLayout(true);
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
      showSaveConfirmation(result.preset);
      showFeedback(
        t("hallMap.presetSavedTo", {
          name: result.preset.name,
          hall: result.preset.hall?.name ?? ""
        })
      );
    } catch (error) {
      showFeedback(
        error instanceof Error ? error.message : t("hallMap.presetSaveFailed")
      );
    } finally {
      setIsSavingLayout(false);
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
        showSaveConfirmation(result.preset);
        showFeedback(t("hallMap.mapRenamedTo", { name: trimmedName }));
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
        showSaveConfirmation(result.preset);
        showFeedback(
          t("hallMap.createdForHall", {
            name: trimmedName,
            hall: result.preset.hall?.name ?? ""
          })
        );
      }

      setIsMapDialogOpen(false);
      setMapName("");
    } catch (error) {
      showFeedback(
        error instanceof Error ? error.message : t("hallMap.mapSaveFailed")
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
    } catch (error) {
      showFeedback(
        error instanceof Error ? error.message : t("hallMap.mapDeleteFailed")
      );
    }
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        compactMobileActions
        showSearch={false}
        subtitle={t("hallMap.blurb")}
        title={t("hallMap.title")}
        actionsSlot={
          <>
            {hasSelectedObject ? (
              <button
                className="hidden h-11 whitespace-nowrap rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-bold text-[#17202a] shadow-sm transition hover:border-[#1f4d73]/60 hover:bg-[#eef4fa] lg:block"
                onClick={clearObjectSelection}
                type="button"
              >
                {t("hallMap.clearSelection")}
              </button>
            ) : null}
            <button
              aria-label={t("hallMap.saveLayout")}
              className="hidden h-9 w-9 items-center justify-center rounded-lg bg-transparent text-[#1f4d73] shadow-none transition enabled:hover:text-[#15344f] disabled:cursor-not-allowed disabled:opacity-45 md:flex lg:h-11 lg:w-auto lg:whitespace-nowrap lg:rounded-xl lg:bg-[#1f4d73] lg:px-4 lg:text-sm lg:font-bold lg:text-white lg:shadow-sm lg:enabled:hover:bg-[#15344f] lg:enabled:hover:text-white"
              disabled={!hasSelectedMap || isSavingLayout}
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
              <span className="hidden lg:inline">{t("hallMap.saveLayout")}</span>
            </button>
          </>
        }
      />

      <span className="sr-only" aria-live="polite" role="status">
        {feedback}
      </span>

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-2 sm:p-3">
        <div className="mx-auto grid min-h-full w-full min-w-0 max-w-[1800px] gap-3 md:grid-cols-2 xl:grid-cols-[250px_minmax(0,1fr)_270px]">
          <HallMapLibraryPanel
            hallMaps={hallMaps}
            halls={hallMapsQuery.data?.halls ?? []}
            hasSelectedHall={hasSelectedHall}
            hasSelectedMap={hasSelectedMap}
            hasFloorPlan={Boolean(selectedMap?.backgroundPath)}
            onAddObject={addObject}
            onAddShapeLibraryObject={addShapeLibraryObject}
            onAddTableRows={addTableRows}
            onCopyMapToHall={copyMapToHall}
            onCreateShapeLibraryItem={createShapeLibraryItem}
            onDeleteMap={deleteCurrentMap}
            onRemoveFloorPlan={removeFloorPlan}
            onUploadFloorPlan={uploadFloorPlan}
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
              selectMapAndFit(nextMap);
            }}
            onSelectMap={(nextMap) => {
              selectMapAndFit(nextMap);
            }}
            selectedHallId={selectedHallId}
            selectedHallMaps={selectedHallMaps}
            selectedMapId={selectedMapId}
            selectedObjectExists={Boolean(selectedObject)}
            shapeLibrary={shapeLibrary}
          />

          <Panel className="relative order-1 flex min-h-0 min-w-0 flex-col md:col-span-2 xl:order-2 xl:col-span-1">
            <header className="flex items-center gap-2 border-b border-[#d8dde5] p-2">
              <h2 className="min-w-0 flex-1 truncate text-sm font-black">
                {t("hallMap.title")}
              </h2>

              <span
                aria-label={t("hallMap.seatCapacity")}
                className={`hidden rounded-lg border px-3 py-2 text-[10px] font-black md:inline-flex ${
                  isOverCapacity
                    ? "border-[#f3b4ae] bg-[#fef2f1] text-[#b42318]"
                    : "border-[#d8dde5] bg-[#f8fafc] text-[#617086]"
                }`}
                title={t("hallMap.seatSummary", {
                  adult: seatSummary.adult,
                  kids: seatSummary.kids,
                  head: seatSummary.head
                })}
              >
                {seatSummary.total} seats
                {typeof selectedHall?.capacity === "number" &&
                selectedHall.capacity > 0
                  ? ` / ${selectedHall.capacity}`
                  : ""}
              </span>

              {overlappingObjectIds.size > 0 ? (
                <span
                  className="hidden rounded-lg border border-[#f3b4ae] bg-[#fef2f1] px-3 py-2 text-[10px] font-black text-[#b42318] md:inline-flex"
                  role="status"
                >
                  {overlappingObjectIds.size} overlapping
                </span>
              ) : null}

              <button
                aria-pressed={isSnapEnabled}
                className={`hidden h-9 rounded-lg border px-3 text-[10px] font-black md:inline-flex md:items-center ${
                  isSnapEnabled
                    ? "border-[#1f4d73] bg-[#eef6fc] text-[#1f4d73]"
                    : "border-[#b9c2cf] bg-white text-[#617086] hover:bg-[#eef4fa]"
                }`}
                onClick={() => setIsSnapEnabled((current) => !current)}
                title={t("hallMap.snapToGrid")}
                type="button"
              >
                Snap {isSnapEnabled ? "on" : "off"}
              </button>

              <button
                aria-label={t("hallMap.printMap")}
                className="hidden h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-[10px] font-black hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-40 md:inline-flex md:items-center"
                disabled={!hasSelectedMap || objects.length === 0}
                onClick={() => setIsPrintOpen(true)}
                type="button"
              >
                {t("common.print")}
              </button>

              <div
                aria-label={t("hallMap.zoomControls")}
                className="hidden shrink-0 items-center overflow-hidden rounded-lg border border-[#b9c2cf] bg-white md:flex"
                role="group"
              >
                <button
                  aria-label={t("hallMap.zoomOut")}
                  className="h-9 w-9 text-lg font-black hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={mapScale <= MIN_MAP_SCALE}
                  onClick={() => zoomMap("out")}
                  title={t("hallMap.zoomOut")}
                  type="button"
                >
                  −
                </button>
                <button
                  aria-label={t("hallMap.fitAllShapes")}
                  className="h-9 min-w-14 border-x border-[#d8dde5] px-2 text-[10px] font-black hover:bg-[#eef4fa]"
                  onClick={fitAllShapes}
                  title={t("hallMap.fitAllShapes")}
                  type="button"
                >
                  {Math.round(mapScale * 100)}%
                </button>
                <button
                  aria-label={t("hallMap.zoomIn")}
                  className="h-9 w-9 text-lg font-black hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={mapScale >= MAX_MAP_SCALE}
                  onClick={() => zoomMap("in")}
                  title={t("hallMap.zoomIn")}
                  type="button"
                >
                  +
                </button>
              </div>

              <span className="ml-auto inline-flex rounded-lg border border-[#b9c2cf] bg-[#f5f6f8] px-3 py-2 text-[10px] font-black uppercase text-[#516174] md:hidden">
                {t("hallMap.viewOnly")}
              </span>

              <div className="ml-auto hidden shrink-0 gap-2 md:flex">
                <button
                  className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!hasSelectedMap || objects.length === 0}
                  onClick={clearMap}
                  type="button"
                >
                  {t("events.clear")}
                </button>

                <button
                  className="h-9 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!hasSelectedMap || isSavingLayout}
                  onClick={saveCurrentMap}
                  type="button"
                >
                  {t("hallMap.saveMap")}
                </button>
              </div>
            </header>

            {/*
                  ✓
            */}

            {/*
              The confirmation is a sibling of the pannable viewport, not a
              child of it. Inside, it scrolled with the 20,000-unit canvas: the
              board opens centred on the world origin, so a toast pinned to
              `top: 12px` of the content sat thousands of pixels above anything
              the user could see. Out here it stays pinned to the visible board.
              The wrapper carries the viewport's original layout classes so the
              board occupies exactly the same box as before.
            */}
            <div className="relative min-h-90 min-w-0 flex-1 overflow-hidden rounded-lg border border-[#bdc9d6] bg-[#fbfdff] md:min-h-107.5 lg:min-h-125 xl:min-h-0">
              <div
                aria-label={t("hallMap.grid")}
                className="absolute inset-0 cursor-grab touch-none overflow-hidden p-2 active:cursor-grabbing"
                // Scoped to the board, never the document: right-click keeps
                // working everywhere else in the app. The event fires on
                // mouse-up on Windows and mouse-down on some Linux and macOS
                // setups, so it is suppressed here rather than inside the
                // pointer handlers.
                onContextMenu={(event) => event.preventDefault()}
                onPointerCancel={handleMapPointerUp}
                onPointerDown={handleMapPointerDown}
                onPointerMove={handleMapPointerMove}
                onPointerUp={handleMapPointerUp}
                ref={mapViewportRef}
                // The world surface is intentionally very large. Size
                // containment prevents it from increasing the dashboard row's
                // height, while its scrollable overflow remains available.
                style={{ contain: "size" }}
              >
              <div
                className="relative mx-auto"
                style={{
                  height: mapDimensions.height * mapScale,
                  width: mapDimensions.width * mapScale
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
                    // The viewport is the only visible board boundary. Keeping
                    // this logical surface borderless avoids an artificial
                    // limit line inside the continuous draggable grid.
                    height: mapDimensions.height,
                    backgroundColor: "#fbfdff",
                    backgroundImage:
                      "linear-gradient(#dce5ef 1px, transparent 1px), linear-gradient(90deg, #dce5ef 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                    transform: `scale(${mapScale})`,
                    transformOrigin: "top left",
                    width: mapDimensions.width
                  }}
                >
                  {floorPlanUrl ? (
                    // The hall's real floor plan, anchored at map (0,0) so
                    // shape coordinates line up with it. Decorative: it takes
                    // no pointer events and screen readers skip it. A plain
                    // img on purpose - next/image would proxy the short-lived
                    // signed URL through the optimizer, which caches beyond
                    // the URL's lifetime and needs fixed dimensions this
                    // natural-size layer does not have.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="pointer-events-none absolute max-w-none opacity-60"
                      src={floorPlanUrl}
                      style={{ left: MAP_WORLD_ORIGIN, top: MAP_WORLD_ORIGIN }}
                    />
                  ) : null}

                  {marquee ? (
                    // Drawn inside the scaled surface in world coordinates, so
                    // it stays anchored to the floor plan if the board is
                    // scrolled mid-drag. The border is divided by the scale to
                    // stay a hairline at any zoom.
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute z-30 border-dashed border-[#1f4d73] bg-[#1f4d73]/10"
                      style={{
                        borderWidth: Math.max(1, 1.5 / mapScale),
                        height: marquee.maxY - marquee.minY,
                        left: marquee.minX + MAP_WORLD_ORIGIN,
                        top: marquee.minY + MAP_WORLD_ORIGIN,
                        width: marquee.maxX - marquee.minX
                      }}
                    />
                  ) : null}

                  {objects.map((object) => (
                    <MapObjectView
                      key={object.id}
                      object={object}
                      overlapping={overlappingObjectIds.has(object.id)}
                      onDragEnd={stopDragging}
                      onDragMove={dragObject}
                      onDragStart={(event) => startDragging(event, object)}
                      onResizeEnd={stopResizing}
                      onResizeMove={resizeObject}
                      onResizeStart={(event, edge) =>
                        startResizing(event, object, edge)
                      }
                      onRotateEnd={stopRotating}
                      onRotateMove={rotateObject}
                      onRotateStart={(event) => startRotating(event, object)}
                      onSelect={(event) => {
                        if (suppressNextObjectClickRef.current) {
                          suppressNextObjectClickRef.current = false;
                          return;
                        }

                        selectObjectFromPointer(object.id, event);
                      }}
                      selected={selectedObjectIdSet.has(object.id)}
                      worldOrigin={MAP_WORLD_ORIGIN}
                    />
                  ))}
                </div>
              </div>
              </div>
            </div>

            <details
              className="group absolute right-3 bottom-3 z-30 hidden md:block"
              ref={shortcutsRef}
            >
              <summary
                aria-label={t("hallMap.showShortcuts")}
                className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full bg-[#1f4d73] text-sm font-black text-white shadow-md transition hover:bg-[#15344f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4d73] [&::-webkit-details-marker]:hidden"
                title={t("hallMap.shortcuts")}
              >
                ?
              </summary>

              <div className="absolute right-0 bottom-11 w-72 rounded-xl border border-[#bdc9d6] bg-white p-3 text-[#17202a] shadow-xl">
                <p className="text-xs font-black">{t("hallMap.shortcutsTitle")}</p>
                <dl className="mt-2 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 text-[10px] [&_dd]:text-right [&_kbd]:whitespace-nowrap [&_kbd]:rounded [&_kbd]:border [&_kbd]:border-[#d8dde5] [&_kbd]:bg-[#f5f6f8] [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:font-mono [&_kbd]:font-bold">
                  <dt>{t("hallMap.zoomIn")}</dt><dd><kbd>Ctrl/Cmd + +</kbd></dd>
                  <dt>{t("hallMap.zoomOut")}</dt><dd><kbd>Ctrl/Cmd + −</kbd></dd>
                  <dt>{t("hallMap.resetZoom")}</dt><dd><kbd>Ctrl/Cmd + 0</kbd></dd>
                  <dt>{t("hallMap.fitAllShapes")}</dt><dd><kbd>Shift + 1</kbd></dd>
                  <dt>{t("hallMap.zoomAtPointer")}</dt><dd><kbd>Ctrl/Cmd + wheel</kbd></dd>
                  <dt>{t("hallMap.selectAll")}</dt><dd><kbd>Ctrl/Cmd + A</kbd></dd>
                  <dt>{t("hallMap.addToSelection")}</dt><dd><kbd>Shift + click</kbd></dd>
                  <dt>{t("hallMap.clearSelection")}</dt><dd><kbd>Esc</kbd></dd>
                  <dt>{t("hallMap.copyPaste")}</dt><dd><kbd>Ctrl/Cmd + C / V</kbd></dd>
                  <dt>{t("hallMap.undo")}</dt><dd><kbd>Ctrl/Cmd + Z</kbd></dd>
                  <dt>{t("hallMap.moveShape")}</dt><dd><kbd>Arrow keys</kbd></dd>
                  <dt>{t("hallMap.move10Units")}</dt><dd><kbd>Shift + arrows</kbd></dd>
                  <dt>{t("hallMap.rotateClockwise")}</dt><dd><kbd>R</kbd></dd>
                  <dt>{t("hallMap.rotateCounterclockwise")}</dt><dd><kbd>Shift + R</kbd></dd>
                  <dt>{t("hallMap.resetRotation")}</dt><dd><kbd>Alt + R</kbd></dd>
                  <dt>{t("hallMap.deleteShape")}</dt><dd><kbd>Delete</kbd></dd>
                </dl>
                <p className="mt-3 border-t border-[#e2e7ee] pt-2 text-[9px] text-[#617086]">
                  {t("hallMap.modifierHint")}
                </p>
              </div>
            </details>

          </Panel>

          <HallMapObjectInspector
            onUpdateSelectedObject={updateSelectedObject}
            selectedObject={selectedObject}
          />
        </div>
      </main>

      {saveConfirmation ? (
        // Pinned to the viewport, not the board: the board's top edge can be
        // scrolled out of view when the user saves from the bottom of the
        // page, and a message positioned there fired into invisible space.
        // Fixed under the topbar it sits directly below the Save button the
        // user just clicked, at every scroll position.
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
          <div className="min-w-0">
            <p className="text-sm font-black">{saveConfirmation.title}</p>
            <p className="mt-0.5 text-xs font-semibold text-[#047857]">
              {saveConfirmation.detail}
            </p>
          </div>
        </div>
      ) : null}

      {isSavingLayout ? (
        // Same loading design as the rest of the app: the dashboard's
        // animated indicator centred on the app ground, translucent so the
        // board stays visible underneath while the save round-trips.
        <div
          aria-label={t("hallMap.savingLayout")}
          aria-live="polite"
          className="fixed inset-0 z-2000 flex flex-col items-center justify-center gap-4 bg-[#f5f6f8]/90"
          role="status"
        >
          <DashboardLoadingIndicator />
          <p className="text-sm font-black text-[#1f4d73]">
            {t("hallMap.savingYourLayout")}
          </p>
        </div>
      ) : null}

      {isPrintOpen && selectedMap ? (
        <HallMapPrintSheet
          hallName={selectedHall?.name ?? ""}
          mapName={selectedMap.name}
          objects={objects}
          onClose={() => setIsPrintOpen(false)}
        />
      ) : null}

      <HallMapDialog
        halls={hallMapsQuery.data?.halls ?? []}
        isCreating={createMapMutation.isPending}
        isUpdating={updateMapMutation.isPending}
        mapHallId={mapHallId}
        mapName={mapName}
        mode={mapDialogMode}
        onSubmit={submitMapDialog}
        open={isMapDialogOpen}
        setMapHallId={setMapHallId}
        setMapName={setMapName}
        setOpen={setIsMapDialogOpen}
      />
    </div>
  );
}
