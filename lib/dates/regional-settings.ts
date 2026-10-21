/**
 * HOW THIS ORGANIZATION WRITES A DATE AND A TIME.
 *
 * One model, four fields, and it is the only description of regional
 * presentation in the application. Before this existed the answer was spread
 * across sixty-odd call sites: some passed "en-US" literally, some passed
 * nothing and got the BROWSER's locale, some used `dateStyle` and got whatever
 * that locale considered medium. A venue that set dd/MM/yyyy saw it applied on
 * the Kitchen board and nowhere else.
 *
 * DELIBERATELY FREE OF `server-only` AND OF PRISMA. The server resolves these
 * from the authenticated organization and the browser receives them on the
 * session; both sides then format with the same functions, so a date rendered
 * into an emailed invoice and the same date on screen cannot disagree. Keeping
 * this module plain data is what makes that possible.
 *
 * NOT A GLOBAL. There is no module-level "current settings" here and there must
 * never be one: server modules are shared by every request, so a mutable
 * default would let one tenant's format leak into another's document. Settings
 * are always passed in.
 */

/** The three shapes a venue may choose. `MMM` is textual and follows the language. */
export type DateFormat = "MMM d, yyyy" | "MM/dd/yyyy" | "dd/MM/yyyy";

export type TimeFormat = "12-hour" | "24-hour";

export type RegionalSettings = {
  /** A BCP-47 tag. Drives month and weekday names, and nothing else here. */
  locale: string;
  /** An IANA zone. What a real timestamp is converted INTO. */
  timeZone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
};

/**
 * What an organization that has never opened Settings gets, and what a
 * malformed value falls back to.
 *
 * These are the same values `/api/settings` writes into a settings document it
 * creates, so a venue that never touches the page and one that opens it and
 * saves without changing anything see identical dates. Any other choice here
 * would make "I have not configured this" visibly different from "I configured
 * it to the default", which is a difference nobody asked for.
 */
export const DEFAULT_REGIONAL_SETTINGS: RegionalSettings = {
  locale: "en-US",
  timeZone: "America/New_York",
  dateFormat: "MMM d, yyyy",
  timeFormat: "12-hour"
};

const DATE_FORMATS: readonly DateFormat[] = [
  "MMM d, yyyy",
  "MM/dd/yyyy",
  "dd/MM/yyyy"
];

/**
 * Narrow an unknown to a `DateFormat`, or fall back.
 *
 * Unknown rather than typed on purpose: the value arrives out of a Json column
 * that no migration constrains, so "this is a DateFormat" is a claim to be
 * checked rather than a type to be asserted.
 */
export function readDateFormat(value: unknown): DateFormat {
  return DATE_FORMATS.includes(value as DateFormat)
    ? (value as DateFormat)
    : DEFAULT_REGIONAL_SETTINGS.dateFormat;
}

export function readTimeFormat(value: unknown): TimeFormat {
  return value === "24-hour" || value === "12-hour"
    ? value
    : DEFAULT_REGIONAL_SETTINGS.timeFormat;
}

/**
 * Pull the regional block out of an organization's `integrations` document.
 *
 * `PATCH /api/settings` writes date and time format to
 * `integrations.controlCenter.general`, while language and timezone are proper
 * columns. Every field is read defensively: the column is `Json?` with no shape
 * enforced by the database, so a document written by an older build, a partial
 * save, or a hand-edited row has to degrade to the documented defaults rather
 * than throw inside a formatter halfway down a page.
 */
export function readRegionalSettings(input: {
  language?: string | null;
  timezone?: string | null;
  integrations?: unknown;
}): RegionalSettings {
  const general = readControlCenterGeneral(input.integrations);

  return {
    locale: input.language?.trim() || DEFAULT_REGIONAL_SETTINGS.locale,
    timeZone: input.timezone?.trim() || DEFAULT_REGIONAL_SETTINGS.timeZone,
    dateFormat: readDateFormat(general.dateFormat),
    timeFormat: readTimeFormat(general.timeFormat)
  };
}

function readControlCenterGeneral(integrations: unknown): {
  dateFormat?: unknown;
  timeFormat?: unknown;
} {
  if (!integrations || typeof integrations !== "object") return {};

  const controlCenter = (integrations as { controlCenter?: unknown })
    .controlCenter;

  if (!controlCenter || typeof controlCenter !== "object") return {};

  const general = (controlCenter as { general?: unknown }).general;

  if (!general || typeof general !== "object") return {};

  return general as { dateFormat?: unknown; timeFormat?: unknown };
}

/**
 * A stable key for one settings object, for memoising `Intl` instances.
 *
 * Constructing an `Intl.DateTimeFormat` is not free, and a calendar month draws
 * several hundred cells. The key is the four fields rather than the object
 * identity, because the settings arrive freshly parsed out of the session on
 * every render and would otherwise never hit the cache.
 */
export function regionalSettingsKey(settings: RegionalSettings): string {
  return `${settings.locale}|${settings.timeZone}|${settings.dateFormat}|${settings.timeFormat}`;
}
