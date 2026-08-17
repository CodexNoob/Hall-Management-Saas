import { describe, expect, it } from "vitest";
import {
  applyRounding,
  calculateMenuQuantity,
  calculateStyleQuantity,
  readBasisCount,
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
