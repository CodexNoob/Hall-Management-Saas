import { DEFAULT_TIME_ZONE } from "@/lib/dates/calendar-date";

/**
 * Every timezone a venue can be set to, read from the runtime rather than
 * listed here.
 *
 * The picker used to offer three zones, which is not a shortlist so much as a
 * ceiling: a hall outside Eastern, Central or Manila could not be configured at
 * all, and the venue's day is what the kitchen board calls "Today" and what the
 * write endpoints accept. A hardcoded list is also a list that goes stale -
 * zones are added, renamed and split, and the IANA database moves under it.
 *
 * `Intl.supportedValuesOf` is the same data the formatter will use to render
 * them, so the list and the behaviour cannot disagree.
 *
 * Deliberately free of `server-only`: the settings panel renders from it and
 * `POST /api/settings` validates against it, and a picker offering a value the
 * API refuses is the bug this replaces.
 */

export type TimeZoneOption = {
  /** The IANA id, which is what gets stored. */
  id: string;
  /** `(UTC-05:00) America/New_York`, for the picker. */
  label: string;
  /** The part before the slash, for grouping. */
  region: string;
  offsetMinutes: number;
};

/**
 * Used only where `Intl.supportedValuesOf` is missing. Short on purpose: it is
 * a floor that keeps the picker usable, not a second copy of the database.
 */
const FALLBACK_ZONE_IDS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Jerusalem",
  "Asia/Manila",
  "Australia/Sydney"
];

/**
 * Whether the runtime recognises this as a timezone.
 *
 * Worth checking on the way in rather than trusting the picker. `timezone` is a
 * free string on the wire, and `dateKeyInTimeZone` swallows an unrecognised one
 * and falls back to the server's own zone - so a bad value does not throw, it
 * quietly moves the venue's idea of what day it is. That is the same failure
 * the kitchen board's rollover had, and it is not one anybody notices until a
 * booking is refused for being in the past.
 */
export function isTimeZone(value: string): boolean {
  if (!value.trim()) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** A zone's current offset in minutes, DST included. */
function offsetMinutesOf(timeZone: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset"
    }).formatToParts(at);
    const name =
      parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
    const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);

    // Plain "GMT" is the zero-offset form, which the pattern above cannot match.
    if (!match) return 0;

    const minutes = Number(match[2]) * 60 + Number(match[3]);

    return match[1] === "-" ? -minutes : minutes;
  } catch {
    return 0;
  }
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");

  return `UTC${sign}${hours}:${minutes}`;
}

function zoneIds(): string[] {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : undefined;
  const ids = supported?.length ? [...supported] : [...FALLBACK_ZONE_IDS];

  // `supportedValuesOf` lists the geographic zones and none of the fixed-offset
  // ones, so UTC itself is absent from all 418 of them - while being a value
  // every formatter accepts. A venue that keeps its books in UTC could
  // otherwise not say so.
  if (!ids.includes("UTC")) ids.unshift("UTC");

  return ids;
}

/**
 * The offsets are read once and cached, because building four hundred
 * formatters is not free and the picker is drawn on every settings render.
 * They move twice a year with DST, which a reload settles - the id is what gets
 * stored, and the offset only ever labels it.
 */
let cachedOptions: TimeZoneOption[] | null = null;

export function listTimeZones(): TimeZoneOption[] {
  if (cachedOptions) return cachedOptions;

  const now = new Date();

  cachedOptions = zoneIds()
    .map((id) => {
      const offsetMinutes = offsetMinutesOf(id, now);
      const slash = id.indexOf("/");

      return {
        id,
        label: `(${formatOffset(offsetMinutes)}) ${id.replaceAll("_", " ")}`,
        // "UTC" and the other slashless ids have no region of their own.
        region: slash === -1 ? "Other" : id.slice(0, slash),
        offsetMinutes
      };
    })
    .sort(
      (left, right) =>
        left.region.localeCompare(right.region) ||
        left.offsetMinutes - right.offsetMinutes ||
        left.id.localeCompare(right.id)
    );

  return cachedOptions;
}

/**
 * The list, guaranteed to contain `selected`.
 *
 * An organization configured before a rename - or on a runtime whose database
 * is older than the one that wrote the value - would otherwise open the picker
 * on a blank, and the next save would silently move the venue to whichever zone
 * happened to be first. The stored value is always offered back, even when this
 * runtime has never heard of it.
 */
export function timeZoneOptionsFor(selected: string): TimeZoneOption[] {
  const options = listTimeZones();

  if (options.some((option) => option.id === selected)) return options;

  const offsetMinutes = offsetMinutesOf(selected, new Date());

  return [
    {
      id: selected,
      label: `(${formatOffset(offsetMinutes)}) ${selected.replaceAll("_", " ")}`,
      region: "Other",
      offsetMinutes
    },
    ...options
  ];
}

/** The options grouped by region, in the order the picker renders them. */
export function groupedTimeZoneOptions(
  selected: string = DEFAULT_TIME_ZONE
): Array<{ region: string; zones: TimeZoneOption[] }> {
  const groups = new Map<string, TimeZoneOption[]>();

  for (const option of timeZoneOptionsFor(selected)) {
    const zones = groups.get(option.region);

    if (zones) zones.push(option);
    else groups.set(option.region, [option]);
  }

  return [...groups.entries()]
    .map(([region, zones]) => ({ region, zones }))
    .sort((left, right) => left.region.localeCompare(right.region));
}
