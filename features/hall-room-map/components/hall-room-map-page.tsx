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

import { InspectorField } from "@/features/hall-room-map/components/hall-map-inspector-field";
import { MapObjectView } from "@/features/hall-room-map/components/hall-map-object-view";
import { Panel } from "@/features/hall-room-map/components/hall-map-panel";
import {
  ShapeButton,
  ShapePreview
} from "@/features/hall-room-map/components/hall-map-shape-library";
import {
  DESIGN_MAP_HEIGHT,
  DESIGN_MAP_WIDTH,
  HALL_MAP_STORAGE_KEY,
  MAP_VIEWPORT_PADDING,
  clampViewportPosition,
  getMapObjectBounds,
  initialHallMaps,
  shapeOptions,
  type HallMapsResponse,
  type MapObject,
  type SaveHallMapInput,
  type SeatingUse,
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
          setSelectedObjectId(null);
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

    setObjects((current) => [...current, newObject]);
    setSelectedObjectId(id);
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
    setSelectedObjectId(object.id);
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

    const duplicate: MapObject = {
      ...selectedObject,
      id: `${selectedObject.type}-${crypto.randomUUID()}`,
      name: `${selectedObject.name} copy`,
      x: selectedObject.x + 20,
      y: selectedObject.y + 20
    };

    setObjects((current) => [...current, duplicate]);
    setSelectedObjectId(duplicate.id);
    showFeedback(`${selectedObject.name} duplicated.`);
  }

  function deleteSelectedObject() {
    if (!selectedObjectId) {
      return;
    }

    setObjects((current) =>
      current.filter((object) => object.id !== selectedObjectId)
    );
    setSelectedObjectId(null);
    showFeedback("Shape deleted.");
  }

  function clearMap() {
    if (!selectedMap || objects.length === 0) {
      return;
    }
    if (!window.confirm("Clear every shape from this hall room map?")) {
      return;
    }
    setObjects([]);
    setSelectedObjectId(null);
    showFeedback("Map cleared. Save the map to keep this change.");
  }

  function loadPreset() {
    if (!selectedMap) {
      return;
    }

    const nextObjects = selectedMap.objects.map((object) => ({ ...object }));
    setObjects(nextObjects);
    setSelectedObjectId(null);
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
        setSelectedObjectId(null);
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
      setSelectedObjectId(null);
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
              disabled={!selectedObject}
              onClick={() => setSelectedObjectId(null)}
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
                    onClick={() => addObject(shape.type)}
                    type={shape.type}
                  />
                ))}
              </div>

              <button
                className="mt-2 flex min-h-14 w-full flex-col items-center justify-center gap-2 rounded-lg border border-[#d1dae5] text-[10px] font-black enabled:hover:border-[#1f4d73] enabled:hover:bg-[#eef6fc] disabled:cursor-not-allowed disabled:opacity-45 max-md:pointer-events-none max-md:opacity-60"
                disabled={!hasSelectedMap}
                onClick={() => addObject("divider")}
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
                    if (!nextMap) {
                      return;
                    }
                    setSelectedMapId(nextMap.id);
                    setObjects(
                      nextMap.objects.map((object) => ({ ...object }))
                    );
                    setSelectedObjectId(null);
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
                  disabled={hallMapsQuery.data?.halls.length === 0}
                  id="assigned-hall"
                  onChange={(hallId) => {
                    const nextMap =
                      hallMaps.find((map) => map.hallId === hallId) ?? null;
                    setSelectedHallId(hallId);
                    setSelectedMapId(nextMap?.id ?? "");
                    setObjects(
                      nextMap?.objects.map((object) => ({ ...object })) ?? []
                    );
                    setSelectedObjectId(null);
                  }}
                  options={[
                    { label: "Select a hall", value: "" },
                    ...(hallMapsQuery.data?.halls ?? []).map((hall) => ({
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
                    onClick={loadPreset}
                    type="button"
                  >
                    Load preset
                  </button>

                  <button
                    className="h-9 min-w-0 whitespace-nowrap rounded-lg bg-[#1f4d73] px-1 text-[10px] font-black text-white enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!hasSelectedMap}
                    onClick={saveCurrentMap}
                    type="button"
                  >
                    Save preset
                  </button>
                </div>

                <button
                  className="mt-2 h-9 w-full whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-2 text-[10px] font-black hover:bg-[#eef4fa] max-md:pointer-events-none max-md:opacity-60"
                  onClick={openCreateMapDialog}
                  type="button"
                >
                  New hall room map
                </button>

                <div className="mt-2 grid grid-cols-2 gap-2 max-md:pointer-events-none max-md:opacity-60">
                  <button
                    className="h-9 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-1 text-[10px] font-black enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!hasSelectedMap}
                    onClick={openRenameMapDialog}
                    type="button"
                  >
                    Rename
                  </button>
                  <button
                    className="h-9 whitespace-nowrap rounded-lg border border-[#efb5ad] bg-white px-1 text-[10px] font-black text-[#c3291b] enabled:hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!hasSelectedMap}
                    onClick={deleteCurrentMap}
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
                    disabled={!selectedObject}
                    onClick={duplicateSelectedObject}
                    type="button"
                  >
                    Duplicate
                  </button>

                  <button
                    className="h-9 rounded-lg border border-[#efb5ad] bg-white text-[10px] font-black text-[#c3291b] enabled:hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedObject}
                    onClick={deleteSelectedObject}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </section>
            </div>
          </Panel>

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

                    setSelectedObjectId(null);
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
                      onSelect={() => setSelectedObjectId(object.id)}
                      selected={selectedObjectId === object.id}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="order-3 block md:block">
            <header className="border-b border-[#d8dde5] px-3 py-2">
              <h2 className="text-sm font-black">Object inspector</h2>

              <p className="mt-1 text-[10px] text-[#617086]">
                Selected shape settings.
              </p>
            </header>

            <div className="p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[#d8dde5] bg-[#f8fafc] p-2">
                  <strong className="block truncate text-base">
                    {selectedObject?.type ?? "None"}
                  </strong>

                  <span className="mt-2 block text-[9px] font-black uppercase text-[#617086]">
                    Type
                  </span>
                </div>

                <div className="rounded-lg border border-[#d8dde5] bg-[#f8fafc] p-2">
                  <strong className="block text-base">
                    {selectedObject?.rotation ?? 0}°
                  </strong>

                  <span className="mt-2 block text-[9px] font-black uppercase text-[#617086]">
                    Rotation
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <InspectorField htmlFor="object-name">Name</InspectorField>

                <input
                  className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
                  disabled={!selectedObject}
                  id="object-name"
                  name="objectName"
                  onChange={(event) =>
                    updateSelectedObject({ name: event.target.value })
                  }
                  placeholder="Select object"
                  value={selectedObject?.name ?? ""}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <InspectorField htmlFor="object-width">Width</InspectorField>

                  <input
                    className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
                    disabled={!selectedObject}
                    id="object-width"
                    min="10"
                    name="objectWidth"
                    onChange={(event) =>
                      updateSelectedObject({
                        width: Number(event.target.value)
                      })
                    }
                    type="number"
                    value={selectedObject?.width ?? ""}
                  />
                </div>

                <div>
                  <InspectorField htmlFor="object-height">
                    Height
                  </InspectorField>

                  <input
                    className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
                    disabled={!selectedObject}
                    id="object-height"
                    min="10"
                    name="objectHeight"
                    onChange={(event) =>
                      updateSelectedObject({
                        height: Number(event.target.value)
                      })
                    }
                    type="number"
                    value={selectedObject?.height ?? ""}
                  />
                </div>

                <div>
                  <InspectorField htmlFor="object-seats">Seats</InspectorField>

                  <input
                    className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
                    disabled={!selectedObject}
                    id="object-seats"
                    min="0"
                    name="objectSeats"
                    onChange={(event) =>
                      updateSelectedObject({
                        seats: Number(event.target.value)
                      })
                    }
                    type="number"
                    value={selectedObject?.seats ?? ""}
                  />
                </div>

                <div>
                  <InspectorField htmlFor="seating-use">
                    Seating use
                  </InspectorField>

                  <CompactSelect
                    disabled={!selectedObject}
                    id="seating-use"
                    onChange={(value) =>
                      updateSelectedObject({
                        seatingUse: value as SeatingUse
                      })
                    }
                    options={[
                      { label: "No seating", value: "none" },
                      { label: "Adult seating", value: "adult" },
                      { label: "Kids seating", value: "kids" },
                      { label: "Head table", value: "head" }
                    ]}
                    value={selectedObject?.seatingUse ?? "none"}
                  />
                </div>

                <div>
                  <InspectorField htmlFor="object-x">X</InspectorField>

                  <input
                    className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
                    disabled={!selectedObject}
                    id="object-x"
                    name="objectX"
                    onChange={(event) =>
                      updateSelectedObject({
                        x: Number(event.target.value)
                      })
                    }
                    type="number"
                    value={selectedObject?.x ?? ""}
                  />
                </div>

                <div>
                  <InspectorField htmlFor="object-y">Y</InspectorField>

                  <input
                    className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
                    disabled={!selectedObject}
                    id="object-y"
                    name="objectY"
                    onChange={(event) =>
                      updateSelectedObject({
                        y: Number(event.target.value)
                      })
                    }
                    type="number"
                    value={selectedObject?.y ?? ""}
                  />
                </div>
              </div>

              <div className="mt-3">
                <InspectorField htmlFor="object-rotation">
                  Rotation
                </InspectorField>

                <input
                  className="h-8 w-full rounded-lg border border-[#b9c2cf] px-2 text-xs sm:h-9 sm:text-sm disabled:bg-[#f5f6f8]"
                  disabled={!selectedObject}
                  id="object-rotation"
                  max="360"
                  min="0"
                  name="objectRotation"
                  onChange={(event) =>
                    updateSelectedObject({
                      rotation: Number(event.target.value)
                    })
                  }
                  type="number"
                  value={selectedObject?.rotation ?? ""}
                />
              </div>

              <p className="mt-3 text-[10px] leading-5 text-[#617086]">
                The inspector updates one selected object. Tables have a seat
                count and seating use. Edit the name field to rename a shape.
              </p>
            </div>
          </Panel>
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
