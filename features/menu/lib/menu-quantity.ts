import type {
  CountBasis,
  MenuItemServiceRule,
  RoundingMode
} from "@/features/menu/lib/service-style";

/**
 * How much to cook.
 *
 * This is the arithmetic the master spec calls `kitchenService.applyCountingRules()`,
 * and it could not be written against the old `counting_rules` json: that shape
 * carried "per 30 people" with no way to say which of the event's seven head
 * counts it meant, and no rounding mode, so 187 guests at one tray per thirty
 * came out as 6.233 trays.
 *
 * Not yet wired to the kitchen dashboard - the dashboard reads
 * `events.menu_item_ids`, which is a later phase. It ships now because it is
 * what the columns were added for, and because it is testable on its own.
 *
 * Pure: no Prisma, no React, no `server-only`.
 */

/**
 * The counts a rule can divide.
 *
 * `tables` is `number | null` and required rather than optional on purpose.
 * There is no table count on the event - the only table data is the dining
 * plan's `tables` json - so an event without a plan genuinely cannot answer a
 * per-table rule. Making the field required means TypeScript names every caller
 * that has to decide what to pass, instead of letting `undefined` slide through
 * as a silent zero.
 */
export type EventHeadCounts = {
  couples: number;
  men: number;
  ladies: number;
  boys: number;
  girls: number;
  kids: number;
  waiters: number;
  tables: number | null;
};

export type MenuQuantity = {
  unit: string;
  /** What to cook. Whole unless the rule's rounding is `Exact`. */
  units: number;
  /** Before rounding, kept so a sheet can explain where the number came from. */
  raw: number;
};

export type MenuQuantityResult = {
  quantities: MenuQuantity[];
  /**
   * Bases no count was available for - in practice `Tables` on an event with no
   * dining plan.
   *
   * Reported rather than silently treated as zero. A kitchen sheet that prints
   * "0 dips" because nobody had drawn the tables yet is worse than one that says
   * it cannot work the number out.
   */
  unresolved: CountBasis[];
};

/**
 * Guests, not people: waiters eat but are not guests, and counting them into a
 * per-guest tray would over-cater every event that has staff meals.
 *
 * Deliberately the same arithmetic as `countAttendees` in
 * `features/bookings/services/booking.service.ts`, which cannot be imported
 * here - it is `server-only` and pulls in Prisma, while this module has to stay
 * importable from the dialog. If one of the two changes, change both.
 */
export function totalGuests(counts: EventHeadCounts) {
  return (
    counts.couples * 2 +
    counts.men +
    counts.ladies +
    counts.boys +
    counts.girls +
    counts.kids
  );
}

/** `null` means "this event cannot answer that question", not "zero". */
export function readBasisCount(
  basis: CountBasis,
  counts: EventHeadCounts
): number | null {
  switch (basis) {
    case "TotalGuests":
      return totalGuests(counts);
    case "Couples":
      return counts.couples;
    case "Men":
      return counts.men;
    case "Ladies":
      return counts.ladies;
    case "Boys":
      return counts.boys;
    case "Girls":
      return counts.girls;
    case "Kids":
      return counts.kids;
    case "Waiters":
      return counts.waiters;
    case "Tables":
      return counts.tables;
    case "Event":
      return 1;
  }
}

/**
 * Trims float error before rounding.
 *
 * `1 * 180 / 30` is `6.000000000000001` on some inputs, and `Math.ceil` of that
 * is 7 - an extra tray, every time, for arithmetic that came out even.
 */
