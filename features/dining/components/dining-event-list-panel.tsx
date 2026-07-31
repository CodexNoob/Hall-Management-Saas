"use client";

import { type SetStateAction } from "react";
import { Panel } from "@/features/dining/components/dining-panel";
import {
  eventCounts,
  eventSchedule,
  eventTitle,
  type DiningEvent
} from "@/features/dining/components/dining-shared";

type DiningEventListPanelProps = {
  eventPage: number;
  eventPageCount: number;
  eventPageNumbers: number[];
  paginatedEvents: DiningEvent[];
  selectedEvent: DiningEvent;
  visibleEventsCount: number;
  onSelectEvent: (eventId: string) => void;
  onSetEventPage: (updater: SetStateAction<number>) => void;
};

export function DiningEventListPanel({
  eventPage,
  eventPageCount,
  eventPageNumbers,
  paginatedEvents,
  selectedEvent,
  visibleEventsCount,
  onSelectEvent,
  onSetEventPage
}: DiningEventListPanelProps) {
  return (
    <Panel>
      <header className="border-b border-[#d8dde5] px-3 py-2">
        <h2 className="text-sm font-black">Events</h2>
        <p className="mt-1 text-xs text-[#617086]">
          Select an organization event.
        </p>
      </header>
      <div className="max-h-80 space-y-2 overflow-y-auto p-2 lg:max-h-none">
        {paginatedEvents.map((event) => {
          const counts = eventCounts(event);
          return (
            <button
              className={`w-full rounded-xl border p-3 text-left ${
                selectedEvent.id === event.id
                  ? "border-[#1f5f91] bg-[#eef6fc]"
                  : "border-[#c9d2de] bg-white hover:bg-[#f8fafc]"
              }`}
              key={event.id}
              onClick={() => onSelectEvent(event.id)}
              type="button"
            >
              <strong className="block truncate text-sm">
                {eventTitle(event)}
              </strong>
              <p className="mt-1 text-xs leading-5 text-[#55708d]">
                {event.hall.name} · {eventSchedule(event)} ·{" "}
                {counts.adults + counts.children} guests
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="rounded-full border border-[#b9ddcf] bg-[#effbf6] px-2 py-0.5 text-[10px] font-black text-[#087047]">
                  {event.eventStatus}
                </span>
                {event.diningPlan ? (
                  <span className="rounded-full border border-[#b9c2cf] bg-white px-2 py-0.5 text-[10px] font-black">
                    Plan saved
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
        {visibleEventsCount === 0 ? (
          <p className="rounded-lg border border-dashed border-[#c7d0dc] p-4 text-center text-xs font-bold text-[#617086]">
            No events match the search.
          </p>
        ) : null}
        {visibleEventsCount > 0 ? (
          <nav
            aria-label="Dining event pages"
            className="flex flex-wrap items-center justify-center gap-1 border-t border-[#d8dde5] pt-3"
          >
            <button
              aria-label="Previous event page"
              className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-[#b9c2cf] bg-white px-2 text-xs font-black enabled:hover:bg-[#eef4fa] disabled:opacity-40"
              disabled={eventPage === 1}
              onClick={() =>
                onSetEventPage((current) => Math.max(1, current - 1))
              }
              type="button"
            >
              ‹
            </button>
            {eventPageNumbers.map((page) => (
              <button
                aria-current={eventPage === page ? "page" : undefined}
                className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-black ${
                  eventPage === page
                    ? "border-[#1f4d73] bg-[#1f4d73] text-white"
                    : "border-[#b9c2cf] bg-white hover:bg-[#eef4fa]"
                }`}
                key={page}
                onClick={() => onSetEventPage(page)}
                type="button"
              >
                {page}
              </button>
            ))}
            <button
              aria-label="Next event page"
              className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-[#b9c2cf] bg-white px-2 text-xs font-black enabled:hover:bg-[#eef4fa] disabled:opacity-40"
              disabled={eventPage === eventPageCount}
              onClick={() =>
                onSetEventPage((current) =>
                  Math.min(eventPageCount, current + 1)
                )
              }
              type="button"
            >
              ›
            </button>
          </nav>
        ) : null}
      </div>
    </Panel>
  );
}
