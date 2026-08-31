import { describe, expect, it } from "vitest";
import {
  serviceFormDefaults,
  serviceStyleLabel,
  formatServiceRule,
  readServiceRules,
  readServiceStyleFormValues,
  serviceStyleSchema,
  servesStyle,
  toServiceRules,
  type MenuItemServiceRule,
  type ServiceStyleFormValues
} from "@/features/menu/lib/service-style";

const FOOD_DEFAULTS = serviceFormDefaults("Food");

const buffetRule: MenuItemServiceRule = {
  serviceStyle: "Buffet",
  quantity: 1,
  unit: "tray",
  per: 30,
  perBasis: "TotalGuests",
  rounding: "Up",
  minimumUnits: null
};

const platedRule: MenuItemServiceRule = {
  serviceStyle: "Plated",
  quantity: 1,
  unit: "plate",
  per: 1,
  perBasis: "TotalGuests",
  rounding: "Exact",
  minimumUnits: null
};

const formValues: ServiceStyleFormValues = {
  Buffet: {
    enabled: true,
    quantity: "1",
    unit: "tray",
    per: "30",
    perBasis: "TotalGuests",
    rounding: "Up",
    minimumUnits: ""
  },
  Plated: FOOD_DEFAULTS.Plated
};

describe("servesStyle", () => {
  it("puts a dish under the tab it has a rule for", () => {
    expect(servesStyle([buffetRule], "Buffet")).toBe(true);
    expect(servesStyle([platedRule], "Plated")).toBe(true);
    expect(servesStyle([buffetRule], "Plated")).toBe(false);
    expect(servesStyle([platedRule], "Buffet")).toBe(false);
  });

  it("puts a dish served either way under both tabs, without duplicating it", () => {
    // The case a single column could not hold: one dish, two different rules.
    expect(servesStyle([buffetRule, platedRule], "Buffet")).toBe(true);
    expect(servesStyle([buffetRule, platedRule], "Plated")).toBe(true);
  });

  it("keeps a catalogued-but-unserved dish off both service tabs", () => {
    // What "Library" used to mean, now expressed as having no rules at all.
    expect(servesStyle([], "Buffet")).toBe(false);
    expect(servesStyle([], "Plated")).toBe(false);
  });
});

describe("serviceStyleSchema", () => {
  it("no longer accepts the sentinels that were never really styles", () => {
    // "Library" is zero rules and "Both" is two. Neither is a stored value now,
    // which is what stopped this column answering two questions at once.
    expect(serviceStyleSchema.safeParse("Library").success).toBe(false);
    expect(serviceStyleSchema.safeParse("Both").success).toBe(false);
  });

  it("rejects a style no tab would ever read", () => {
    expect(serviceStyleSchema.safeParse("buffet").success).toBe(false);
    expect(serviceStyleSchema.safeParse("Family style").success).toBe(false);
    expect(serviceStyleSchema.safeParse("").success).toBe(false);
  });
});

describe("readServiceRules", () => {
  it("reads back stored rules", () => {
    expect(readServiceRules([buffetRule])).toEqual([buffetRule]);
  });

  it("degrades to no rules rather than throwing inside a render", () => {
    expect(readServiceRules(null)).toEqual([]);
    expect(readServiceRules(undefined)).toEqual([]);
    expect(readServiceRules("1 tray per 30 people")).toEqual([]);
    expect(readServiceRules([{ serviceStyle: "Buffet" }])).toEqual([]);
    // A value a newer build might write that this one does not know.
    expect(readServiceRules([{ ...buffetRule, perBasis: "Moons" }])).toEqual([]);
  });
});

describe("formatServiceRule", () => {
  it("renders the rule the way a card shows it", () => {
    expect(formatServiceRule(buffetRule)).toBe("1 tray per 30 guests");
  });

  it("names the basis, which is what the old json could not say", () => {
    expect(
      formatServiceRule({ ...buffetRule, per: 1, perBasis: "Couples" })
    ).toBe("1 tray per 1 couples");
  });

  it("drops the divisor for a whole-event rule", () => {
    expect(
      formatServiceRule({ ...buffetRule, unit: "set", perBasis: "Event" })
    ).toBe("1 set per event");
  });

  it("shows a minimum when one is set", () => {
    expect(formatServiceRule({ ...buffetRule, minimumUnits: 2 })).toBe(
      "1 tray per 30 guests, min 2"
    );
  });

  it("says so when there is no rule, instead of rendering a blank line", () => {
    expect(formatServiceRule(null)).toBe("No counting rule set");
  });
});

