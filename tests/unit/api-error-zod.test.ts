import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { createApiErrorResponse } from "@/lib/http/api-error";
import {
  formatZodErrorMessage,
  humanizeFieldName
} from "@/lib/http/zod-error-message";
import { countSchema, moneySchema } from "@/lib/validation/number";

describe("humanizeFieldName", () => {
  it("turns schema keys into readable labels", () => {
    expect(humanizeFieldName("basePrice")).toBe("Base price");
    expect(humanizeFieldName("capacity")).toBe("Capacity");
    expect(humanizeFieldName("amount_cents")).toBe("Amount cents");
  });

  it("ignores array indices in nested paths", () => {
    expect(humanizeFieldName("lineItems.0.quantity")).toBe("Quantity");
  });
});

describe("formatZodErrorMessage", () => {
  it("falls back when there is nothing to report", () => {
    expect(formatZodErrorMessage({ formErrors: [], fieldErrors: {} })).toBe(
      "Invalid request."
    );
  });

  it("does not repeat a label the schema message already starts with", () => {
    expect(
      formatZodErrorMessage({
        formErrors: [],
        fieldErrors: { capacity: ["Capacity must be a whole number."] }
      })
    ).toBe("Capacity must be a whole number.");
  });

  it("prefixes the field when the message does not name it", () => {
    expect(
      formatZodErrorMessage({
        formErrors: [],
        fieldErrors: { basePrice: ["Required"] }
      })
    ).toBe("Base price: Required");
  });

  it("counts the remaining problems instead of listing them all", () => {
    expect(
      formatZodErrorMessage({
        formErrors: [],
        fieldErrors: {
          capacity: ["Capacity must be a whole number."],
          basePrice: ["Base price must be a number."]
        }
      })
    ).toBe("Capacity must be a whole number. (and 1 more issue)");
  });
});

describe("createApiErrorResponse for a schema failure", () => {
  const schema = z.object({
    capacity: countSchema({ min: 1, label: "Capacity" }),
    basePrice: moneySchema({ label: "Base price" })
  });

  async function reject(input: unknown) {
    const parsed = schema.safeParse(input);
    if (parsed.success) throw new Error("expected the schema to reject");

    const response = createApiErrorResponse(parsed.error);
    return { response, body: await response.json() };
  }

  it("names the offending field instead of answering 'Invalid request.'", async () => {
    const { response, body } = await reject({
      capacity: 1.5,
      basePrice: 10
    });

    expect(response.status).toBe(400);
    expect(body.error).toBe("Capacity must be a whole number.");
    expect(body.error).not.toBe("Invalid request.");
  });

  it("still returns the per-field issues for the form to consume", async () => {
    const { body } = await reject({ capacity: 10, basePrice: 10.005 });

    expect(body.issues.fieldErrors.basePrice).toEqual([
      "Base price can have at most 2 decimal places."
    ]);
  });

  it("rejects a numeric field sent as a string", async () => {
    const { body } = await reject({ capacity: "10", basePrice: 10 });

    expect(body.error).toBe("Capacity must be a number.");
  });
});
