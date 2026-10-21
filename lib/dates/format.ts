import {
  DEFAULT_REGIONAL_SETTINGS,
  regionalSettingsKey,
  type RegionalSettings
} from "@/lib/dates/regional-settings";

/**
 * EVERY USER-FACING DATE AND TIME IN THE APPLICATION.
 *
 * FOUR CATEGORIES, AND THEY ARE NOT INTERCHANGEABLE. This file deliberately
 * offers no single `formatDate`, because the same `Date` object means four
 * different things depending on what it came from, and one ambiguous formatter
 * would apply the wrong timezone semantics silently - showing a wedding booked
 * for the 25th as the 24th, or a dinner served at 6:30 as 2:30.
 *
 *   1. REAL TIMESTAMP - an instant that actually happened. A sign-in, an audit
 *      row, a payment. Converted INTO the organization's timezone, because the
 *      question is "when did this happen here".
 *      -> formatOrganizationDate / Time / DateTime
 *
 *   2. DATE-ONLY - a calendar date with no time. An event date, an invoice due
 *      date, a blocked day. Rendered in UTC, because the value is stored at UTC
 *      midnight and converting it into any zone behind UTC moves it to the day
 *      before. This is the one that produces "my event moved to yesterday" bug
 *      reports.
 *      -> formatDateOnly
 *
 *   3. EVENT WALL-CLOCK - a time somebody typed, stored against a UTC anchor.
 *      `events.startsAt` and the kitchen's serve times. The intent is "6:30 in
 *      the evening at this venue", not an instant, so it is read back in UTC and
 *      never shifted. See `formatServeTime` in the kitchen, which has always
 *      done this.
 *      -> formatEventWallClockTime
 *
 *   4. MACHINE VALUE - not this file's business. `yyyy-MM-dd` for an HTML date
 *      input, `HH:mm` for a time input, ISO 8601 for the API and the database,
 *      and machine-readable timestamps in structured logs. Those have their own
 *      helpers and must not be routed through here; a machine value that starts
 *      following a display preference is a broken form.
 *
 * `hour12` IS ALWAYS EXPLICIT. Left to the locale, "en-GB" gives a 24-hour
 * clock and "en-US" a 12-hour one - so a venue that chose 12-hour and set their
 * language to British English would silently get 24-hour. The organization's
 * choice overrides the locale's, which is the whole point of having the setting.
 */

/** A value that might be a date. Anything unusable formats as the dash. */
export type DateLike = Date | string | number | null | undefined;

/**
 * What an absent or unparseable value renders as.
 *
 * An em dash rather than an empty string, "N/A" or "Invalid Date": a table cell
 * still has to hold its column, and a dash reads as "nothing here" to both a
 * person and a screen reader without claiming the data is broken.
 */
export const EMPTY_DATE_LABEL = "—";

function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Memoised `Intl` instances.
 *
 * Constructing one is measurably expensive and a calendar month asks for
 * several hundred. Keyed on the SETTINGS rather than on object identity,
 * because the settings are re-read from the session on every render and a
 * key based on identity would never hit.
 *
 * A plain Map, bounded by how many distinct settings one browser sees - one,
 * or a handful for somebody who switches between organizations. On the server
 * it is bounded by the number of tenants a process serves, and it holds no
 * tenant DATA, only the formatting choices, so it is safe to share.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(
  settings: RegionalSettings,
  scope: string,
  build: () => Intl.DateTimeFormat
) {
  const key = `${scope}|${regionalSettingsKey(settings)}`;
  const cached = formatterCache.get(key);

  if (cached) return cached;

  const created = build();
  formatterCache.set(key, created);

  return created;
}

/** Test seam. Never needed at runtime - the cache is keyed, not invalidated. */
export function clearDateFormatterCache() {
  formatterCache.clear();
}

/**
 * The numeric parts of a date, in the organization's chosen order.
 *
 * Built from `formatToParts` rather than by formatting and then rearranging the
 * string. Manual splitting on "/" or "-" breaks the moment a locale uses a
 * different separator or writes its numbers in another script, and the bug it
 * produces is a date that looks plausible and is wrong.
 */
function orderedParts(
  settings: RegionalSettings,
  timeZone: string,
  date: Date
) {
  const parts = formatter(settings, `parts:${timeZone}`, () =>
    new Intl.DateTimeFormat(settings.locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone
    })
  ).formatToParts(date);

  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  ) as Record<string, string>;

  return { year: lookup.year, month: lookup.month, day: lookup.day };
}

function formatDateIn(
  settings: RegionalSettings,
  timeZone: string,
  date: Date
): string {
  if (settings.dateFormat === "MMM d, yyyy") {
    // Textual, so the language decides the month name - "Sep" or "sept." or
    // "ספט׳" - while the ORDER is the locale's own. This is the one format
    // where deferring to the locale is correct rather than lazy.
    return formatter(settings, `medium:${timeZone}`, () =>
      new Intl.DateTimeFormat(settings.locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone
      })
    ).format(date);
  }

  const { year, month, day } = orderedParts(settings, timeZone, date);

  return settings.dateFormat === "dd/MM/yyyy"
    ? `${day}/${month}/${year}`
    : `${month}/${day}/${year}`;
}