describe("toServiceRules", () => {
  it("turns the dialog's text into rules", () => {
    expect(toServiceRules(formValues)).toEqual([buffetRule]);
  });

  it("stores no rules for an item that is catalogued but not served", () => {
    expect(
      toServiceRules({
        Buffet: { ...formValues.Buffet, enabled: false },
        Plated: FOOD_DEFAULTS.Plated
      })
    ).toEqual([]);
  });

  it("stores one rule per style for a dish served both ways", () => {
    const rules = toServiceRules({
      Buffet: formValues.Buffet,
      Plated: { ...FOOD_DEFAULTS.Plated, enabled: true }
    });

    expect(rules).toHaveLength(2);
    expect(rules).toContainEqual(buffetRule);
    expect(rules).toContainEqual(platedRule);
  });

  it("ignores the divisor for a whole-event rule rather than demanding one", () => {
    const [rule] = toServiceRules({
      ...formValues,
      Buffet: { ...formValues.Buffet, perBasis: "Event", per: "" }
    });

    expect(rule.per).toBe(1);
    expect(rule.perBasis).toBe("Event");
  });

  it("reads a blank minimum as no minimum, not as zero", () => {
    expect(toServiceRules(formValues)[0].minimumUnits).toBeNull();
    expect(
      toServiceRules({
        ...formValues,
        Buffet: { ...formValues.Buffet, minimumUnits: "2" }
      })[0].minimumUnits
    ).toBe(2);
  });

  it("keeps a unit the preset list never had", () => {
    // The point of the field being typed rather than picked: a kitchen that
    // counts in hotel pans no longer has to file them under "tray".
    const [rule] = toServiceRules({
      ...formValues,
      Buffet: { ...formValues.Buffet, unit: "hotel pan" }
    });

    expect(rule.unit).toBe("hotel pan");
  });

  it("trims the unit so spacing does not split a kitchen line in two", () => {
    // `calculateMenuQuantity` groups on this string, so " tray" and "tray"
    // would otherwise print as two lines of the same thing.
    const [rule] = toServiceRules({
      ...formValues,
      Buffet: { ...formValues.Buffet, unit: "  tray  " }
    });

    expect(rule.unit).toBe("tray");
  });

  it("throws rather than telling the kitchen to cook nothing", () => {
    // `Number("")` is 0 and `Number("abc")` is NaN, which JSON.stringify sends
    // as null - both used to reach the database as a silent zero.
    const buffet = (patch: Record<string, string>) => ({
      ...formValues,
      Buffet: { ...formValues.Buffet, ...patch }
    });

    // A wholly blank rule is "not answered yet" rather than wrong, and the menu
    // library asks to keep the dish without it. Half-filled still throws below:
    // a typo is caught rather than dropped along with the style.
    expect(
      toServiceRules(buffet({ quantity: "", unit: "", per: "" }), {
        allowBlankRule: true
      })
    ).toEqual([]);
    expect(() =>
      toServiceRules(buffet({ quantity: "" }), { allowBlankRule: true })
    ).toThrow();

    expect(() => toServiceRules(buffet({ quantity: "" }))).toThrow();
    expect(() => toServiceRules(buffet({ quantity: "abc" }))).toThrow();
    expect(() => toServiceRules(buffet({ quantity: "0" }))).toThrow();
    expect(() => toServiceRules(buffet({ per: "0" }))).toThrow();
    expect(() => toServiceRules(buffet({ per: "1.5" }))).toThrow();
    expect(() => toServiceRules(buffet({ unit: "" }))).toThrow();
    expect(() => toServiceRules(buffet({ unit: "   " }))).toThrow();
  });
});

