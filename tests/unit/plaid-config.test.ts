import { describe, expect, it } from "vitest";
import { getPlaidRuntimeConfig } from "@/lib/plaid";

describe("getPlaidRuntimeConfig", () => {
  it("returns demo mode when Plaid credentials are missing", () => {
    delete process.env.PLAID_CLIENT_ID;
    delete process.env.PLAID_SECRET;
    delete process.env.PLAID_ENV;

    const config = getPlaidRuntimeConfig();

    expect(config.enabled).toBe(false);
    expect(config.mode).toBe("demo");
    expect(config.baseUrl).toBe("https://sandbox.plaid.com");
  });

  it("returns live mode when Plaid credentials are present", () => {
    process.env.PLAID_CLIENT_ID = "test-client";
    process.env.PLAID_SECRET = "test-secret";
    process.env.PLAID_ENV = "development";

    const config = getPlaidRuntimeConfig();

    expect(config.enabled).toBe(true);
    expect(config.mode).toBe("development");
    expect(config.baseUrl).toBe("https://development.plaid.com");
  });
});
