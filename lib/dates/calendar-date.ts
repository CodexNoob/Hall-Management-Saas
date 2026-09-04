export type CalendarGridDay = {
  currentMonth: boolean;
  date: Date;
  dateKey: string;
  day: number;
};

/// Which day a displayed week opens on. Saturday is here because a hall running
/// on the Hebrew calendar reads the week as ending on Shabbos, not starting
/// mid-way through it.
export type WeekStartsOn = "sunday" | "monday" | "saturday";

const weekStartDayIndexes: Record<WeekStartsOn, number> = {
  sunday: 0,
  monday: 1,
  saturday: 6
};

export function weekStartDayIndex(weekStartsOn: WeekStartsOn = "sunday") {
  return weekStartDayIndexes[weekStartsOn] ?? 0;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfWeek(date: Date, weekStartsOn: WeekStartsOn = "sunday") {
  const result = startOfDay(date);
  const startIndex = weekStartDayIndex(weekStartsOn);
  result.setDate(result.getDate() - ((result.getDay() - startIndex + 7) % 7));
  return result;
}

export function addDays(date: Date, amount: number) {
  const result = startOfDay(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateKeyFromIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match
    ? `${match[1]}-${match[2]}-${match[3]}`
    : dateKey(new Date(value));
}

/**
 * The timezone an organization is read in when it has never said otherwise.
 *
 * Matches the `OrganizationSetting.timezone` column default, so an organization
 * with no settings row and one that has never touched the field are the same
 * venue rather than two.
 */
export const DEFAULT_TIME_ZONE = "America/New_York";

/**
 * Which calendar day an instant falls on AT THE VENUE, as a `YYYY-MM-DD` key.
 *
 * Event dates are `@db.Date` and every date label in the product is formatted
 * at `timeZone: "UTC"`, so a day key is a civil date with no offset attached.
 * "Which day is it right now" is the one question that cannot be answered that
 * way: `new Date().toISOString().slice(0, 10)` is the UTC day, which for a hall
 * in New York becomes tomorrow at eight in the evening - in the middle of
 * service, on the board the kitchen is working from.
 *
 * An unrecognised IANA zone falls back to UTC rather than throwing: a settings
 * row holding a typo should not take down the kitchen.
 */
export function dateKeyInTimeZone(
  date: Date,
  timeZone: string = DEFAULT_TIME_ZONE
) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const part = (type: "year" | "month" | "day") =>
      parts.find((candidate) => candidate.type === type)?.value;
    const year = part("year");
    const month = part("month");
    const day = part("day");

    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // An invalid zone throws out of the Intl constructor; fall through to UTC.
  }

  return date.toISOString().slice(0, 10);
}

/** Today at the venue. The reason every caller passes a timezone. */
export function todayKeyInTimeZone(
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date()
) {
  return dateKeyInTimeZone(now, timeZone);
}

/**
 * A day key back as a `Date`, in the local frame the rest of this module works
 * in - so `dateKey(startOfDayFromKey(key)) === key`.
 *
 * The calendar and kitchen grids are built by walking `Date`s, while the venue's
 * own day arrives as a key. This is the join between the two, and it is a local
 * midnight rather than a UTC one precisely so the grid helpers above read it
 * back unchanged.
 */
export function startOfDayFromKey(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);

  if (!match) return startOfDay(new Date());

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function buildMonthGrid(
  month: Date,
  weekStartsOn: WeekStartsOn = "sunday"
): CalendarGridDay[] {
  const monthStart = startOfMonth(month);
  const gridStart = startOfWeek(monthStart, weekStartsOn);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      currentMonth:
        date.getMonth() === monthStart.getMonth() &&
        date.getFullYear() === monthStart.getFullYear(),
      date,
      dateKey: dateKey(date),
      day: date.getDate()
    };
  });
}

/**
 * The seven days of the week holding `date`, opening on the day Settings says
 * a week starts on.
 *
 * Plain dates rather than `CalendarGridDay`, because a week view has no
 * equivalent of the month grid's leading and trailing greyed-out days: every
 * day it returns is in view, and every one of them is bookable.
 */
export function weekDates(date: Date, weekStartsOn: WeekStartsOn = "sunday") {
  const weekStart = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function moveDateByMonth(date: Date, amount: number) {
  const targetMonth = addMonths(date, amount);
  const lastDay = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0
  ).getDate();
  return new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(date.getDate(), lastDay)
  );
}
