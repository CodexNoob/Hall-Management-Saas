import { describe, expect, it } from "vitest";

import { DEFAULT_TIME_ZONE } from "@/lib/dates/calendar-date";
import {
  groupedTimeZoneOptions,
  isTimeZone,
  listTimeZones
} from "@/lib/dates/time-zones";

describe("isTimeZone", () => {
  it("accepts real IANA zones", () => {
    for (const zone of [
      "UTC",
      "America/New_York",
      "Asia/Jerusalem",
      "Asia/Manila",
      "Europe/London"
    ]) {
      expect(isTimeZone(zone)).toBe(true);
    }
  });

  it("refuses anything the runtime does not know", () => {
    // Each of these reaches `dateKeyInTimeZone`, which swallows the error and
    // falls back to the server's own zone - so the venue's day moves without
    // anything failing. That is what this guard is for.
    for (const value of [
      "",
      "   ",
      "Eastern Time",
      "UTC+5",
      "America/Nowhere",
      "'; DROP TABLE organizations; --"
    ]) {
      expect(isTimeZone(value)).toBe(false);
    }
  });
});

describe("listTimeZones", () => {
  it("offers far more than the three the picker used to have", () => {
    // The old picker was Eastern, Central and Manila, which is a ceiling
    // rather than a shortlist: no other venue could be configured at all.
    expect(listTimeZones().length).toBeGreaterThan(50);
  });

  it("labels each zone with its own offset", () => {
    const utc = listTimeZones().find((zone) => zone.id === "UTC");

    expect(utc?.label).toBe("(UTC+00:00) UTC");
  });

  it("only offers zones the API will accept", () => {
    const refused = listTimeZones().filter((zone) => !isTimeZone(zone.id));

    expect(refused).toEqual([]);
  });
});

describe("groupedTimeZoneOptions", () => {
  it("groups by region and keeps every zone", () => {
    const groups = groupedTimeZoneOptions(DEFAULT_TIME_ZONE);
    const total = groups.reduce((sum, group) => sum + group.zones.length, 0);

    expect(groups.length).toBeGreaterThan(1);
    expect(total).toBe(listTimeZones().length);
  });

  it("offers a stored zone back even when this runtime has never heard of it", () => {
    // An organization configured before a rename would otherwise open the
    // picker on a blank, and the next save would move the venue to whichever
    // zone happened to be listed first.
    const stored = "Factory/Imaginary";
    const ids = groupedTimeZoneOptions(stored).flatMap((group) =>
      group.zones.map((zone) => zone.id)
    );

    expect(ids).toContain(stored);
  });
});
