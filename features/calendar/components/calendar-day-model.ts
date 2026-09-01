import { formatHebrewDateWithoutYear } from "@/lib/dates/hebrew-date";
import { dateKey, dateKeyFromIso } from "@/lib/dates/calendar-date";
import { type CalendarBooking } from "@/features/calendar/components/calendar-shared";

/**
 * Everything the month, week, and agenda views need to know about one day.
 *
 * Built once, in one place, because the three views answer the same questions -
 * is this day blocked, is it full, may this user book it - and a day that is
 * bookable in the month grid but not in the week grid would be a bug nobody
 * could see from either file alone.
 */
export type CalendarDayMeta = {
  date: Date;
  dateKey: string;
  day: number;
  /** False only for the month grid's leading and trailing days. */
  inView: boolean;
  dateLabel: string;
  hebrewDate: string;
  /** The day's bookings after the search and filter row has had its say. */
  bookings: CalendarBooking[];
  /** Every booking on the day, filtered or not - what capacity is measured on. */
  totalBookings: number;
  isSelected: boolean;
  isToday: boolean;
  /** Before today. Today itself is not past - an event can still be booked on it. */
  isPast: boolean;
  isBlocked: boolean;
  fullyBooked: boolean;
  /** Bookings the day could still take across every bookable hall. */
  openSlots: number;
  canBook: boolean;
};

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric"
});

export function createCalendarDayReader({
  bookings,
  filteredBookings,
  halls,
  blockedDates,
  dailyEventLimit,
  selectedDate,
  todayKey,
  canCreateEvent
}: {
  bookings: CalendarBooking[];
  filteredBookings: CalendarBooking[];
  halls: Array<{ name: string; dailyEventLimit?: number | null }>;
  blockedDates: Array<{ startDate: string; endDate: string }>;
  dailyEventLimit: number;
  selectedDate: string;
  todayKey: string;
  canCreateEvent: boolean;
}) {
  return function readDay(date: Date, inView = true): CalendarDayMeta {
    const key = dateKey(date);
    const dayBookings = bookings.filter((booking) => booking.dateKey === key);
    const usedByHall = (hallName: string) =>
      dayBookings.filter((booking) => booking.hall === hallName).length;
    const isBlocked = blockedDates.some(
      (range) =>
        key >= dateKeyFromIso(range.startDate) &&
        key <= dateKeyFromIso(range.endDate)
    );
    // No halls saved yet is not the same as no room: the organization has not
    // finished setting up, so the day falls back to the organization-wide limit
    // rather than reporting itself full.
    const openSlots =
      halls.length === 0
        ? Math.max(0, dailyEventLimit - dayBookings.length)
        : halls.reduce(
            (total, hall) =>
              total +
              Math.max(
                0,
                (hall.dailyEventLimit ?? dailyEventLimit) -
                  usedByHall(hall.name)
              ),
            0
          );
    const fullyBooked = inView && halls.length > 0 && openSlots === 0;
    // Both keys are `YYYY-MM-DD`, so this compares as text.
    const isPast = key < todayKey;

    return {
      date,
      dateKey: key,
      day: date.getDate(),
      inView,
      dateLabel: dayLabelFormatter.format(date),
      hebrewDate: formatHebrewDateWithoutYear(date),
      bookings: filteredBookings.filter((booking) => booking.dateKey === key),
      totalBookings: dayBookings.length,
      isSelected: key === selectedDate,
      isToday: key === todayKey,
      isPast,
      isBlocked,
      fullyBooked,
      openSlots,
      // The same four conditions everywhere: a day that cannot take a booking
      // has no + button, and books nothing when the whole cell is the button.
      // A day that has already been and gone is one of them - an event cannot
      // be held on it, so offering to book it only invites a mistake.
      canBook:
        inView && !isPast && !fullyBooked && !isBlocked && canCreateEvent
    };
  };
}

/** Whether the "still bookable" marker belongs on a day, when it is switched on. */
export function hasOpenAvailability(day: CalendarDayMeta) {
  return day.inView && !day.isBlocked && !day.fullyBooked && day.openSlots > 0;
}