function settle(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

export function applyRounding(raw: number, mode: RoundingMode) {
  const value = settle(raw);

  switch (mode) {
    case "Up":
      return Math.ceil(value);
    case "Down":
      return Math.floor(value);
    case "Nearest":
      return Math.round(value);
    case "Exact":
      return value;
  }
}

/**
 * Takes a LIST of rules on purpose.
 *
 * Today a dish has one rule per style, so the list has one entry. The shape is a
 * list because the case that is coming - one rate for adults and another for
 * children, on the same dish in the same service - is then a second row rather
 * than a rewrite of this function and the table under it.
 *
 * Rules are grouped by unit before summing: adding trays to bottles would be
 * meaningless, so each unit produces its own line on the kitchen sheet. Rounding
 * happens once per group, after summing, because rounding each rule first would
 * charge the event a whole extra tray per rule.
 */
export function calculateMenuQuantity(
  rules: MenuItemServiceRule[],
  counts: EventHeadCounts
): MenuQuantityResult {
  const unresolved: CountBasis[] = [];
  const groups = new Map<string, MenuItemServiceRule[]>();

  for (const rule of rules) {
    if (readBasisCount(rule.perBasis, counts) === null) {
      if (!unresolved.includes(rule.perBasis)) unresolved.push(rule.perBasis);
      continue;
    }

    const group = groups.get(rule.unit);
    if (group) group.push(rule);
    else groups.set(rule.unit, [rule]);
  }

  const quantities = [...groups].map(([unit, group]) => {
    const raw = group.reduce((total, rule) => {
      // Non-null by construction: an unresolvable basis never reaches a group.
      const basis = readBasisCount(rule.perBasis, counts) ?? 0;

      // `per` is a divisor and the column CHECKs it above zero, but a unit test
      // can hand this function anything.
      return total + (rule.quantity * basis) / Math.max(rule.per, 1);
    }, 0);

    // The strictest floor in the group wins: a minimum is a promise about what
    // leaves the kitchen, so the largest one is the one that has to hold.
    const minimum = group.reduce(
      (highest, rule) => Math.max(highest, rule.minimumUnits ?? 0),
      0
    );

    // Rounding is per-group and taken from the first rule: within one unit the
    // modes agree, because they describe the unit, not the rule.
    const rounding = group[0].rounding;

    return {
      unit,
      raw: settle(raw),
      units: Math.max(applyRounding(raw, rounding), minimum)
    };
  });

  return { quantities, unresolved };
}

/**
 * The same calculation for one service style, which is what a kitchen sheet
 * actually asks for. Returns `null` for a dish that is not served this way -
 * different from a dish served this way that came out at zero.
 */
export function calculateStyleQuantity(
  rules: MenuItemServiceRule[],
  style: MenuItemServiceRule["serviceStyle"],
  counts: EventHeadCounts
): MenuQuantityResult | null {
  const forStyle = rules.filter((rule) => rule.serviceStyle === style);

  return forStyle.length > 0 ? calculateMenuQuantity(forStyle, counts) : null;
}

/**
 * The bounds `EventMenuLine.quantityMultiplier` is held to, in the three places
 * that have to agree: the CHECK on the column, the zod schema on the menu PUT
 * and the stepper on the card.
 */
export const LINE_MULTIPLIER_MIN = 1;
export const LINE_MULTIPLIER_MAX = 99;

/** What one serving rounds to. `units` is that times the line's multiplier. */
export type ScaledMenuQuantity = MenuQuantity & { perServingUnits: number };

/**
 * A multiplier off a row, an old client or a test, made safe.
 *
 * Every branch shares one database, so a line can have been written by code that
 * predates the column and its CHECK. Answering 1 for anything unusable is the
 * right failure: a presenter is not the place to throw over a menu line, and one
 * serving is what that row has always meant.
 */
export function readLineMultiplier(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return LINE_MULTIPLIER_MIN;
  }

  return Math.min(
    Math.max(Math.floor(value), LINE_MULTIPLIER_MIN),
    LINE_MULTIPLIER_MAX
  );
}

/**
 * "2x the brisket": how many complete servings of one line the event is getting.
 *
 * Multiplies the FINISHED units - after rounding and after `minimumUnits` -
 * because ordering two of a dish is two servings, and each one clears the rule
 * on its own. Scaling `raw` first instead would let a minimum swallow the
 * doubling whole: one tray per hundred with a floor of two, at forty guests, is
 * two trays at 1x and still two trays at 2x, and nothing on the sheet would say
 * why the second helping never arrived.
 *
 * `raw` is deliberately left per-serving. It exists to explain the rounding
 * step, and rounding happens per serving - a doubled `raw` printed beside the
 * total would be a note contradicting the number above it.
 */
export function scaleMenuQuantities(
  quantities: MenuQuantity[],
  multiplier: number
): ScaledMenuQuantity[] {
  const safe = readLineMultiplier(multiplier);

  return quantities.map((quantity) => ({
    unit: quantity.unit,
    raw: quantity.raw,
    perServingUnits: quantity.units,
    units: quantity.units * safe
  }));
}
