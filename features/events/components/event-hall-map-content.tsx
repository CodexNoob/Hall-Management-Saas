"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { validPresetObjects } from "@/features/dining/components/dining-shared";
import {
  Badge,
  LineIcon,
  type EventFile
} from "@/features/events/components/event-manager-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

const EVENT_MAP_ASPECT_RATIO = 760 / 520;
const EVENT_MAP_PADDING = 44;
const EVENT_MAP_MIN_ZOOM = 0.75;
const EVENT_MAP_MAX_ZOOM = 3;
const EVENT_MAP_ZOOM_STEP = 0.25;

function getFittedMapFrame(
  objects: ReturnType<typeof validPresetObjects>
): { minX: number; minY: number; width: number; height: number } | null {
  if (objects.length === 0) return null;

  const bounds = objects.reduce(
    (current, object) => ({
      minX: Math.min(current.minX, object.x),
      minY: Math.min(current.minY, object.y),
      maxX: Math.max(current.maxX, object.x + object.width),
      maxY: Math.max(current.maxY, object.y + object.height)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );

  let minX = bounds.minX - EVENT_MAP_PADDING;
  let minY = bounds.minY - EVENT_MAP_PADDING;
  let width = Math.max(1, bounds.maxX - bounds.minX + EVENT_MAP_PADDING * 2);
  let height = Math.max(1, bounds.maxY - bounds.minY + EVENT_MAP_PADDING * 2);
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  if (width / height > EVENT_MAP_ASPECT_RATIO) {
    height = width / EVENT_MAP_ASPECT_RATIO;
    minY = centerY - height / 2;
  } else {
    width = height * EVENT_MAP_ASPECT_RATIO;
    minX = centerX - width / 2;
  }

  return { minX, minY, width, height };
}

export function HallMapContent({ event }: { event: EventFile }) {
  const { t } = useAppLanguage();
  const router = useRouter();
  const preset = event.diningHallMapPreset;
  const objects = validPresetObjects(preset?.objects);
  const fittedFrame = getFittedMapFrame(objects);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);

  useLayoutEffect(() => {
    dragStartRef.current = null;
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [event.id, preset?.name]);

  function updateZoom(nextZoom: number) {
    setZoom(Math.min(EVENT_MAP_MAX_ZOOM, Math.max(EVENT_MAP_MIN_ZOOM, nextZoom)));
  }

  function fitLayout() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    if (!objects.length || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      panX: pan.x,
      panY: pan.y
    };
  }

  function movePan(event: React.PointerEvent<HTMLDivElement>) {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;
    setPan({
      x: dragStart.panX + event.clientX - dragStart.clientX,
      y: dragStart.panY + event.clientY - dragStart.clientY
    });
  }

  function stopPan(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current?.pointerId === event.pointerId) {
      dragStartRef.current = null;
    }
  }

  const gridStyle = {
    backgroundImage:
      "linear-gradient(#d8dde5 1px, transparent 1px), linear-gradient(90deg, #d8dde5 1px, transparent 1px)",
    backgroundSize: "22px 22px"
  };

  return (
    <div className="grid min-w-0 gap-3 overflow-hidden xl:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-3">
        <section className="rounded-lg border border-[#d8dde5] bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
            <div className="flex items-center gap-2">
              <LineIcon name="map" />
              <h2 className="text-sm font-black text-[#17202a]">
                {t("events.diningHallMap")}
              </h2>
            </div>
            <button
              className="hidden h-8 shrink-0 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa] md:inline-flex"
              type="button"
              onClick={() => router.push("/dashboard/dining-manager")}
            >
              <LineIcon name="fork" />
              {t("events.openDining")}
            </button>
          </header>
          <div className="space-y-3 p-3 text-sm leading-5 text-[#17202a]">
            {preset ? (
              <>
                <div className="rounded-lg border border-[#d8dde5] bg-[#f8fafc] p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#59677c]">
                    {t("events.savedPreset")}
                  </p>
                  <p className="mt-1 text-sm font-black text-[#17202a]">
                    {preset.name}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#617086]">
                    {t("events.hallMapFromDining")}
                  </p>
                </div>
                <div className="rounded-lg border border-[#d8dde5] bg-white p-3 text-xs font-bold text-[#516174]">
                  {objects.length} saved map objects
                </div>
              </>
            ) : (
              <p>
                {t("events.noPresetSaved")}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-[#d8dde5] bg-white p-3 text-sm leading-5 text-[#17202a]">
          <span className="md:hidden">
            {t("events.hallMapPhoneHint")}
          </span>
          <span className="hidden md:inline">
            {t("events.hallMapReadOnlyHint")}
          </span>
        </section>

        <button
          className="hidden h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f] md:inline-flex"
          type="button"
          onClick={() => router.push("/dashboard/dining-manager")}
        >
          <LineIcon name="fork" />
          {t("events.updateInDining")}
        </button>
      </aside>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <LineIcon name="map" />
            <h2 className="truncate text-sm font-black text-[#17202a]">
              {preset?.name ?? t("events.diningHallMap")}
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {objects.length ? (
              <div
                aria-label={t("events.hallMapZoomControls")}
                className="hidden overflow-hidden rounded-lg border border-[#b9c2cf] bg-white text-xs font-black text-[#17202a] md:inline-flex"
              >
                <button
                  aria-label={t("events.hallMapZoomOut")}
                  className="h-8 w-8 hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={zoom <= EVENT_MAP_MIN_ZOOM}
                  type="button"
                  onClick={() => updateZoom(zoom - EVENT_MAP_ZOOM_STEP)}
                >
                  -
                </button>
                <button
                  aria-label={t("events.hallMapFit")}
                  className="h-8 min-w-16 border-x border-[#d8dde5] px-2 text-[10px] hover:bg-[#eef4fa]"
                  type="button"
                  onClick={fitLayout}
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  aria-label={t("events.hallMapZoomIn")}
                  className="h-8 w-8 hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={zoom >= EVENT_MAP_MAX_ZOOM}
                  type="button"
                  onClick={() => updateZoom(zoom + EVENT_MAP_ZOOM_STEP)}
                >
                  +
                </button>
              </div>
            ) : null}
            <span className="inline-flex rounded-full border border-[#b9c2cf] bg-[#f5f6f8] px-2 py-1 text-[10px] font-black uppercase text-[#516174] md:hidden">
              {t("events.viewOnly")}
            </span>
            <Badge tone={preset ? "green" : "gold"}>
              {preset ? t("events.savedDiningLayout") : t("events.needsDiningLayout")}
            </Badge>
          </div>
        </header>
        <div className="px-4 pb-4">
          <div
            className={`min-h-80 min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] p-3 sm:p-6 ${
              objects.length ? "cursor-grab active:cursor-grabbing" : ""
            }`}
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={stopPan}
            onPointerCancel={stopPan}
            style={gridStyle}
          >
            {objects.length ? (
              <div
                className="relative mx-auto aspect-[760/520] w-full max-w-[760px] select-none touch-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: dragStartRef.current ? undefined : "transform 160ms ease"
                }}
              >
                {objects.map((object) => {
                  const frame = fittedFrame ?? {
                    minX: 0,
                    minY: 0,
                    width: 760,
                    height: 520
                  };
                  const isRound =
                    object.type === "round-table" ||
                    object.type === "kids-table" ||
                    object.type === "circle";
                  const isDivider = object.type === "divider";
                  const isServiceShape =
                    object.type === "buffet" || object.type === "drinks";
                  const objectLabel = object.name || object.type;
                  const seatLabel =
                    typeof object.seats === "number" && object.seats > 0
                      ? ` - ${object.seats} seats`
                      : "";

                  return (
                    <div
                      className={`absolute flex items-center justify-center overflow-hidden px-1 text-center text-[9px] font-black shadow-sm ${
                        isDivider
                          ? "rounded bg-[#344a60] text-white"
                          : "border bg-white"
                      } ${
                        isServiceShape
                          ? "border-dashed border-[#526c86]"
                          : "border-[#526c86]"
                      } ${isRound ? "rounded-full" : "rounded-lg"}`}
                      key={object.id}
                      style={{
                        left: `${((object.x - frame.minX) / frame.width) * 100}%`,
                        top: `${((object.y - frame.minY) / frame.height) * 100}%`,
                        width: `${(object.width / frame.width) * 100}%`,
                        height: `${(object.height / frame.height) * 100}%`,
                        transform: `rotate(${object.rotation}deg)`
                      }}
                      title={`${objectLabel}${seatLabel}`}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <span
                        className={`line-clamp-2 ${
                          zoom < 1 ? "text-[8px]" : "text-[9px]"
                        }`}
                      >
                        {objectLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-lg bg-white/80 p-6 text-center">
                <LineIcon name="map" className="h-8 w-8 text-[#8a94a3]" />
                <h3 className="mt-3 text-sm font-black text-[#17202a]">
                  {t("events.noSavedHallMap")}
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#617086]">
                  {t("events.noSavedHallMapBody")}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
