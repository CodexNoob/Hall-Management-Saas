const FREE_TRIAL_ALLOWED_EMAILS_ENV = "FREE_TRIAL_ALLOWED_EMAILS";

export function getFreeTrialAllowedEmails() {
  return (process.env[FREE_TRIAL_ALLOWED_EMAILS_ENV] ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 3);
}

export function isFreeTrialEmailAllowed(email: string) {
  const allowedEmails = getFreeTrialAllowedEmails();

  if (allowedEmails.length === 0) {
    return false;
  }

  return allowedEmails.includes(email.trim().toLowerCase());
}

export const FREE_TRIAL_NOT_ALLOWED_MESSAGE =
  "Free trial access is currently limited. Please contact the Event Core team for access.";
