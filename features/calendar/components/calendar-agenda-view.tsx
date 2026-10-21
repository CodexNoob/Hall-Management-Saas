"use client";

import { EventPill } from "@/features/calendar/components/calendar-event-pill";
import {
  hasOpenAvailability,
  type CalendarDayMeta
} from "@/features/calendar/components/calendar-day-model";
import { useAppLanguage } from "@/components/providers/app-language-provider";

const headingFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric"
});

/**
 * The visible month as a list, densest first: only the days that actually hold
 * something, in date order.
 *
 * A grid spends most of its area on days with nothing on them, which is the
 * wrong trade for a hall that books a handful of dates a month - so an empty
 * day is omitted here rather than drawn empty, and a month with nothing booked
 * says so once instead of forty-two times.
 */
export function CalendarAgendaView({
  days,
  emptyMessage,
  onBookDate,
  onSelectDate,
  showAvailability,
  showHebrewDate
}: {
  days: CalendarDayMeta[];
  emptyMessage: string;
  onBookDate: (date: Date) => void;
  onSelectDate: (date: Date) => void;
  showAvailability: boolean;
  showHebrewDate: boolean;
}) {
  const { t } = useAppLanguage();
  const scheduledDays = days.filter((day) => day.bookings.length > 0);

  if (scheduledDays.length === 0) {
    return (
      <div className="px-3 pb-3">
        <p className="rounded-xl border border-dashed border-[#d8dde5] bg-[#fbfcfd] px-3 py-8 text-center text-xs font-medium text-[#6a7483]">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-3 pb-3">
      {scheduledDays.map((day) => (
        <article
          className={`overflow-hidden rounded-xl border bg-white ${day.isToday ? "border-[#1f4d73]" : day.isSelected ? "border-[#a8ccec]" : "border-[#d8dde5]"}`}
          key={day.dateKey}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5eaf0] bg-[#fbfcfd] px-3 py-2">
            <button
              aria-label={`Select ${day.dateLabel}`}
              className="min-w-0 text-left"
              onClick={() => onSelectDate(day.date)}
              type="button"
            >
              <h3 className="text-sm font-black">
                {headingFormatter.format(day.date)}
                {day.isToday ? (
                  <span className="ml-2 rounded-full bg-[#eef4fa] px-2 py-0.5 text-[9px] font-black text-[#1f4d73]">
                    {t("calendar.today")}
                  </span>
                ) : null}
              </h3>
              <p className="mt-0.5 text-[10px] font-medium text-[#6a7483]">
                {day.bookings.length}{" "}
                {day.bookings.length === 1 ? "booking" : "bookings"}
                {showHebrewDate ? (
                  <span className="ml-2" dir="rtl">
                    {day.hebrewDate}
                  </span>
                ) : null}
              </p>
            </button>

            <div className="flex items-center gap-2">
              {day.isBlocked ? (
                <span className="text-[9px] font-black text-[#b42318]">
                  {t("calendar.blocked")}
                </span>
              ) : day.fullyBooked ? (
                <span className="text-[9px] font-black text-[#516071]">
                  {t("calendar.fullyBooked")}
                </span>
              ) : showAvailability && hasOpenAvailability(day) ? (
                <span className="text-[9px] font-black text-[#087047]">
                  {day.openSlots} open
                </span>
              ) : null}

              {day.canBook ? (
                <button
                  aria-label={`Book ${day.dateLabel}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-[#b9c2cf] bg-white text-sm font-black leading-none text-[#1f4d73] transition hover:border-[#1f4d73] hover:bg-[#eef4fa] focus:outline-none focus:ring-2 focus:ring-[#a8ccec]"
                  onClick={() => onBookDate(day.date)}
                  title={`Book ${day.dateLabel}`}
                  type="button"
                >
                  +
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-1 p-3">
            {day.bookings.map((booking) => (
              <EventPill
                booking={booking}
                key={booking.id}
                onSelect={() => onSelectDate(day.date)}
              />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
