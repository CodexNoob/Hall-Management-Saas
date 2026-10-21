import { beforeEach, describe, expect, it } from "vitest";

import {
  clearDateFormatterCache,
  EMPTY_DATE_LABEL,
  formatDateOnly,
  formatDateOnlyWeekday,
  formatEventWallClockDateTime,
  formatEventWallClockTime,
  formatMonthYear,
  formatOrganizationDate,
  formatOrganizationDateTime,
  formatOrganizationTime
} from "@/lib/dates/format";
import {
  DEFAULT_REGIONAL_SETTINGS,
  readRegionalSettings,
  type RegionalSettings
} from "@/lib/dates/regional-settings";

/**
 * EVERY USER-FACING DATE AND TIME, AND THE FOUR CATEGORIES IT CAN BE.
 *
 * The categories are the whole design. The same `Date` means four different
 * things depending on what it came from, and picking the wrong formatter moves
 * a wedding to the previous day or prints a 6:30 dinner as 2:30. Each block
 * below pins one category's timezone semantics, because those are the failures
 * nobody notices until a customer does.
 */

const settings = (overrides: Partial<RegionalSettings> = {}): RegionalSettings => ({
  ...DEFAULT_REGIONAL_SETTINGS,
  ...overrides
});

beforeEach(() => {
  clearDateFormatterCache();
});

describe("time format", () => {
  // 18:30 UTC. Read as a wall-clock time it is half past six in the evening.
  const evening = "2026-09-25T18:30:00.000Z";

  it("produces 6:30 PM in 12-hour mode", () => {
    expect(
      formatEventWallClockTime(evening, settings({ timeFormat: "12-hour" }))
    ).toBe("6:30 PM");
  });

  it("produces 18:30 in 24-hour mode", () => {
    expect(
      formatEventWallClockTime(evening, settings({ timeFormat: "24-hour" }))
    ).toBe("18:30");
  });

  /**
   * The setting has to beat the locale, and this is the case that proves it.
   * "en-GB" defaults to a 24-hour clock; a venue that chose 12-hour and set
   * their language to British English would silently get 24-hour if `hour12`
   * were left to the locale.
   */
  it("overrides the locale's own hour cycle", () => {
    expect(
      formatEventWallClockTime(
        evening,
        settings({ locale: "en-GB", timeFormat: "12-hour" })
      )
    ).toMatch(/6:30/);

    expect(
      formatEventWallClockTime(
        evening,
        settings({ locale: "en-US", timeFormat: "24-hour" })
      )
    ).toBe("18:30");
  });
});

describe("date format", () => {
  const date = "2026-09-25T00:00:00.000Z";

  it("writes MMM d, yyyy", () => {
    expect(formatDateOnly(date, settings({ dateFormat: "MMM d, yyyy" }))).toBe(
      "Sep 25, 2026"
    );
  });

  it("writes MM/dd/yyyy", () => {
    expect(formatDateOnly(date, settings({ dateFormat: "MM/dd/yyyy" }))).toBe(
      "09/25/2026"
    );
  });

  it("writes dd/MM/yyyy", () => {
    expect(formatDateOnly(date, settings({ dateFormat: "dd/MM/yyyy" }))).toBe(
      "25/09/2026"
    );
  });

  /**
   * The numeric formats are built from `formatToParts`, not by formatting and
   * then rearranging the string. A venue on a locale whose separator is not "/"
   * would otherwise get a date that looks plausible and is wrong.
   */
  it("keeps the chosen order whatever the locale would have done", () => {
    // en-US would write 9/25/2026 on its own; the setting says day first.
    expect(
      formatDateOnly(date, settings({ locale: "en-US", dateFormat: "dd/MM/yyyy" }))
    ).toBe("25/09/2026");

    // en-GB would write 25/09/2026 on its own; the setting says month first.
    expect(
      formatDateOnly(date, settings({ locale: "en-GB", dateFormat: "MM/dd/yyyy" }))
    ).toBe("09/25/2026");
  });
});

