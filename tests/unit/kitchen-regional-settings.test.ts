import { describe, expect, it } from "vitest";

import {
  formatClock,
  formatKitchenDate,
  formatServeTime,
  kitchenViewInformation,
  type KitchenRegionalSettings
} from "@/features/kitchen/components/kitchen-shared";

const newYork24Hour: KitchenRegionalSettings = {
  language: "en-US",
  timeZone: "America/New_York",
  dateFormat: "MM/dd/yyyy",
  timeFormat: "24-hour"
};

describe("Kitchen regional settings", () => {
  it("shows a real instant in the venue timezone", () => {
    expect(
      formatClock(new Date("2026-07-15T16:30:00.000Z"), newYork24Hour)
    ).toBe("12:30");
  });

  it("keeps an event service time as a wall-clock value", () => {
    expect(
      formatServeTime("2026-07-15T18:00:00.000Z", newYork24Hour)
    ).toBe("18:00");
  });

  it("uses the selected date pattern on kitchen dates", () => {
    expect(formatKitchenDate(new Date(2026, 6, 15), newYork24Hour)).toBe(
      "07/15/2026"
    );

    expect(
      kitchenViewInformation(
        "today",
        new Date(2026, 6, 15),
        new Date(2026, 6, 15),
        { ...newYork24Hour, dateFormat: "dd/MM/yyyy" }
      ).heading
    ).toBe("Wednesday, 15/07/2026");
  });
});
