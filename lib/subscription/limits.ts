import { type SubscriptionStatus } from "@/lib/subscription/trial";
import {
  freeTrialPlan,
  getSubscriptionPlan,
  type SubscriptionPlanLimitKey,
  type SubscriptionPlanLimits
} from "@/lib/subscription/plans";

export const FREE_TRIAL_HALL_LIMIT = freeTrialPlan.limits.activeHalls ?? 1;

const defaultLimits: SubscriptionPlanLimits = {
  activeHalls: null,
  staffMembers: null,
  eventsPerMonth: null,
  storageGb: null,
  invoicesPerMonth: null
};

const limitsByStatus: Partial<Record<SubscriptionStatus, SubscriptionPlanLimits>> = {
  trialing: {
    ...freeTrialPlan.limits
  }
};

export function getSubscriptionLimits(
  subscriptionStatus: string | null | undefined,
  subscriptionPlan?: string | null | undefined
): SubscriptionPlanLimits {
  const planLimits = getSubscriptionPlan(subscriptionPlan)?.limits;

  return {
    ...defaultLimits,
    ...(planLimits ?? {}),
    ...(limitsByStatus[subscriptionStatus as SubscriptionStatus] ?? {})
  };
}

export function getSubscriptionLimit(
  subscriptionStatus: string | null | undefined,
  key: SubscriptionPlanLimitKey,
  subscriptionPlan?: string | null | undefined
) {
  return getSubscriptionLimits(subscriptionStatus, subscriptionPlan)[key];
}

export function getActiveHallLimit(
  subscriptionStatus: string | null | undefined,
  subscriptionPlan?: string | null | undefined
) {
  return getSubscriptionLimit(subscriptionStatus, "activeHalls", subscriptionPlan);
}
