import { describe, expect, it } from "vitest";
import {
  MAX_COUNT,
  centsSchema,
  countSchema,
  dimensionSchema,
  moneySchema,
  parseNumericInput,
  quantitySchema
} from "@/lib/validation/number";

describe("countSchema", () => {
  it("accepts whole numbers inside the bounds, including both ends", () => {
    expect(countSchema().parse(0)).toBe(0);
    expect(countSchema().parse(MAX_COUNT)).toBe(MAX_COUNT);
    expect(countSchema({ min: 1, max: 10 }).parse(1)).toBe(1);
    expect(countSchema({ min: 1, max: 10 }).parse(10)).toBe(10);
  });

  it("rejects the values JSON coercion used to smuggle through", () => {
    expect(countSchema().safeParse(NaN).success).toBe(false);
    expect(countSchema().safeParse(Infinity).success).toBe(false);
    expect(countSchema().safeParse(-Infinity).success).toBe(false);
  });

  it("rejects fractions, strings, and out-of-range values", () => {
    expect(countSchema().safeParse(1.5).success).toBe(false);
    expect(countSchema().safeParse("5").success).toBe(false);
    expect(countSchema().safeParse(null).success).toBe(false);
    expect(countSchema().safeParse(-1).success).toBe(false);
    expect(countSchema().safeParse(MAX_COUNT + 1).success).toBe(false);
  });

  it("bounds counts below the 32-bit column they are stored in", () => {
    // Unbounded counts passed Zod and then failed at the Postgres driver as an
    // unhandled 500 rather than a 400.
    expect(countSchema().safeParse(99_999_999_999).success).toBe(false);
  });

  it("names the field in its messages", () => {
    const result = countSchema({ label: "Capacity" }).safeParse(1.5);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Capacity must be a whole number."
      );
    }
  });
});

describe("moneySchema", () => {
  it("accepts ordinary currency amounts", () => {
    expect(moneySchema().parse(0)).toBe(0);
    expect(moneySchema().parse(19.99)).toBe(19.99);
    expect(moneySchema().parse(99_999_999.99)).toBe(99_999_999.99);
  });

  it("rejects more than two decimal places", () => {
    expect(moneySchema().safeParse(1.005).success).toBe(false);
  });

  it("rejects non-finite and negative amounts", () => {
    expect(moneySchema().safeParse(NaN).success).toBe(false);
    expect(moneySchema().safeParse(Infinity).success).toBe(false);
    expect(moneySchema().safeParse(-0.01).success).toBe(false);
  });
});

describe("centsSchema", () => {
  it("requires whole cents", () => {
    expect(centsSchema().parse(1999)).toBe(1999);
    expect(centsSchema().safeParse(19.5).success).toBe(false);
  });

  it("allows a signed range when asked, for imported bank rows", () => {
    expect(centsSchema({ min: -1000 }).parse(-500)).toBe(-500);
    expect(centsSchema().safeParse(-500).success).toBe(false);
  });
});

describe("quantitySchema", () => {
  it("stays fractional because the column is Decimal(12,3)", () => {
    expect(quantitySchema().parse(1.5)).toBe(1.5);
    expect(quantitySchema().parse(0.001)).toBe(0.001);
  });

  it("still rejects zero, negatives, and more than three decimals", () => {
    expect(quantitySchema().safeParse(0).success).toBe(false);
    expect(quantitySchema().safeParse(-1).success).toBe(false);
    expect(quantitySchema().safeParse(1.2345).success).toBe(false);
  });
});

describe("dimensionSchema", () => {
  it("allows fractional geometry inside its bounds", () => {
    expect(dimensionSchema({ min: 0, max: 360 }).parse(12.5)).toBe(12.5);
    expect(dimensionSchema({ min: 10, max: 5000 }).safeParse(9).success).toBe(
      false
    );
    expect(
      dimensionSchema({ min: 0, max: 360 }).safeParse(Infinity).success
    ).toBe(false);
  });
});

describe("parseNumericInput", () => {
  it("reports empty input as empty rather than zero", () => {
    // This is the whole defect: `Number("")` is 0, so clearing a field used to
    // write a silent 0 instead of asking the user for a value.
    expect(parseNumericInput("", countSchema())).toEqual({ status: "empty" });
    expect(parseNumericInput("   ", countSchema())).toEqual({
      status: "empty"
    });
    expect(parseNumericInput("", countSchema())).not.toEqual({
      status: "valid",
      value: 0
    });
  });

  it("rejects text that is not a plain decimal", () => {
    for (const raw of ["abc", "1e5", "--5", "1.2.3", "0x10", "Infinity", "$5"]) {
      expect(parseNumericInput(raw, countSchema())).toEqual({
        status: "invalid",
        message: "Enter a number."
      });
    }
  });

  it("accepts plain decimals and trims surrounding space", () => {
    expect(parseNumericInput("12", countSchema())).toEqual({
      status: "valid",
      value: 12
    });
    expect(parseNumericInput(" 12 ", countSchema())).toEqual({
      status: "valid",
      value: 12
    });
    expect(parseNumericInput("0.5", moneySchema())).toEqual({
      status: "valid",
      value: 0.5
    });
    expect(parseNumericInput(".5", moneySchema())).toEqual({
      status: "valid",
      value: 0.5
    });
  });

  it("passes the schema's own message through when the value parses but fails", () => {
    expect(
      parseNumericInput("12.345", moneySchema({ label: "Base price" }))
    ).toEqual({
      status: "invalid",
      message: "Base price can have at most 2 decimal places."
    });
    expect(parseNumericInput("-3", countSchema({ label: "Guests" }))).toEqual({
      status: "invalid",
      message: "Guests must be at least 0."
    });
  });
});
