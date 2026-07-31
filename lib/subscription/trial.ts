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
