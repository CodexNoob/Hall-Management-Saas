import { describe, expect, it } from "vitest";
import {
  applyRounding,
  calculateMenuQuantity,
  calculateStyleQuantity,
  readBasisCount,
  readLineMultiplier,
  scaleMenuQuantities,
  totalGuests,
  type EventHeadCounts
} from "@/features/menu/lib/menu-quantity";
import type { MenuItemServiceRule } from "@/features/menu/lib/service-style";

/** 187 guests, the worked example from the schema review. */
const counts: EventHeadCounts = {
  couples: 50,
  men: 40,
  ladies: 30,
  boys: 9,
  girls: 8,
  kids: 0,
  waiters: 6,
  tables: 20
};

const trayRule: MenuItemServiceRule = {
  serviceStyle: "Buffet",
  quantity: 1,
  unit: "tray",
  per: 30,
  perBasis: "TotalGuests",
  rounding: "Up",
  minimumUnits: null
};

describe("totalGuests", () => {
  it("counts a couple as two people", () => {
    expect(totalGuests(counts)).toBe(187);
  });

  it("leaves waiters out - staff eat, but they are not guests", () => {
    // Kept deliberately in step with countAttendees() in the booking service,
    // which cannot be imported here because it is server-only.
    expect(totalGuests({ ...counts, waiters: 100 })).toBe(187);
  });
});

describe("readBasisCount", () => {
  it("reads each head count the event actually carries", () => {
    expect(readBasisCount("Couples", counts)).toBe(50);
    expect(readBasisCount("Men", counts)).toBe(40);
    expect(readBasisCount("Ladies", counts)).toBe(30);
    expect(readBasisCount("Waiters", counts)).toBe(6);
    expect(readBasisCount("TotalGuests", counts)).toBe(187);
  });

  it("answers one for a whole-event rule, whatever the size", () => {
    expect(readBasisCount("Event", counts)).toBe(1);
  });

  it("answers null, not zero, when the event cannot know", () => {
    // No dining plan means no table count. Zero would quietly mean "cook none".
    expect(readBasisCount("Tables", { ...counts, tables: null })).toBeNull();
  });
});

describe("applyRounding", () => {
  it("rounds trays up - a part tray is still a tray to send", () => {
    expect(applyRounding(6.233, "Up")).toBe(7);
  });

  it("leaves an exact rule alone, so plates match heads", () => {
    expect(applyRounding(187, "Exact")).toBe(187);
    expect(applyRounding(6.5, "Exact")).toBe(6.5);
  });

  it("does not invent a unit out of float error", () => {
    // 1 * 180 / 30 lands on 6.000000000000001 in floating point; ceil of that
    // is 7, which would add a tray to every event whose arithmetic came out
    // even.
    expect(applyRounding((1 * 180) / 30, "Up")).toBe(6);
  });

  it("rounds down and to nearest when asked", () => {
    expect(applyRounding(6.9, "Down")).toBe(6);
    expect(applyRounding(6.4, "Nearest")).toBe(6);
    expect(applyRounding(6.6, "Nearest")).toBe(7);
  });
});

describe("calculateMenuQuantity", () => {
  it("works out the number the kitchen sheet prints", () => {
    // 187 guests at 1 tray per 30 is 6.233 trays, which is 7 to cook.
    const { quantities } = calculateMenuQuantity([trayRule], counts);

    expect(quantities).toEqual([{ unit: "tray", raw: 6.233333, units: 7 }]);
  });

  it("never prints a fraction of a tray", () => {
    const { quantities } = calculateMenuQuantity([trayRule], counts);

    expect(Number.isInteger(quantities[0].units)).toBe(true);
  });

  it("gives one plate per guest, unrounded", () => {
    const { quantities } = calculateMenuQuantity(
      [
        {
          ...trayRule,
          serviceStyle: "Plated",
          unit: "plate",
          per: 1,
          rounding: "Exact"
        }
      ],
      counts
    );

    expect(quantities).toEqual([{ unit: "plate", raw: 187, units: 187 }]);
  });

  it("honours a minimum the arithmetic falls short of", () => {
    const { quantities } = calculateMenuQuantity(
      [{ ...trayRule, per: 500, minimumUnits: 2 }],
      counts
    );

    expect(quantities[0].units).toBe(2);
  });

  it("sums a list of rules once, rather than rounding each of them", () => {
    // This is the case the list signature exists for: one rate for adults and
    // another for children on the same dish. Rounding each rule first would
    // give 1 + 1 = 2 trays; summing 0.4 + 0.283 and rounding once gives 1.
    const { quantities } = calculateMenuQuantity(
      [
        { ...trayRule, per: 250, perBasis: "Men" },
        { ...trayRule, per: 60, perBasis: "Boys" }
      ],
      counts
    );

    expect(quantities).toHaveLength(1);
    expect(quantities[0].units).toBe(1);
  });

  it("keeps different units on their own lines instead of adding them", () => {
    const { quantities } = calculateMenuQuantity(
      [trayRule, { ...trayRule, unit: "bottle", per: 8 }],
      counts
    );

    expect(quantities.map((quantity) => quantity.unit)).toEqual([
      "tray",
      "bottle"
    ]);
  });

  it("reports a basis it cannot resolve rather than cooking nothing", () => {
    const { quantities, unresolved } = calculateMenuQuantity(
      [{ ...trayRule, unit: "set", per: 1, perBasis: "Tables" }],
      { ...counts, tables: null }
    );

    expect(quantities).toEqual([]);
    expect(unresolved).toEqual(["Tables"]);
  });
});

