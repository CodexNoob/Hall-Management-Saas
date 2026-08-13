import { z } from "zod";

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

type NumericOptions = {
  min?: number;
  max?: number;
  label?: string;
};

/** Whole, non-negative quantities: guest counts, seats, capacity. */
export function countSchema({
  min = 0,
  max = MAX_COUNT,
  label = "This field"
}: NumericOptions = {}) {
  return z
    .number({ invalid_type_error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} must be ${max} or less.`);
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
  label = "Amount"
}: NumericOptions = {}) {
  return z
    .number({ invalid_type_error: `${label} must be a number.` })
    .finite(`${label} must be a real number.`)
    .multipleOf(0.01, `${label} can have at most 2 decimal places.`)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} must be ${max} or less.`);
}

/** Money already reduced to integer cents, including computed totals. */
export function centsSchema({
  min = 0,
  max = MAX_MONEY * 100,
  label = "Amount"
}: NumericOptions = {}) {
  return z
    .number({ invalid_type_error: `${label} must be a number.` })
    .int(`${label} must be a whole number of cents.`)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} must be ${max} or less.`);
}

/** Canvas geometry: positions, sizes, rotation. Fractional values are fine. */
export function dimensionSchema({
  min = 0,
  max = 10_000,
  label = "Value"
}: NumericOptions = {}) {
  return z
    .number({ invalid_type_error: `${label} must be a number.` })
    .finite(`${label} must be a real number.`)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} must be ${max} or less.`);
}

/**
 * Invoice line-item quantities. Deliberately NOT `.int()`: the column is
 * `Decimal(12, 3)`, so partial units are a supported billing case.
 */
export function quantitySchema({ label = "Quantity" }: NumericOptions = {}) {
  return z
    .number({ invalid_type_error: `${label} must be a number.` })
    .finite(`${label} must be a real number.`)
    .multipleOf(0.001, `${label} can have at most 3 decimal places.`)
    .positive(`${label} must be greater than zero.`)
    .max(999_999.999, `${label} must be 999999.999 or less.`);
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
  schema: z.ZodType<number>
): NumericParseResult {
  const trimmed = raw.trim();

  if (trimmed === "") return { status: "empty" };

  if (!NUMERIC_TEXT.test(trimmed)) {
    return { status: "invalid", message: "Enter a number." };
  }

  const parsed = schema.safeParse(Number(trimmed));

  if (parsed.success) return { status: "valid", value: parsed.data };

  return {
    status: "invalid",
    message: parsed.error.issues[0]?.message ?? "Enter a valid number."
  };
}
