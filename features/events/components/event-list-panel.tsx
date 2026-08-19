"use client";

import { useEffect, useRef } from "react";
import { type EventFile } from "@/features/events/components/event-manager-shared";
import { getEventReadinessSummary } from "@/features/events/components/event-readiness";

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

  const isCompleted = event.bookingStatus === "COMPLETED";
  const isCancelled = ["CANCELLED", "EXPIRED"].includes(event.bookingStatus);
  const isOnHold = !isCompleted && !isCancelled && event.status !== "Confirmed";
  const lifecycleLabel = isCompleted
    ? "Completed"
    : isCancelled
      ? "Cancelled"
      : event.status;
  // A pill on every row means no row stands out, so the settled state is a
  // colour on the edge and only the exceptions get words.
  const statusBar = isCompleted
    ? "bg-[#94a3b8]"
    : isCancelled
      ? "bg-[#dc6803]"
      : isOnHold
        ? "bg-[#f5a524]"
        : "bg-[#12b76a]";
  const readiness = getEventReadinessSummary(event, "event");
  const outstanding = readiness.total - readiness.completed;
  const guestCount = Number(event.guests);
  const hasGuests = Number.isFinite(guestCount) && guestCount > 0;

  // Ranked, then capped: the row has space for the two things most likely to
  // need a decision, not for every flag at once.
  const exceptions = [
    isCompleted || isCancelled ? lifecycleLabel : null,
    isOnHold ? "On hold" : null,
    event.balance !== "Paid" ? "Balance due" : null,
    outstanding > 0 ? `${outstanding} to do` : null
  ]
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 2);

  return (
    <button
      className={`relative flex w-full gap-3 rounded-lg py-2.5 pl-4 pr-3 text-left transition ${
        selected ? "bg-[#eef4fa]" : "hover:bg-[#f6f8fa]"
      }`}
      type="button"
      onClick={onClick}
      onBlur={cancelPrefetch}
      onFocus={schedulePrefetch}
      onPointerEnter={schedulePrefetch}
      onPointerLeave={cancelPrefetch}
    >
      <span
        aria-hidden="true"
        className={`absolute bottom-2.5 left-1 top-2.5 w-1 rounded-full ${statusBar}`}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate text-sm ${
              selected
                ? "font-semibold text-[#17202a]"
                : "font-medium text-[#17202a]"
            }`}
          >
            {event.title}
          </span>
          <span className="shrink-0 text-xs font-normal text-[#6a7483]">
            {event.time}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs font-normal text-[#6a7483]">
          {event.room}
          {hasGuests ? ` · ${event.guests} guests` : ""}
          {event.packageName === "Not assigned" ? "" : ` · ${event.packageName}`}
        </span>
        {exceptions.length ? (
          <span className="mt-1 block truncate text-xs font-medium text-[#b54708]">
            {exceptions.join(" · ")}
          </span>
        ) : null}
        {/* The colour bar carries the settled state for everyone else. */}
        <span className="sr-only">{lifecycleLabel}</span>
      </span>
    </button>
  );
}