describe("serviceStyleLabel", () => {
  it("calls the plated style Table for a drink", () => {
    expect(serviceStyleLabel("Plated", "Drink")).toBe("Table");
    expect(serviceStyleLabel("Plated", "Food")).toBe("Plated");
  });

  it("leaves buffet alone, because a drinks station is still a buffet", () => {
    expect(serviceStyleLabel("Buffet", "Drink")).toBe("Buffet");
  });

  it("falls back to the food words for a kind it does not know", () => {
    // `kind` is form text, so it can be anything - an unknown one must render
    // a word rather than `undefined`.
    expect(serviceStyleLabel("Plated", "Rental")).toBe("Plated");
    expect(serviceStyleLabel("Plated", "")).toBe("Plated");
  });
});

describe("serviceFormDefaults", () => {
  it("opens a drink on bottles at the table, not one plate per guest", () => {
    const drink = serviceFormDefaults("Drink");

    expect(drink.Plated.unit).toBe("bottle");
    expect(drink.Plated.perBasis).toBe("Tables");
    expect(drink.Buffet.unit).toBe("bottle");
  });

  it("keeps the stored style, so only the vocabulary is per kind", () => {
    // The whole point of labelling rather than storing: a drink's table rule is
    // still a `Plated` row, which is what keeps the CHECK constraint, the
    // library tabs and the kitchen sheet out of this change.
    const rules = toServiceRules({
      ...serviceFormDefaults("Drink"),
      Plated: { ...serviceFormDefaults("Drink").Plated, enabled: true }
    });

    expect(rules).toHaveLength(1);
    expect(rules[0].serviceStyle).toBe("Plated");
    expect(rules[0].perBasis).toBe("Tables");
  });

  it("falls back to food for a kind it does not know", () => {
    // Same reason the label does: `kind` is form text, and a lookup miss must
    // not hand the dialog an undefined block to render.
    expect(serviceFormDefaults("Nonsense")).toEqual(serviceFormDefaults("Food"));
    expect(serviceFormDefaults("")).toEqual(serviceFormDefaults("Food"));
  });
});

describe("readServiceStyleFormValues", () => {
  it("seeds an edit from the stored rows", () => {
    const seeded = readServiceStyleFormValues([buffetRule], "Food");

    expect(seeded.Buffet).toEqual({
      enabled: true,
      quantity: "1",
      unit: "tray",
      per: "30",
      perBasis: "TotalGuests",
      rounding: "Up",
      minimumUnits: ""
    });
    // The style the dish is not served in stays off, holding its defaults.
    expect(seeded.Plated.enabled).toBe(false);
  });

  it("seeds each style independently, so two rules survive an edit", () => {
    // Round-tripping through the dialog must not flatten a dish that is served
    // one way on a buffet and another way plated.
    const seeded = readServiceStyleFormValues([buffetRule, platedRule], "Food");

    expect(seeded.Buffet.unit).toBe("tray");
    expect(seeded.Buffet.per).toBe("30");
    expect(seeded.Plated.unit).toBe("plate");
    expect(seeded.Plated.per).toBe("1");
    expect(toServiceRules(seeded)).toHaveLength(2);
  });

  it("seeds an unserved style from the item's own kind", () => {
    // A drink served only on the buffet still has a Table block waiting behind
    // its checkbox; it should be the drink default, not the food one.
    const seeded = readServiceStyleFormValues([buffetRule], "Drink");

    expect(seeded.Plated.unit).toBe("bottle");
    expect(seeded.Plated.perBasis).toBe("Tables");
  });

  it("reads a stored rule back as saved, whatever the kind is now", () => {
    // Only the fallback is per kind. Re-labelling an item must never rewrite a
    // rule the kitchen is already cooking to.
    const seeded = readServiceStyleFormValues([platedRule], "Drink");

    expect(seeded.Plated.unit).toBe("plate");
    expect(seeded.Plated.perBasis).toBe("TotalGuests");
  });

  it("leaves both styles off for a library-only item", () => {
    const seeded = readServiceStyleFormValues([], "Food");

    expect(seeded.Buffet.enabled).toBe(false);
    expect(seeded.Plated.enabled).toBe(false);
  });
});
