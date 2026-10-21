import { z } from "zod";

import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Shared numeric vocabulary for forms and route handlers.
 *
 * Both layers import from here so a field cannot be validated one way in the
 * browser and another way on the server. Keep this module pure Zod - no
 * `server-only`, no Prisma - so client components can import it too.
 *
 * Zod 3 specifics worth knowing before editing:
 * - `z.number()` already rejects NaN, but it ACCEPTS Infinity.
 * - `.int()` rejects both, so `.finite()` is only needed on non-integer schemas.
 */

/** Postgres `Int` is 32-bit; anything larger throws at the driver, not in Zod. */
export const INT32_MAX = 2_147_483_647;

/** Matches the bound the halls and dining schemas already used. */
export const MAX_COUNT = 100_000;

/** Money columns are `Decimal(12, 2)`; this stays well inside that. */
export const MAX_MONEY = 100_000_000;

/**
 * The translator, when the caller has one.
 *
 * This module is imported by route handlers as well as by forms, and a route
 * handler has no locale: the language is a per-organization setting the API
 * never reads, and an error message it returns is the same for every caller.
 * So translation is opt-in rather than ambient - a client form passes `t` and
 * gets its own language, a route handler passes nothing and keeps the English
 * its tests and its API consumers already expect.
 */
export type ValidationTranslate = (
  key: MessageKey,
  values?: Record<string, string | number>
) => string;

type NumericOptions = {
  min?: number;
  max?: number;
  label?: string;
  t?: ValidationTranslate;
};

/** Every sentence this module can produce, in whichever language applies. */
function frames(t: ValidationTranslate | undefined, label: string) {
  return {
    number: t
      ? t("validation.mustBeNumber", { label })
      : `${label} must be a number.`,
    whole: t
      ? t("validation.mustBeWholeNumber", { label })
      : `${label} must be a whole number.`,
    wholeCents: t
      ? t("validation.mustBeWholeCents", { label })
      : `${label} must be a whole number of cents.`,
    real: t
      ? t("validation.mustBeRealNumber", { label })
      : `${label} must be a real number.`,
    twoDecimals: t
      ? t("validation.atMostTwoDecimals", { label })
      : `${label} can have at most 2 decimal places.`,
    threeDecimals: t
      ? t("validation.atMostThreeDecimals", { label })
      : `${label} can have at most 3 decimal places.`,
    positive: t
      ? t("validation.greaterThanZero", { label })
      : `${label} must be greater than zero.`,
    atLeast: (min: number) =>
      t
        ? t("validation.atLeast", { label, min })
        : `${label} must be at least ${min}.`,
    atMost: (max: number) =>
      t ? t("validation.atMost", { label, max }) : `${label} must be ${max} or less.`
  };
}

/** Whole, non-negative quantities: guest counts, seats, capacity. */
export function countSchema({
  min = 0,
  max = MAX_COUNT,
  label,
  t
}: NumericOptions = {}) {
  const name = label ?? (t ? t("validation.thisField") : "This field");
  const say = frames(t, name);

  return z
    .number({ invalid_type_error: say.number })
    .int(say.whole)
    .min(min, say.atLeast(min))
    .max(max, say.atMost(max));
}

/**
 * User-entered currency amounts, in whole units (dollars), matching the
 * `Decimal(12, 2)` columns.
 *
 * Only use this for values a person typed. A COMPUTED total will fail
 * `multipleOf` on ordinary float error - `0.1 + 0.2` is `0.30000000000000004` -
 * so keep computed money in integer cents and validate it with `centsSchema`.
 */
export function moneySchema({
  min = 0,
  max = MAX_MONEY,
  label,
  t
}: NumericOptions = {}) {
  const name = label ?? (t ? t("validation.amount") : "Amount");
  const say = frames(t, name);

  return z
    .number({ invalid_type_error: say.number })
    .finite(say.real)
    .multipleOf(0.01, say.twoDecimals)
    .min(min, say.atLeast(min))
    .max(max, say.atMost(max));
}

/** Money already reduced to integer cents, including computed totals. */
export function centsSchema({
  min = 0,
  max = MAX_MONEY * 100,
  label,
  t
}: NumericOptions = {}) {
  const name = label ?? (t ? t("validation.amount") : "Amount");
  const say = frames(t, name);

  return z
    .number({ invalid_type_error: say.number })
    .int(say.wholeCents)
    .min(min, say.atLeast(min))
    .max(max, say.atMost(max));
}

/** Canvas geometry: positions, sizes, rotation. Fractional values are fine. */
export function dimensionSchema({
  min = 0,
  max = 10_000,
  label,
  t
}: NumericOptions = {}) {
  const name = label ?? (t ? t("validation.value") : "Value");
  const say = frames(t, name);

  return z
    .number({ invalid_type_error: say.number })
    .finite(say.real)
    .min(min, say.atLeast(min))
    .max(max, say.atMost(max));
}

/**
 * Invoice line-item quantities. Deliberately NOT `.int()`: the column is
 * `Decimal(12, 3)`, so partial units are a supported billing case.
 */
export function quantitySchema({ label, t }: NumericOptions = {}) {
  const name = label ?? (t ? t("validation.quantity") : "Quantity");
  const say = frames(t, name);

  return z
    .number({ invalid_type_error: say.number })
    .finite(say.real)
    .multipleOf(0.001, say.threeDecimals)
    .positive(say.positive)
    .max(999_999.999, say.atMost(999_999.999));
}

export type NumericParseResult =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "valid"; value: number };

/**
 * Plain decimal only. Exponent notation is rejected on purpose: nobody types
 * `1e5` into a guest count, and accepting it invites `1e308`.
 */
const NUMERIC_TEXT = /^-?(\d+(\.\d+)?|\.\d+)$/;

/**
 * Turns raw input text into a validated number.
 *
 * The three-way result is the point. `Number("")` is `0` and `Number("abc")` is
 * `NaN`, which `JSON.stringify` then sends as `null` - that is how garbage used
 * to reach the database as a silent `0` or a silent clear. This function can
 * never return a number for empty or unparseable text, so callers have to
 * handle those cases explicitly.
 */
export function parseNumericInput(
  raw: string,
  schema: z.ZodType<number>,
  t?: ValidationTranslate
): NumericParseResult {
  const trimmed = raw.trim();

  if (trimmed === "") return { status: "empty" };

  if (!NUMERIC_TEXT.test(trimmed)) {
    return {
      status: "invalid",
      message: t ? t("validation.enterNumber") : "Enter a number."
    };
  }

  const parsed = schema.safeParse(Number(trimmed));

  if (parsed.success) return { status: "valid", value: parsed.data };

  return {
    status: "invalid",
    // The schema's own message, which carries whichever language it was built
    // with. The fallback only fires for an issue with no message at all.
    message:
      parsed.error.issues[0]?.message ??
      (t ? t("validation.enterValidNumber") : "Enter a valid number.")
  };
}