describe("language", () => {
  const date = "2026-09-25T00:00:00.000Z";

  it("names the month in the chosen language", () => {
    expect(formatDateOnly(date, settings({ locale: "es-US" }))).toMatch(/sept/i);
    expect(formatDateOnly(date, settings({ locale: "en-US" }))).toContain("Sep");
  });

  it("names the weekday in the chosen language", () => {
    expect(formatDateOnlyWeekday(date, settings({ locale: "en-US" }))).toBe(
      "Friday"
    );
    expect(formatDateOnlyWeekday(date, settings({ locale: "es-US" }))).toMatch(
      /viernes/i
    );
  });

  it("names the month in a calendar header", () => {
    expect(formatMonthYear(date, settings({ locale: "en-US" }))).toBe(
      "September 2026"
    );
    expect(formatMonthYear(date, settings({ locale: "es-US" }))).toMatch(
      /septiembre/i
    );
  });

  /**
   * The numeric formats stay numeric whatever the language. Only `MMM d, yyyy`
   * is textual, so only it follows the month names.
   */
  it("leaves a numeric format alone", () => {
    expect(
      formatDateOnly(date, settings({ locale: "he-IL", dateFormat: "dd/MM/yyyy" }))
    ).toBe("25/09/2026");
  });
});

/**
 * CATEGORY 2: A CALENDAR DATE, NEVER MOVED.
 *
 * This is the failure that generates bug reports. An event date is stored at
 * UTC midnight; read in any zone behind UTC - every American zone - it lands on
 * 19:00 the previous day and prints the wrong date. Somebody's wedding shows as
 * the 24th on the list and the 25th on the contract.
 */
describe("date-only values never shift a day", () => {
  const eventDate = "2026-09-25T00:00:00.000Z";

  it("holds the date in a western timezone", () => {
    for (const timeZone of [
      "America/Los_Angeles",
      "America/New_York",
      "America/Chicago",
      "Pacific/Honolulu"
    ]) {
      expect(formatDateOnly(eventDate, settings({ timeZone })), timeZone).toBe(
        "Sep 25, 2026"
      );
    }
  });

  it("holds the date in an eastern timezone", () => {
    for (const timeZone of ["Asia/Manila", "Asia/Jerusalem", "Pacific/Auckland"]) {
      expect(formatDateOnly(eventDate, settings({ timeZone })), timeZone).toBe(
        "Sep 25, 2026"
      );
    }
  });

  it("holds the weekday too", () => {
    expect(
      formatDateOnlyWeekday(
        eventDate,
        settings({ timeZone: "America/Los_Angeles" })
      )
    ).toBe("Friday");
  });
});

/**
 * CATEGORY 3: THE TIME SOMEBODY TYPED, NEVER SHIFTED.
 *
 * `events.startsAt` carries a wall-clock time against a UTC anchor. Reading it
 * as a real instant and converting it is how a 6:30 PM dinner comes to be
 * printed as 2:30 PM on the kitchen's own sheet.
 */
describe("event wall-clock times never shift", () => {
  const startsAt = "2026-09-25T18:30:00.000Z";

  it("reads the same clock time in every organization timezone", () => {
    for (const timeZone of [
      "America/Los_Angeles",
      "America/New_York",
      "Asia/Manila",
      "Australia/Sydney",
      "UTC"
    ]) {
      expect(
        formatEventWallClockTime(startsAt, settings({ timeZone })),
        timeZone
      ).toBe("6:30 PM");
    }
  });

  it("keeps the date with it", () => {
    expect(
      formatEventWallClockDateTime(
        startsAt,
        settings({ timeZone: "America/Los_Angeles" })
      )
    ).toBe("Sep 25, 2026 · 6:30 PM");
  });
});

/**
 * CATEGORY 1: SOMETHING THAT ACTUALLY HAPPENED, WHERE IT HAPPENED.
 *
 * The opposite rule, and the reason the two cannot share a formatter. A payment
 * recorded at 23:30 New York time on the 24th is the 24th to that venue even
 * though it is the 25th in UTC.
 */