function formatTimeIn(
  settings: RegionalSettings,
  timeZone: string,
  date: Date
): string {
  return formatter(settings, `time:${timeZone}`, () =>
    new Intl.DateTimeFormat(settings.locale, {
      hour: "numeric",
      minute: "2-digit",
      // Explicit, always. See the header.
      hour12: settings.timeFormat === "12-hour",
      timeZone
    })
  ).format(date);
}

// ---------------------------------------------------------------------------
// 1. REAL TIMESTAMPS - converted into the organization's timezone.
// ---------------------------------------------------------------------------

/**
 * The date part of something that actually happened, where it happened.
 *
 * A payment recorded at 23:30 New York time on the 24th is the 24th to that
 * venue, even though it is the 25th in UTC. That is why this converts and
 * `formatDateOnly` does not.
 */
export function formatOrganizationDate(
  value: DateLike,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  const date = toDate(value);

  return date ? formatDateIn(settings, settings.timeZone, date) : EMPTY_DATE_LABEL;
}

/** The clock time of something that actually happened, in the venue's zone. */
export function formatOrganizationTime(
  value: DateLike,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  const date = toDate(value);

  return date ? formatTimeIn(settings, settings.timeZone, date) : EMPTY_DATE_LABEL;
}

/**
 * Both, joined.
 *
 * The separator is a middle dot rather than a comma: "Sep 25, 2026, 6:30 PM"
 * has two commas doing different jobs and reads as a list.
 */
export function formatOrganizationDateTime(
  value: DateLike,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  const date = toDate(value);

  if (!date) return EMPTY_DATE_LABEL;

  return `${formatDateIn(settings, settings.timeZone, date)} · ${formatTimeIn(settings, settings.timeZone, date)}`;
}

// ---------------------------------------------------------------------------
// 2. DATE-ONLY - the calendar date, never moved.
// ---------------------------------------------------------------------------

/**
 * A calendar date, exactly as stored.
 *
 * ALWAYS UTC, AND THAT IS THE ENTIRE POINT. An event date is stored at UTC
 * midnight; rendering it in any zone behind UTC - which is every American zone -
 * lands on 19:00 the previous day and prints the wrong date. Somebody's wedding
 * shows as the 24th on the list and the 25th on the contract.
 *
 * It is NOT an instant and must never be treated as one. There is no "what time
 * was it really" question to ask about an invoice due date.
 */
export function formatDateOnly(
  value: DateLike,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  const date = toDate(value);

  return date ? formatDateIn(settings, "UTC", date) : EMPTY_DATE_LABEL;
}

/**
 * The weekday name for a calendar date, in the organization's language.
 *
 * UTC for the same reason as above: read in a western zone, a UTC-midnight
 * Saturday is a Friday.
 */
export function formatDateOnlyWeekday(
  value: DateLike,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS,
  weekday: "long" | "short" = "long"
): string {
  const date = toDate(value);

  if (!date) return EMPTY_DATE_LABEL;

  return formatter(settings, `weekday:${weekday}`, () =>
    new Intl.DateTimeFormat(settings.locale, { weekday, timeZone: "UTC" })
  ).format(date);
}

// ---------------------------------------------------------------------------
// 3. EVENT WALL-CLOCK - the time somebody typed, never shifted.
// ---------------------------------------------------------------------------

/**
 * The time an event is meant to start, as it was entered.
 *
 * `events.startsAt` carries a wall-clock time against a UTC anchor: somebody
 * typed 18:30 and 18:30 is what every screen has to say, whichever zone the
 * browser is in and whichever zone the venue is configured for. Reading it as a
 * real instant and converting it is how a 6:30 PM dinner comes to be printed as
 * 2:30 PM on the kitchen's own sheet.
 *
 * The hour cycle still follows the organization's Time Format - that is a
 * presentation choice and applies to every clock in the product. Only the ZONE
 * is fixed.
 *
 * This is the convention `formatServeTime` in features/kitchen has always used;
 * this is the same rule, named, so the rest of the application can follow it.
 */
export function formatEventWallClockTime(
  value: DateLike,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  const date = toDate(value);

  return date ? formatTimeIn(settings, "UTC", date) : EMPTY_DATE_LABEL;
}

/** A date and its wall-clock time, for an event line that shows both. */
export function formatEventWallClockDateTime(
  value: DateLike,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  const date = toDate(value);

  if (!date) return EMPTY_DATE_LABEL;

  return `${formatDateIn(settings, "UTC", date)} · ${formatTimeIn(settings, "UTC", date)}`;
}

// ---------------------------------------------------------------------------
// Month and weekday names, for calendars that draw their own headers.
// ---------------------------------------------------------------------------

/**
 * "September 2026", in the organization's language.
 *
 * A calendar header is always a real month rather than a date-only value, but
 * it is built from one - so UTC, on the same reasoning: a month view anchored
 * to the 1st at UTC midnight would title itself with the previous month for
 * every venue west of Greenwich.
 */
export function formatMonthYear(
  value: DateLike,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  const date = toDate(value);

  if (!date) return EMPTY_DATE_LABEL;

  return formatter(settings, "monthYear", () =>
    new Intl.DateTimeFormat(settings.locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    })
  ).format(date);
}
