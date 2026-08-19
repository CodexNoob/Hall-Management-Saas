"use client";

import { useEffect, useRef } from "react";
import {
  Badge,
  LineIcon,
  type EventFile
} from "@/features/events/components/event-manager-shared";

// Long enough that sweeping the pointer down a list of a hundred events asks
// for nothing, short enough that the pause before a click covers most of the
// round trip.
const PREFETCH_HOVER_DELAY_MS = 150;

export function EventListCard({
  event,
  selected,
  onClick,
  onPrefetch
}: {
  event: EventFile;
  selected: boolean;
  onClick: () => void;
  /// Called when the pointer or keyboard settles on this row, to warm whatever
  /// the workspace would need if it were opened. Optional: a list that has
  /// nothing worth warming simply leaves it off.
  onPrefetch?: () => void;
}) {
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPrefetch = () => {
    if (prefetchTimer.current === null) return;

    clearTimeout(prefetchTimer.current);
    prefetchTimer.current = null;
  };

  const schedulePrefetch = () => {
    if (!onPrefetch || prefetchTimer.current !== null) return;

    prefetchTimer.current = setTimeout(() => {
      prefetchTimer.current = null;
      onPrefetch();
    }, PREFETCH_HOVER_DELAY_MS);
  };

  useEffect(() => cancelPrefetch, []);

  const lifecycleLabel =
    event.bookingStatus === "COMPLETED"
      ? "Completed"
      : ["CANCELLED", "EXPIRED"].includes(event.bookingStatus)
        ? "Cancelled"
        : event.status;
  const statusTone =
    event.bookingStatus === "COMPLETED"
      ? "green"
      : ["CANCELLED", "EXPIRED"].includes(event.bookingStatus)
        ? "red"
        : event.status === "Confirmed"
          ? "green"
          : "gold";

  return (
    <button
      className={`w-full rounded-lg border p-2.5 text-left transition ${
        selected
          ? "border-[#1f4d73] bg-[#eef4fa]"
          : "border-[#d8dde5] bg-white hover:border-[#b9c2cf] hover:bg-[#fbfcfd]"
      }`}
      type="button"
      onClick={onClick}
      onBlur={cancelPrefetch}
      onFocus={schedulePrefetch}
      onPointerEnter={schedulePrefetch}
      onPointerLeave={cancelPrefetch}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#b9c2cf] bg-[#fbfcfd] text-[#1f4d73]">
          <LineIcon name="calendar" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-black text-[#17202a]">
              {event.title}
            </h3>
            <Badge tone={statusTone}>{lifecycleLabel}</Badge>
          </div>
          <div className="mt-1 flex items-start justify-between gap-2 text-[11px] leading-5 text-[#6a7483]">
            <p className="min-w-0">
              {event.date} at {event.time} - {event.room}
              <br />
              {event.packageName} - {event.guests} guests - {event.coordinator}
            </p>
            <span className="shrink-0 text-right text-[#17202a]">
              {event.balance}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.notes.map((note) => (
              <span
                key={note}
                className="max-w-full rounded-lg border border-[#c8d7df] bg-[#f7fbfb] px-2 py-1 text-[11px] font-bold leading-4 text-[#146c43]"
              >
                {note}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
