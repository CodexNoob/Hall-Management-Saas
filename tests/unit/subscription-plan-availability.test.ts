import { describe, expect, it } from "vitest";

import {
  freeTrialPlan,
  isPurchasablePlan,
  subscriptionPlans
} from "@/lib/subscription/plans";

/**
 * Which plans anyone can actually be put on.
 *
 * One answer, asked in two places: the upgrade dialog, so it offers no button
 * for a plan nobody can buy, and the Stripe checkout route, because the plan id
 * travels in a request body and a hidden button is a courtesy rather than a
 * control.
 */
describe("plan availability", () => {
  it("sells Starter and nothing else yet", () => {
    const purchasable = subscriptionPlans
      .filter((plan) => isPurchasablePlan(plan.id))
      .map((plan) => plan.id);

    expect(purchasable).toEqual(["starter"]);
  });

  it("keeps the unsold plans listed rather than removing them", () => {
    // The ladder is what a venue on Starter is choosing against, and the limits
    // on these rows are what the entitlement checks read - so they stay.
    expect(subscriptionPlans.map((plan) => plan.id)).toEqual([
      "starter",
      "professional",
      "enterprise"
    ]);

    for (const id of ["professional", "enterprise"]) {
      expect(
        subscriptionPlans.find((plan) => plan.id === id)?.comingSoon
      ).toBe(true);
    }
  });

  it("refuses the free trial and anything it does not recognise", () => {
    // An organization is put on the trial by signing up, not by paying for it.
    expect(isPurchasablePlan(freeTrialPlan.id)).toBe(false);
    expect(isPurchasablePlan("enterprise_plus")).toBe(false);
    expect(isPurchasablePlan(null)).toBe(false);
    expect(isPurchasablePlan(undefined)).toBe(false);
    expect(isPurchasablePlan("")).toBe(false);
  });

  it("marks exactly one plan as the emphasised one", () => {
    // The badge follows what can be bought: two highlighted cards, or a
    // highlight on a plan nobody can buy, both mislead.
    const emphasised = subscriptionPlans.filter((plan) => plan.popular);

    expect(emphasised).toHaveLength(1);
    expect(emphasised[0]?.id).toBe("starter");
    expect(isPurchasablePlan(emphasised[0]?.id)).toBe(true);
  });
});
