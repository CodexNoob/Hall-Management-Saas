"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { type CalendarView } from "@/features/calendar/components/calendar-shared";

/**
 * The calendar's body while another period's bookings are on their way.
 *
 * Stepping to a month that is not in the cache yet used to blank the whole page
 * - topbar, tabs, filters and all - down to one centred spinner. Only the events
 * belong to the period, so only the part that draws them is replaced here: the
 * frames carry the same borders, column counts and minimum heights as the real
 * views, which is what keeps the panel the size it already was and stops the
 * page from jumping when the rows land.
 */
export function CalendarBodySkeleton({
  view,
  weekDayLabels
}: {
  view: CalendarView;
  /** The real headings - they are known before the events are. */
  weekDayLabels: string[];
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading this period&rsquo;s bookings…</span>
      {view === "agenda" ? (
        <AgendaSkeleton />
      ) : view === "week" ? (
        <WeekSkeleton />
      ) : (
        <MonthGridSkeleton weekDayLabels={weekDayLabels} />
      )}
    </div>
  );
}

function DaySkeleton({ pills }: { pills: number }) {
  return (
    <>
      <Skeleton className="h-3 w-5" />
      <div className="mt-2 space-y-1">
        {Array.from({ length: pills }).map((_, index) => (
          <Skeleton className="h-5 w-full rounded-lg" key={index} />
        ))}
      </div>
    </>
  );
}

/**
 * A pill on every third day rather than on all of them: a skeleton that fills
 * each cell reads as a fully booked month, and one that fills none reads as an
 * empty one. Neither is a claim worth making before the data is here.
 */
function pillsForCell(index: number) {
  return index % 3 === 0 ? 1 : 0;
}

function MonthGridSkeleton({ weekDayLabels }: { weekDayLabels: string[] }) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain px-3 pb-3">
      <div className="min-w-212.5 overflow-hidden rounded-xl border border-[#d8dde5]">
        <div className="grid grid-cols-7 bg-[#fbfcfd]">
          {weekDayLabels.map((day) => (
            <div
              className="border-r border-[#d8dde5] py-3 text-center text-[10px] font-black tracking-wider text-[#6a7483] last:border-r-0"
              key={day}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }).map((_, index) => (
            <div
              className="min-h-32 border-r border-t border-[#d8dde5] bg-white p-2 nth-[7n]:border-r-0"
              key={index}
            >
              <DaySkeleton pills={pillsForCell(index)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WeekSkeleton() {
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain px-3 pb-3">
      <div className="grid min-w-212.5 grid-cols-7 overflow-hidden rounded-xl border border-[#d8dde5]">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            className="flex min-h-96 flex-col border-r border-[#d8dde5] bg-white last:border-r-0"
            key={index}
          >
            <div className="flex flex-col items-center gap-1 border-b border-[#d8dde5] bg-[#fbfcfd] px-2 py-2">
              <Skeleton className="h-2 w-8" />
              <Skeleton className="h-3 w-5" />
            </div>

            <div className="flex-1 space-y-1 p-2">
              {Array.from({ length: pillsForCell(index) }).map(
                (_, pillIndex) => (
                  <Skeleton className="h-5 w-full rounded-lg" key={pillIndex} />
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgendaSkeleton() {
  return (
    <div className="space-y-2 px-3 pb-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <article
          className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white"
          key={index}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#e5eaf0] bg-[#fbfcfd] px-3 py-2">
            <div className="space-y-1">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-2 w-20" />
            </div>
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>

          <div className="space-y-1 p-3">
            <Skeleton className="h-5 w-full rounded-lg" />
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * The day panel beside the grid. Its bookings and its per-hall counts are both
 * read from the period being fetched, so the whole body waits rather than
 * showing the day before's numbers under the new day's heading.
 */
export function CalendarSelectedDaySkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-3 p-3">
      <span className="sr-only">Loading this date&rsquo;s bookings…</span>
      <Skeleton className="h-16 w-full rounded-xl" />

      <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
        <div className="space-y-1 border-b border-[#d8dde5] px-3 py-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2 w-40" />
        </div>

        <div className="divide-y divide-[#e5eaf0]">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              className="flex items-center justify-between gap-3 px-3 py-2"
              key={index}
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * The Availability tab's day list while a newly picked range loads. The hall
 * select and the range picker above it stay live, so the reader can change
 * either one again without waiting for the request they just started.
 */
export function AvailabilityDaysSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="mt-3 space-y-2">
      <span className="sr-only">Loading availability for this range…</span>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-[#d8dde5] px-3 py-2"
          key={index}
        >
          <div className="space-y-1">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2 w-24" />
          </div>
          <Skeleton className="h-6 w-22 rounded-full" />
        </div>
      ))}
    </div>
  );
}
