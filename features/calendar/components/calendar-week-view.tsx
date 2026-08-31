"use client";

import { EventPill } from "@/features/calendar/components/calendar-event-pill";
import {
  hasOpenAvailability,
  type CalendarDayMeta
} from "@/features/calendar/components/calendar-day-model";

const columnWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short"
});

/**
 * The same seven days the month grid would draw as one of its rows, given the
 * whole panel instead.
 *
 * There is no hour axis here on purpose: /api/calendar returns the date a
 * booking falls on and nothing finer, so a time grid would be drawing lines the
 * data cannot place events against. What the extra height buys is every booking
 * on a day visible at once, which the month cell truncates in practice.
 */
export function CalendarWeekView({
  clickAnywhereToAdd,
  days,
  onBookDate,
  onSelectDate,
  showAvailability,
  showHebrewDate
}: {
  clickAnywhereToAdd: boolean;
  days: CalendarDayMeta[];
  onBookDate: (date: Date) => void;
  onSelectDate: (date: Date) => void;
  showAvailability: boolean;
  showHebrewDate: boolean;
}) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain px-3 pb-3">
      <div className="grid min-w-212.5 grid-cols-7 overflow-hidden rounded-xl border border-[#d8dde5]">
        {days.map((day) => {
          const bookOnDayClick = clickAnywhereToAdd && day.canBook;

          return (
            <div
              className={`relative flex min-h-96 flex-col border-r border-[#d8dde5] transition last:border-r-0 ${day.isToday ? "z-2 ring-3 ring-inset ring-[#1f4d73]" : day.isSelected ? "z-1 ring-2 ring-inset ring-[#a8ccec]" : ""}`}
              key={day.dateKey}
            >
              <button
                aria-label={
                  bookOnDayClick
                    ? `Book ${day.dateLabel}`
                    : `Select ${day.dateLabel}`
                }
                className="absolute inset-0 z-0 bg-white transition hover:bg-[#f8fbfd]"
                onClick={() =>
                  bookOnDayClick ? onBookDate(day.date) : onSelectDate(day.date)
                }
                title={bookOnDayClick ? `Book ${day.dateLabel}` : undefined}
                type="button"
              />

              <div className="pointer-events-none relative z-1 border-b border-[#d8dde5] bg-[#fbfcfd] px-2 py-2 text-center">
                <span className="block text-[10px] font-black tracking-wider text-[#6a7483]">
                  {columnWeekdayFormatter.format(day.date).toUpperCase()}
                </span>
                <strong className="mt-0.5 block text-sm">{day.day}</strong>
                {showHebrewDate ? (
                  <span
                    className="mt-0.5 block text-[9px] font-semibold"
                    dir="rtl"
                  >
                    {day.hebrewDate}
                  </span>
                ) : null}
              </div>

              {day.canBook && !clickAnywhereToAdd ? (
                <button
                  aria-label={`Book ${day.dateLabel}`}
                  className="absolute right-2 top-2 z-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#b9c2cf] bg-white text-sm font-black leading-none text-[#1f4d73] shadow-sm transition hover:border-[#1f4d73] hover:bg-[#eef4fa] focus:outline-none focus:ring-2 focus:ring-[#a8ccec]"
                  onClick={() => onBookDate(day.date)}
                  title={`Book ${day.dateLabel}`}
                  type="button"
                >
                  +
                </button>
              ) : null}

              <div className="relative z-1 flex-1 space-y-1 p-2">
                {day.bookings.map((booking) => (
                  <EventPill
                    booking={booking}
                    key={booking.id}
                    onSelect={() => onSelectDate(day.date)}
                  />
                ))}
              </div>

              <div className="pointer-events-none relative z-1 px-2 pb-2 text-right text-[9px] font-black">
                {day.isBlocked ? (
                  <span className="text-[#b42318]">Blocked</span>
                ) : day.fullyBooked ? (
                  <span className="text-[#516071]">Fully booked</span>
                ) : showAvailability && hasOpenAvailability(day) ? (
                  <span className="text-[#087047]">{day.openSlots} open</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