describe("real timestamps convert into the organization timezone", () => {
  // 03:30 UTC on the 25th is 23:30 on the 24th in New York.
  const recordedAt = "2026-09-25T03:30:00.000Z";

  it("shows the venue's own date", () => {
    expect(
      formatOrganizationDate(recordedAt, settings({ timeZone: "America/New_York" }))
    ).toBe("Sep 24, 2026");

    expect(
      formatOrganizationDate(recordedAt, settings({ timeZone: "Asia/Manila" }))
    ).toBe("Sep 25, 2026");
  });

  it("shows the venue's own clock", () => {
    expect(
      formatOrganizationTime(recordedAt, settings({ timeZone: "America/New_York" }))
    ).toBe("11:30 PM");
  });

  it("joins them without two commas fighting", () => {
    expect(
      formatOrganizationDateTime(
        recordedAt,
        settings({ timeZone: "America/New_York" })
      )
    ).toBe("Sep 24, 2026 · 11:30 PM");
  });

  /**
   * The same instant, two organizations, two different renderings - which is
   * the multi-tenant requirement stated as a test. Nothing is shared between
   * these two calls but the function.
   */
  it("renders the same instant differently for two organizations", () => {
    const manila = formatOrganizationDateTime(
      recordedAt,
      settings({
        timeZone: "Asia/Manila",
        dateFormat: "dd/MM/yyyy",
        timeFormat: "24-hour"
      })
    );
    const newYork = formatOrganizationDateTime(
      recordedAt,
      settings({ timeZone: "America/New_York" })
    );

    expect(manila).toBe("25/09/2026 · 11:30");
    expect(newYork).toBe("Sep 24, 2026 · 11:30 PM");
  });
});

describe("missing and invalid values", () => {
  it("renders the same placeholder for every unusable value", () => {
    for (const value of [null, undefined, "", "not a date", Number.NaN]) {
      expect(formatOrganizationDate(value), String(value)).toBe(
        EMPTY_DATE_LABEL
      );
      expect(formatDateOnly(value), String(value)).toBe(EMPTY_DATE_LABEL);
      expect(formatEventWallClockTime(value), String(value)).toBe(
        EMPTY_DATE_LABEL
      );
    }
  });

  it("formats with the documented defaults when no settings are passed", () => {
    // A formatter that WORKS without settings will be called without them, so
    // what it does then has to be the documented default rather than whatever
    // the host machine's locale happens to be.
    expect(formatDateOnly("2026-09-25T00:00:00.000Z")).toBe("Sep 25, 2026");
    expect(formatEventWallClockTime("2026-09-25T18:30:00.000Z")).toBe("6:30 PM");
  });
});

describe("reading settings off a stored document", () => {
  it("takes date and time format out of the integrations blob", () => {
    expect(
      readRegionalSettings({
        language: "es-US",
        timezone: "Asia/Manila",
        integrations: {
          controlCenter: {
            general: { dateFormat: "dd/MM/yyyy", timeFormat: "24-hour" }
          }
        }
      })
    ).toEqual({
      locale: "es-US",
      timeZone: "Asia/Manila",
      dateFormat: "dd/MM/yyyy",
      timeFormat: "24-hour"
    });
  });

  /**
   * The column is `Json?` with no shape enforced by the database, so every one
   * of these is a document that could actually exist - written by an older
   * build, a partial save, or a hand-edited row. None of them may reach a
   * formatter.
   */
  it("falls back to the documented defaults for anything unrecognised", () => {
    for (const integrations of [
      null,
      undefined,
      "not an object",
      {},
      { controlCenter: null },
      { controlCenter: { general: null } },
      { controlCenter: { general: { dateFormat: "yyyy/MM/dd" } } },
      { controlCenter: { general: { timeFormat: "36-hour" } } }
    ]) {
      const resolved = readRegionalSettings({ integrations });

      expect(resolved.dateFormat, JSON.stringify(integrations)).toBe(
        "MMM d, yyyy"
      );
      expect(resolved.timeFormat, JSON.stringify(integrations)).toBe("12-hour");
    }
  });

  it("falls back for a blank language or timezone", () => {
    expect(readRegionalSettings({ language: "  ", timezone: "" })).toEqual(
      DEFAULT_REGIONAL_SETTINGS
    );
  });
});

describe("the formatter cache", () => {
  it("returns equal output for repeated calls", () => {
    // Memoisation must not be observable. A calendar month asks for several
    // hundred of these, and a cache keyed wrongly would hand one organization's
    // formatter to another.
    const a = settings({ timeZone: "Asia/Manila", dateFormat: "dd/MM/yyyy" });
    const b = settings({ timeZone: "America/New_York" });
    const value = "2026-09-25T03:30:00.000Z";

    const first = formatOrganizationDate(value, a);
    const other = formatOrganizationDate(value, b);
    const again = formatOrganizationDate(value, a);

    expect(first).toBe(again);
    expect(first).not.toBe(other);
  });
});
