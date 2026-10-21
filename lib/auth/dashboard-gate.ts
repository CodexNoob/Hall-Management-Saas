import type { AuthSessionResponse } from "@/lib/auth/session-context";

/**
 * WHAT THE DASHBOARD SHOWS, IN ORDER: password, then 2FA, then this device.
 *
 *   "mfa"       - the session owes a second factor (challenge or enrolment).
 *   "device"    - the factor is satisfied, but this browser is not a
 *                 confirmed device yet.
 *   "dashboard" - both are satisfied.
 *
 * Pure, so the order is a unit test rather than something re-derived in a
 * JSX conditional. The 2FA gate always comes first: device confirmation adds
 * a step after the second factor and never stands in for it.
 *
 * NOT THE CONTROL. The server refuses the data on its own authority -
 * `mfa_required`, `mfa_enrollment_required`, `device_confirmation_required` -
 * and this only chooses which explanation to render instead of a dashboard
 * full of refusals.
 */
export type DashboardGate = "mfa" | "device" | "dashboard";

export function resolveDashboardGate(
  session: Pick<AuthSessionResponse, "mfa" | "device">
): DashboardGate {
  if (session.mfa && session.mfa.obligation !== "satisfied") return "mfa";
  if (session.device?.confirmationRequired) return "device";

  return "dashboard";
}
