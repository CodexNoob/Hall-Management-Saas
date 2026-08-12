import { describe, expect, it } from "vitest";
import {
  FREE_TRIAL_HALL_LIMIT,
  getActiveHallLimit,
  getSubscriptionLimit,
  getSubscriptionLimits
} from "@/lib/subscription/limits";

describe("getSubscriptionLimits", () => {
  it("falls back to unlimited defaults with no status or plan", () => {
    expect(getSubscriptionLimits(null, null)).toEqual({
      activeHalls: null,
      staffMembers: null,
      eventsPerMonth: null,
      storageGb: null,
      invoicesPerMonth: null
    });
    expect(getSubscriptionLimits(undefined, undefined)).toEqual({
      activeHalls: null,
      staffMembers: null,
      eventsPerMonth: null,
      storageGb: null,
      invoicesPerMonth: null
    });
  });

  it("applies the plan's limits when the plan is recognized", () => {
    expect(getSubscriptionLimits("active", "starter")).toEqual({
      activeHalls: 2,
      staffMembers: 10,
      eventsPerMonth: null,
      storageGb: 25,
      invoicesPerMonth: null
    });
    expect(getSubscriptionLimits("active", "professional")).toEqual({
      activeHalls: 10,
      staffMembers: 50,
      eventsPerMonth: null,
      storageGb: 100,
      invoicesPerMonth: null
    });
  });

  it("ignores an unrecognized plan id and falls back to defaults", () => {
    expect(getSubscriptionLimits("active", "not-a-real-plan")).toEqual({
      activeHalls: null,
      staffMembers: null,
      eventsPerMonth: null,
      storageGb: null,
      invoicesPerMonth: null
    });
  });

  it("forces free-trial limits when subscriptionStatus is trialing, overriding the plan", () => {
    expect(getSubscriptionLimits("trialing", "professional")).toEqual({
      activeHalls: FREE_TRIAL_HALL_LIMIT,
      staffMembers: 3,
      eventsPerMonth: 20,
      storageGb: 2,
      invoicesPerMonth: 20
    });
  });

  it("does not apply a status override for non-trialing statuses", () => {
    expect(getSubscriptionLimits("past_due", "starter")).toEqual({
      activeHalls: 2,
      staffMembers: 10,
      eventsPerMonth: null,
      storageGb: 25,
      invoicesPerMonth: null
    });
  });
});

describe("getSubscriptionLimit", () => {
  it("reads a single key out of the merged limits", () => {
    expect(getSubscriptionLimit("active", "storageGb", "starter")).toBe(25);
    expect(getSubscriptionLimit("active", "activeHalls", "not-a-real-plan")).toBe(
      null
    );
  });
});

describe("getActiveHallLimit", () => {
  it("returns the plan's active hall limit", () => {
    expect(getActiveHallLimit("active", "starter")).toBe(2);
    expect(getActiveHallLimit("active", "enterprise")).toBe(null);
  });

  it("caps active halls to the free-trial limit while trialing, regardless of plan", () => {
    expect(getActiveHallLimit("trialing", "enterprise")).toBe(
      FREE_TRIAL_HALL_LIMIT
    );
  });

  it("returns null with no status or plan", () => {
    expect(getActiveHallLimit(null, null)).toBe(null);
  });
});
