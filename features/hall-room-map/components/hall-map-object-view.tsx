"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import { TableSeats } from "@/components/shared/table-seats";
import {
  getDefaultSeatingSides,
  getRenderedObjectSize,
  isTableShape,
  type MapObject,
  type ResizeEdge
} from "@/features/hall-room-map/components/hall-map-shared";

const resizeHandles: Array<{
  edge: ResizeEdge;
  position: string;
  cursor: string;
}> = [
  { edge: "north", position: "-top-1.5 left-1/2 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { edge: "east", position: "-right-1.5 top-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
  { edge: "south", position: "-bottom-1.5 left-1/2 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { edge: "west", position: "-left-1.5 top-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" }
];

export function MapObjectView({
  object,
  onDragEnd,
  onDragMove,
  onDragStart,
  onResizeEnd,
  onResizeMove,
  onResizeStart,
  onRotateEnd,
  onRotateMove,
  onRotateStart,
  overlapping = false,
  selected,
  onSelect,
  worldOrigin = 0
}: {
  object: MapObject;
  /** Another shape's footprint (chairs included) intersects this one. */
  overlapping?: boolean;
  onDragEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizeEnd: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onResizeMove: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onResizeStart: (
    event: ReactPointerEvent<HTMLSpanElement>,
    edge: ResizeEdge
  ) => void;
  onRotateEnd: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onRotateMove: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onRotateStart: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  selected: boolean;
  onSelect: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  worldOrigin?: number;
}) {
  const isTable = isTableShape(object.type);

  const isDashed = object.type === "buffet" || object.type === "drinks";

  const isDivider = object.type === "divider";
  // Shared with the bounds maths so the box on screen is the box being clamped.
  const { width: renderedWidth, height: renderedHeight } =
    getRenderedObjectSize(object);

  return (
    <button
      aria-label={`Select ${object.name}`}
      data-map-object="true"
      className={`absolute flex touch-none cursor-move flex-col items-center justify-center overflow-visible px-1.5 py-1 text-center text-[9px] leading-[1.05] font-black select-none ${
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
          : overlapping
            ? "ring-2 ring-[#dc2626]/70 hover:ring-[#dc2626]"
            : "hover:ring-2 hover:ring-[#8fbce3]"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(event);
      }}
      onPointerCancel={onDragEnd}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      style={{
        height: renderedHeight,
        left: object.x + worldOrigin,
        top: object.y + worldOrigin,
        transform: `rotate(${object.rotation}deg)`,
        width: renderedWidth
      }}
      type="button"
    >
      <TableSeats
        height={renderedHeight}
        round={isTable}
        seats={object.seats}
        sides={object.seatingSides ?? getDefaultSeatingSides(object.type)}
        width={renderedWidth}
      />

      <span className="max-w-full wrap-break-word">{object.name}</span>

      {object.seats > 0 ? (
        <span className="mt-1 shrink-0 whitespace-nowrap text-[7px] leading-none font-semibold">
          {object.seats} seats
        </span>
      ) : null}

      {selected
        ? resizeHandles.map((handle) => (
            <span
              aria-hidden="true"
              data-resize-handle={handle.edge}
              key={handle.edge}
              className={`absolute z-20 h-3 w-3 rounded-full border-2 border-[#1f5f91] bg-white shadow-sm ${handle.position} ${handle.cursor}`}
              onPointerCancel={onResizeEnd}
              onPointerDown={(event) => onResizeStart(event, handle.edge)}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
              title={`Drag to resize ${object.name} from the ${handle.edge} edge`}
            />
          ))
        : null}

      {selected ? (
        <span
          aria-hidden="true"
          className="absolute -top-9 left-1/2 z-20 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-white bg-[#1f4d73] text-[11px] text-white shadow-md active:cursor-grabbing"
          data-rotate-handle="true"
          onPointerCancel={onRotateEnd}
          onPointerDown={onRotateStart}
          onPointerMove={onRotateMove}
          onPointerUp={onRotateEnd}
          title={`Drag to rotate ${object.name}`}
        >
          ↻
          <span className="absolute top-full h-4 w-px bg-[#1f5f91]" />
        </span>
      ) : null}
    </button>
  );
}
