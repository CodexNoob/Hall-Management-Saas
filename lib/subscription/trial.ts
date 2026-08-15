export const TRIAL_DAYS = 14;
export const TESTER_BYPASS_EMAILS = ["charlesjohnduot@gmail.com"];

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "expired"
  | "cancelled";

export function getTrialDates(now = new Date()) {
  const trialStartedAt = new Date(now);
  const trialEndsAt = new Date(now);
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  return { trialStartedAt, trialEndsAt };
}

export function isTesterBypassEmail(email: string | null | undefined) {
  if (!email) return false;

  return TESTER_BYPASS_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * The subscription columns a brand new organization starts life with.
 *
 * Provisioning asks for this instead of computing it, so `TRIAL_DAYS` stays the
 * single source of truth next to `getTrialDaysRemaining` and `isTrialExpired`
 * that read it. Deliberately NOT a set of Prisma `@default`s: `now() + interval
 * '14 days'` would split the number across TypeScript and SQL and make it
 * untestable without a database.
 *
 * Note that `Organization.subscriptionStatus` defaults to "active" in the
 * schema, so anything creating an organization without these values gets a paid
 * organization for free. This is the only caller outside the seed.
 */
export function newOrganizationSubscription(
  email: string | null | undefined,
  now = new Date()
) {
  if (isTesterBypassEmail(email)) {
    return {
      subscriptionStatus: "active" as const,
      trialStartedAt: null,
      trialEndsAt: null,
      subscriptionStartedAt: now
    };
  }

  const { trialStartedAt, trialEndsAt } = getTrialDates(now);

  return {
    subscriptionStatus: "trialing" as const,
    trialStartedAt,
    trialEndsAt,
    subscriptionStartedAt: null
  };
}

export function getTrialDaysRemaining(
  trialEndsAt: string | Date | null | undefined,
  now = new Date()
) {
  if (!trialEndsAt) return null;

  const endsAt =
    trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
  const diffMs = endsAt.getTime() - now.getTime();

  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function isTrialExpired({
  email,
  subscriptionStatus,
  trialEndsAt
}: {
  email?: string | null;
  subscriptionStatus?: string | null;
  trialEndsAt?: string | Date | null;
}) {
  if (isTesterBypassEmail(email)) return false;
  if (subscriptionStatus !== "trialing") return false;
  if (!trialEndsAt) return false;

  return new Date(trialEndsAt).getTime() <= Date.now();
}
