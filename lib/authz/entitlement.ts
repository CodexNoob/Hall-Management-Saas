import type { PermissionKey } from "@/lib/authz/catalog";

/**
 * Entitlement - what the organization's PLAN permits - is a fifth axis, and it
 * is deliberately not a permission row.
 *
 * The resolver consults this and can deny with `not-entitled`, but plan rules
 * must never be modelled as `role_permissions`. The moment they are, an owner
 * can "fix" a billing limit by ticking a checkbox, and the two systems start
 * disagreeing about which one is authoritative.
 *
 * WHERE THIS STANDS TODAY
 * -----------------------
 * `lib/subscription/plans.ts` describes plans in terms of NUMERIC LIMITS - hall
 * count, staff count, events per month - not feature flags. There is no key in
 * the catalog that one plan has and another does not, so this map is empty and
 * the gate is a pass-through.
 *
 * That is the correct state, not an unfinished one. The axis is named, the
 * resolver calls it, and `not-entitled` is a real denial reason with a real
 * status code - so the day a plan gains a gated feature, it is one entry here
 * and nothing else changes. Seeding a taxonomy nobody has agreed to would be the
 * more expensive mistake.
 *
 * Trial expiry and subscription status are deliberately NOT enforced here.
 * Nothing enforces them server-side today, and turning that on is a billing
 * change with its own blast radius - it belongs in the billing work, not
 * smuggled in behind an authorization refactor.
 */

export type EntitlementInput = {
  subscriptionPlan: string | null;
  subscriptionStatus: string;
};

/**
 * Permission keys that require a specific plan. Absent from this map means every
 * plan includes the key.
 */
const PLAN_GATED_KEYS: Partial<Record<PermissionKey, readonly string[]>> = {};

export function isEntitled(
  organization: EntitlementInput,
  permission: PermissionKey
): boolean {
  const requiredPlans = PLAN_GATED_KEYS[permission];

  if (!requiredPlans) return true;

  return Boolean(
    organization.subscriptionPlan &&
      requiredPlans.includes(organization.subscriptionPlan)
  );
}
