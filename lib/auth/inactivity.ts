/**
 * SIGN OUT AFTER INACTIVITY.
 *
 * One pure function, and it is pure on purpose: this is the decision that can
 * lock an entire organization out of its own system, so it takes every input
 * explicitly, reads no clock of its own and touches no database. Everything
 * that could go wrong with it can be written as a test.
 *
 * DEFAULTS ARE FAIL-OPEN, EVERY ONE OF THEM. A missing timeout, an unreadable
 * one, a session with no recorded activity, a clock that disagrees - all of
 * them mean "leave this person alone". That asymmetry is deliberate. The cost
 * of wrongly keeping a session alive is that an unattended screen stays open a
 * while longer; the cost of wrongly ending one is a venue mid-service unable to
 * reach its own kitchen board. Those are not comparable, and the code should
 * not pretend they are.
 *
 * Kept free of `server-only` so the browser can run the identical rule for its
 * countdown. The browser's copy is the courtesy; the server's is the control.
 */

/**
 * The choices offered in Settings, in minutes.
 *
 * A SHIFT, NOT A BANKING SESSION. Thirty minutes is the number a bank picks,
 * and in a venue it means signing in again after every walk-through of the
 * hall. The unit that means something here is a shift, so the range starts at
 * an hour and the default is eight.
 */
export const INACTIVITY_TIMEOUT_CHOICES = [60, 120, 240, 480, 720] as const;

/**
 * Eight hours.
 *
 * Chosen over the old thirty-minute default because thirty minutes was never
 * enforced - nobody has been living with it, so there is no expectation to
 * preserve, and shipping enforcement at thirty minutes would be a behaviour
 * change disguised as a bug fix.
 */
export const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 480;

/**
 * Off. Stored as zero, offered as "Never".
 *
 * An explicit choice rather than a very large number: a venue that does not
 * want this should be able to SAY so, and "Never" in a dropdown is a decision
 * somebody made while twelve hours is a number somebody typed.
 */
export const INACTIVITY_TIMEOUT_DISABLED = 0;

/** How long before the deadline the browser starts warning. */
export const INACTIVITY_WARNING_SECONDS = 60;

export type InactivityInput = {
  /** The organization's setting, in minutes. Zero or absent means never. */
  timeoutMinutes: number | null | undefined;
  /** When a person last interacted. Null means nothing has been recorded. */
  lastActiveAt: Date | string | null | undefined;
  /** A wall-mounted screen, exempt by an explicit, audited decision. */
  sharedDevice?: boolean;
  /** Passed in rather than read, so the decision is testable. */
  now: Date;
};

/**
 * Has this session been idle past the organization's limit?
 *
 * Returns false for every case it cannot answer confidently. See the note on
 * fail-open above - each `return false` below is one of those cases, and none
 * of them is an oversight.
 */
export function isSessionExpiredByInactivity(input: InactivityInput): boolean {
  const { timeoutMinutes, sharedDevice, now } = input;

  // The venue turned it off, or never turned it on.
  if (!timeoutMinutes || timeoutMinutes <= INACTIVITY_TIMEOUT_DISABLED) {
    return false;
  }

  // A negative or absurd value is a broken row, not a policy.
  if (!Number.isFinite(timeoutMinutes)) return false;

  // The kitchen board. Unattended is what it is FOR.
  if (sharedDevice) return false;

  const lastActive = toDate(input.lastActiveAt);

  // No activity has ever been recorded for this session - every session that
  // predates the feature is in this state. "Cannot tell" means leave them
  // alone, or deploying this signs out every open session everywhere.
  if (!lastActive) return false;

  const idleMs = now.getTime() - lastActive.getTime();

  // A negative gap means the recorded activity is in the future: a clock skew
  // between the database and this process, not an idle session.
  if (idleMs < 0) return false;

  return idleMs > timeoutMinutes * 60_000;
}

/**
 * Milliseconds until this session would expire, or null when it never will.
 *
 * For the browser's countdown. Null covers the same cases the check above
 * answers false for, so the two cannot disagree about whether a timeout applies
 * at all - which is what would produce a warning dialog counting down to
 * something that is not going to happen.
 */
export function millisecondsUntilInactivityTimeout(
  input: InactivityInput
): number | null {
  const { timeoutMinutes, sharedDevice, now } = input;

  if (!timeoutMinutes || timeoutMinutes <= INACTIVITY_TIMEOUT_DISABLED) {
    return null;
  }

  if (!Number.isFinite(timeoutMinutes)) return null;
  if (sharedDevice) return null;

  const lastActive = toDate(input.lastActiveAt);

  if (!lastActive) return null;

  const remaining =
    lastActive.getTime() + timeoutMinutes * 60_000 - now.getTime();

  return remaining > 0 ? remaining : 0;
}

/** Narrow a stored timeout to one this build understands, or the default. */
export function readInactivityTimeout(value: unknown): number {
  if (value === INACTIVITY_TIMEOUT_DISABLED) return INACTIVITY_TIMEOUT_DISABLED;

  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
    ? value
    : DEFAULT_INACTIVITY_TIMEOUT_MINUTES;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
