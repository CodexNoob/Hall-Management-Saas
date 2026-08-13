import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  PHONE_COUNTRIES,
  countryFromE164,
  formatAsYouType,
  formatPhoneForDisplay,
  nationalFromE164,
  parsePhoneInput,
  phoneSchema,
  requiredPhoneSchema
} from "@/lib/validation/phone";

describe("parsePhoneInput", () => {
  it("reports an empty field separately from a wrong one", () => {
    // The same three-way contract as parseNumericInput: a blank optional field
    // is not an error, and must never be confused with a malformed entry.
    expect(parsePhoneInput("")).toEqual({ status: "empty" });
    expect(parsePhoneInput("   ")).toEqual({ status: "empty" });
  });

  it("rejects letters, which is the defect this module exists for", () => {
    const result = parsePhoneInput("hello world");

    expect(result.status).toBe("invalid");
  });

  it("rejects a number that is well-formed but not a real line", () => {
    // 555-01xx is the North American range reserved for fiction. A charset or
    // length regex accepts it; the numbering-plan metadata does not.
    expect(parsePhoneInput("+1 555 010 8899").status).toBe("invalid");
    expect(parsePhoneInput("+1 555 0100").status).toBe("invalid");
  });

  it("rejects a number that is too short for its country", () => {
    expect(parsePhoneInput("+63 917").status).toBe("invalid");
    expect(parsePhoneInput("12345", { country: "US" }).status).toBe("invalid");
  });

  it("accepts a real number and normalizes it to E.164", () => {
    const result = parsePhoneInput("+63 917 123 4567");

    expect(result).toMatchObject({ status: "valid", value: "+639171234567" });
  });

  it("reads a national number when told which country it is from", () => {
    const result = parsePhoneInput("09171234567", { country: "PH" });

    expect(result).toMatchObject({ status: "valid", value: "+639171234567" });
  });

  it("collapses every way of writing one line to a single string", () => {
    // This is what makes deduping a client by phone possible.
    const written = [
      "+63 917 123 4567",
      "+639171234567",
      "(0917) 123-4567",
      "0917 123 4567"
    ];

    const normalized = written.map((raw) => {
      const result = parsePhoneInput(raw, { country: "PH" });
      return result.status === "valid" ? result.value : result.status;
    });

    expect(new Set(normalized)).toEqual(new Set(["+639171234567"]));
  });

  it("names the country in the message when it knows which was meant", () => {
    // The picker always supplies a country, so this is the message users see.
    const result = parsePhoneInput("555 010 8899", { country: "US" });

    expect(result.status === "invalid" && result.message).toContain(
      "United States"
    );
  });

  it("stays generic rather than guessing from an ambiguous calling code", () => {
    // "+1" is the US, Canada and ~20 more, so naming one would be a lie.
    const result = parsePhoneInput("+1 555 010 8899", { country: "PH" });

    expect(result.status === "invalid" && result.message).toBe(
      "Enter a valid phone number."
    );
  });
});

describe("phoneSchema", () => {
  it("treats a blank optional field as not supplied", () => {
    expect(phoneSchema().parse("")).toBeUndefined();
    expect(phoneSchema().parse("   ")).toBeUndefined();
  });

  it("outputs E.164 regardless of how the number was typed", () => {
    expect(phoneSchema().parse("+63 917 123 4567")).toBe("+639171234567");
    expect(phoneSchema().parse("(212) 867-5309")).toBe("+12128675309");
  });

  it("refuses anything that is not a real number", () => {
    const schema = phoneSchema({ label: "Phone number" });

    for (const bad of ["hello", "123", "+1 555 010 8899", "abc-def-ghij"]) {
      expect(schema.safeParse(bad).success).toBe(false);
    }
  });

  it("names the field in the error so the API message is usable", () => {
    const result = phoneSchema({ label: "Vendor phone" }).safeParse("nope");

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain("Vendor phone");
  });

  it("requires a value only when asked to", () => {
    expect(phoneSchema({ required: true }).safeParse("").success).toBe(false);
    expect(phoneSchema().safeParse("").success).toBe(true);
  });

  it("composes into an object schema without widening the type", () => {
    const schema = z.object({ phone: requiredPhoneSchema({ label: "Phone" }) });
    const parsed = schema.parse({ phone: "+63 917 123 4567" });

    expect(parsed.phone).toBe("+639171234567");
    expect(schema.safeParse({ phone: "" }).success).toBe(false);
  });
});

describe("display helpers", () => {
  it("shows a stored number in readable international form", () => {
    expect(formatPhoneForDisplay("+639171234567")).toBe("+63 917 123 4567");
  });

  it("passes through a legacy value it cannot parse", () => {
    // Rows written before this validation existed must still render.
    expect(formatPhoneForDisplay("Not provided")).toBe("Not provided");
    expect(formatPhoneForDisplay(null)).toBe("");
  });

  it("splits a stored number back into country and national parts", () => {
    expect(countryFromE164("+639171234567")).toBe("PH");
    expect(nationalFromE164("+12128675309")).toBe("(212) 867-5309");
  });

  it("formats progressively in the country's own convention", () => {
    expect(formatAsYouType("2128675309", "US")).toBe("(212) 867-5309");
    expect(formatAsYouType("212", "US")).toBe("(212)");
  });
});

describe("PHONE_COUNTRIES", () => {
  it("covers every territory the validator knows", () => {
    expect(PHONE_COUNTRIES.length).toBeGreaterThan(200);
  });

  it("leads with the four the onboarding form already offered", () => {
    expect(PHONE_COUNTRIES.slice(0, 4).map((entry) => entry.code)).toEqual([
      "US",
      "GB",
      "PH",
      "IN"
    ]);
  });

  it("carries a readable name and calling code for the picker", () => {
    const ph = PHONE_COUNTRIES.find((entry) => entry.code === "PH");

    expect(ph).toMatchObject({ name: "Philippines", callingCode: "+63" });
  });

  it("distinguishes countries that share a calling code", () => {
    // +1 is US, CA and ~20 more, which is why the picker stores ISO codes.
    const plusOne = PHONE_COUNTRIES.filter(
      (entry) => entry.callingCode === "+1"
    );

    expect(plusOne.length).toBeGreaterThan(2);
    expect(plusOne.map((entry) => entry.code)).toContain("CA");
  });
});
