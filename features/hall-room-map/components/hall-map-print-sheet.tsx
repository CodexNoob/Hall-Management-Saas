"use client";

import { useEffect } from "react";

import { TableSeats } from "@/components/shared/table-seats";
import {
  getDefaultSeatingSides,
  getMapObjectBounds,
  getRenderedObjectSize,
  isTableShape,
  summarizeSeats,
  type MapObject
} from "@/features/hall-room-map/components/hall-map-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

/**
 * A printable sheet for the setup crew: the layout scaled to fit one page,
 * with the map name, hall, and seat totals in the header.
 *
 * Printing uses the visibility trick rather than a new window so the sheet
 * shares the app's styles: everything is hidden under `@media print` except
 * the sheet, which is lifted to the top of the page. On screen it renders as
 * a full-screen overlay with its own Print button.
 */
export function HallMapPrintSheet({
  hallName,
  mapName,
  objects,
  onClose
}: {
  hallName: string;
  mapName: string;
  objects: MapObject[];
  onClose: () => void;
}) {
  const { t } = useAppLanguage();
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const bounds = getMapObjectBounds(objects);
  const summary = summarizeSeats(objects);

  if (!bounds) return null;

  const margin = 48;
  const sheetWidth = 1000;
  const sheetHeight = 640;
  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX + margin * 2);
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY + margin * 2);
  const scale = Math.min(
    sheetWidth / boundsWidth,
    sheetHeight / boundsHeight,
    1
  );

  return (
    <div className="hall-map-print-sheet fixed inset-0 z-50 overflow-auto bg-[#17202a]/40 p-4 print:static print:overflow-visible print:bg-white print:p-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .hall-map-print-sheet, .hall-map-print-sheet * { visibility: visible; }
          .hall-map-print-sheet { position: absolute; inset: 0; }
        }
      `}</style>

      <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow-2xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 print:hidden">
          <h2 className="text-base font-black text-[#17202a]">{t("hallMap.printPreview")}</h2>
          <div className="flex gap-2">
            <button
              className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f]"
              onClick={() => window.print()}
              type="button"
            >
              {t("hallMap.print")}
            </button>
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black hover:bg-[#eef4fa]"
              onClick={onClose}
              type="button"
            >
              {t("hallMap.close")}
            </button>
          </div>
        </div>

        <header className="mt-4 border-b border-[#d8dde5] pb-3 print:mt-0">
          <h1 className="text-xl font-black text-[#17202a]">{mapName}</h1>
          <p className="mt-1 text-sm font-semibold text-[#617086]">
            {hallName} · {summary.total} seats ({summary.adult} adult ·{" "}
            {summary.kids} kids · {summary.head} head table)
          </p>
        </header>

        <div
          className="relative mt-4 overflow-hidden rounded-lg border border-[#d8dde5] bg-[#fbfdff]"
          style={{ height: boundsHeight * scale + 2 }}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: boundsWidth,
              height: boundsHeight
            }}
          >
            {objects.map((object) => {
              const isTable = isTableShape(object.type);
              const isDashed =
                object.type === "buffet" || object.type === "drinks";
              const isDivider = object.type === "divider";
              const rendered = getRenderedObjectSize(object);

              return (
                <div
                  className={`absolute flex flex-col items-center justify-center overflow-visible px-1.5 py-1 text-center text-[9px] font-black leading-[1.05] ${
                    isTable ? "rounded-full" : "rounded-md"
                  } ${
                    isDashed
                      ? "border border-dashed border-[#36516b] bg-[#f7fbff]"
                      : isDivider
                        ? "rounded-sm bg-[#344a60] text-white"
                        : "border border-[#526c86] bg-white"
                  }`}
                  key={object.id}
                  style={{
                    height: rendered.height,
                    left: object.x - bounds.minX + margin,
                    top: object.y - bounds.minY + margin,
                    transform: `rotate(${object.rotation}deg)`,
                    width: rendered.width
                  }}
                >
                  <TableSeats
                    height={rendered.height}
                    round={isTable}
                    seats={object.seats}
                    sides={
                      object.seatingSides ?? getDefaultSeatingSides(object.type)
                    }
                    width={rendered.width}
                  />
                  <span className="max-w-full wrap-break-word">
                    {object.name}
                  </span>
                  {object.seats > 0 ? (
                    <span className="text-[7px] font-semibold leading-none">
                      {object.seats} seats
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
