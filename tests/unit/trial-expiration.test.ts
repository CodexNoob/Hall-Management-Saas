import { describe, expect, it } from "vitest";
import {
  getTrialDaysRemaining,
  isTrialExpired
} from "@/lib/subscription/trial";

describe("free-trial expiration", () => {
  it("reports zero days and expires a trial when its end time has passed", () => {
    const trialEndsAt = new Date(Date.now() - 60_000);

    expect(getTrialDaysRemaining(trialEndsAt)).toBe(0);
    expect(
      isTrialExpired({
        email: "venue@example.com",
        subscriptionStatus: "trialing",
        trialEndsAt
      })
    ).toBe(true);
  });

  it("keeps a trial available before its exact expiration time", () => {
    expect(
      isTrialExpired({
        email: "venue@example.com",
        subscriptionStatus: "trialing",
        trialEndsAt: new Date(Date.now() + 60_000)
      })
    ).toBe(false);
  });

  it("does not treat an active paid subscription as an expired trial", () => {
    expect(
      isTrialExpired({
        email: "venue@example.com",
        subscriptionStatus: "active",
        trialEndsAt: new Date(Date.now() - 60_000)
      })
    ).toBe(false);
  });

  it("preserves the configured permanent tester bypass", () => {
    expect(
      isTrialExpired({
        email: "charlesjohnduot@gmail.com",
        subscriptionStatus: "trialing",
        trialEndsAt: new Date(Date.now() - 60_000)
      })
    ).toBe(false);
  });
});