describe("calculateStyleQuantity", () => {
  it("answers for the style the sheet is being printed for", () => {
    const plated: MenuItemServiceRule = {
      ...trayRule,
      serviceStyle: "Plated",
      unit: "plate",
      per: 1,
      rounding: "Exact"
    };

    expect(
      calculateStyleQuantity([trayRule, plated], "Buffet", counts)?.quantities
    ).toEqual([{ unit: "tray", raw: 6.233333, units: 7 }]);
    expect(
      calculateStyleQuantity([trayRule, plated], "Plated", counts)?.quantities
    ).toEqual([{ unit: "plate", raw: 187, units: 187 }]);
  });

  it("tells a dish that is not served this way apart from one that came out at zero", () => {
    expect(calculateStyleQuantity([trayRule], "Plated", counts)).toBeNull();
  });
});

describe("readLineMultiplier", () => {
  it("reads a multiplier a staff member set", () => {
    expect(readLineMultiplier(2)).toBe(2);
    expect(readLineMultiplier(99)).toBe(99);
  });

  it("answers one for anything it cannot use", () => {
    // A line written by a branch that predates the column, or by one that
    // predates its CHECK. Throwing here would take a whole menu down over one
    // row, and one serving is what that row has always meant.
    expect(readLineMultiplier(null)).toBe(1);
    expect(readLineMultiplier(undefined)).toBe(1);
    expect(readLineMultiplier(0)).toBe(1);
    expect(readLineMultiplier(-3)).toBe(1);
    expect(readLineMultiplier(Number.NaN)).toBe(1);
  });

  it("floors a fraction and clamps past the cap", () => {
    expect(readLineMultiplier(2.7)).toBe(2);
    expect(readLineMultiplier(500)).toBe(99);
  });
});

describe("scaleMenuQuantities", () => {
  const oneServing = calculateMenuQuantity([trayRule], counts).quantities;

  it("doubles what the kitchen cooks, and says what one serving was", () => {
    // 187 guests at 1 tray per 30 is 7 trays to cook; two of the dish is two
    // batches of 7.
    expect(scaleMenuQuantities(oneServing, 2)).toEqual([
      { unit: "tray", raw: 6.233333, perServingUnits: 7, units: 14 }
    ]);
  });

  it("leaves raw per-serving, because rounding is per serving", () => {
    // 6.23 is the working behind the 7, not behind the 14. Doubling it here
    // would print "12.47 before rounding" under a total of 14 - a note that
    // contradicts the number it is meant to explain.
    expect(scaleMenuQuantities(oneServing, 2)[0].raw).toBe(6.233333);
  });

  it("multiplies AFTER the minimum, so a second helping is not swallowed", () => {
    // This is the case the whole design turns on. One tray per hundred with a
    // floor of two, at 40 guests: raw is 0.4, which the minimum lifts to 2.
    // Ordering two has to be 4 trays. Scaling raw first would give
    // max(ceil(0.8), 2) = 2 - the same as ordering one, with nothing on the
    // sheet to say the second one went missing.
    const minimumRule: MenuItemServiceRule = {
      ...trayRule,
      per: 100,
      minimumUnits: 2
    };
    const small: EventHeadCounts = { ...counts, couples: 0, men: 40, ladies: 0, boys: 0, girls: 0 };
    const single = calculateMenuQuantity([minimumRule], small).quantities;

    expect(single[0].units).toBe(2);

    const doubled = scaleMenuQuantities(single, 2);

    expect(doubled[0].units).toBe(4);
    expect(doubled[0].units).not.toBe(2);
  });

  it("is the identity at one, so an unmultiplied line reads as it always did", () => {
    expect(scaleMenuQuantities(oneServing, 1)).toEqual([
      { unit: "tray", raw: 6.233333, perServingUnits: 7, units: 7 }
    ]);
  });

  it("scales every unit group, not just the first", () => {
    const bottleRule: MenuItemServiceRule = {
      ...trayRule,
      unit: "bottle",
      per: 60
    };
    const groups = calculateMenuQuantity([trayRule, bottleRule], counts)
      .quantities;

    expect(scaleMenuQuantities(groups, 3).map((q) => q.units)).toEqual([21, 12]);
  });

  it("refuses an unusable multiplier the same way the reader does", () => {
    expect(scaleMenuQuantities(oneServing, 0)[0].units).toBe(7);
  });
});
