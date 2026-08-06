import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { verifyStripeSignature } from "@/features/billing/services/stripe.service";

describe("Stripe billing security", () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  it("accepts a current signature over the unchanged raw body", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    const body = JSON.stringify({
      id: "evt_123",
      type: "checkout.session.completed"
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`)).toBe(
      true
    );
    expect(
      verifyStripeSignature(`${body} `, `t=${timestamp},v1=${signature}`)
    ).toBe(false);
  });

  it("rejects stale webhook signatures", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    const body = "{}";
    const timestamp = Math.floor(Date.now() / 1000) - 1_000;
    const signature = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`)).toBe(
      false
    );
  });
});
