"use client";

import { type PointerEvent as ReactPointerEvent } from "react";
import { type MapObject } from "@/features/hall-room-map/components/hall-map-shared";

export function MapObjectView({
  object,
  onDragEnd,
  onDragMove,
  onDragStart,
  selected,
  onSelect
}: {
  object: MapObject;
  onDragEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const isTable =
    object.type === "round-table" ||
    object.type === "kids-table" ||
    object.type === "circle";

  const isDashed = object.type === "buffet" || object.type === "drinks";

  const isDivider = object.type === "divider";
  const renderedWidth = isTable ? Math.max(object.width, 68) : object.width;
  const renderedHeight = isTable ? Math.max(object.height, 68) : object.height;

  return (
    <button
      aria-label={`Select ${object.name}`}
      data-map-object="true"
      className={`absolute flex touch-none cursor-move flex-col items-center justify-center overflow-hidden px-1.5 py-1 text-center text-[9px] leading-[1.05] font-black select-none ${
        isTable ? "rounded-full" : "rounded-md"
      } ${
        isDashed
          ? "border border-dashed border-[#36516b] bg-[#f7fbff]"
          : isDivider
            ? "rounded-sm bg-[#344a60] text-white"
            : "border border-[#526c86] bg-white"
      } ${
        selected
          ? "z-10 ring-2 ring-[#1f5f91] ring-offset-2"
          : "hover:ring-2 hover:ring-[#8fbce3]"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerCancel={onDragEnd}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      style={{
        height: renderedHeight,
        left: object.x,
        top: object.y,
        transform: `rotate(${object.rotation}deg)`,
        width: renderedWidth
      }}
      type="button"
    >
      <span className="max-w-full wrap-break-word">{object.name}</span>

      {object.seats > 0 ? (
        <span className="mt-1 shrink-0 whitespace-nowrap text-[7px] leading-none font-semibold">
          {object.seats} seats
        </span>
      ) : null}
    </button>
  );
}
