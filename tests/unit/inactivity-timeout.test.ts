import { describe, expect, it } from "vitest";

import {
  DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
  INACTIVITY_TIMEOUT_CHOICES,
  INACTIVITY_TIMEOUT_DISABLED,
  isSessionExpiredByInactivity,
  millisecondsUntilInactivityTimeout,
  readInactivityTimeout
} from "@/lib/auth/inactivity";

/**
 * THE DECISION THAT CAN LOCK A VENUE OUT OF ITS OWN SYSTEM.
 *
 * Most of these tests are about the cases where the answer is "leave them
 * alone". That weighting is the design: wrongly keeping a session alive means
 * an unattended screen stays open a little longer, and wrongly ending one means
 * a kitchen mid-service staring at a login form. The failures are not
 * comparable and the tests should not treat them as if they were.
 */

const now = new Date("2026-09-26T12:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);

const expired = (input: Partial<Parameters<typeof isSessionExpiredByInactivity>[0]>) =>
  isSessionExpiredByInactivity({
    timeoutMinutes: 60,
    lastActiveAt: minutesAgo(10),
    now,
    ...input
  });

describe("when a session has gone idle", () => {
  it("expires once the limit has passed", () => {
    expect(expired({ timeoutMinutes: 60, lastActiveAt: minutesAgo(61) })).toBe(
      true
    );
  });

  it("leaves a session alone right up to the limit", () => {
    expect(expired({ timeoutMinutes: 60, lastActiveAt: minutesAgo(59) })).toBe(
      false
    );
    // Exactly on the boundary is not yet past it.
    expect(expired({ timeoutMinutes: 60, lastActiveAt: now })).toBe(false);
  });

  it("uses the organization's own number", () => {
    const lastActiveAt = minutesAgo(90);

    expect(expired({ timeoutMinutes: 60, lastActiveAt })).toBe(true);
    expect(expired({ timeoutMinutes: 120, lastActiveAt })).toBe(false);
  });
});

/**
 * EVERY WAY THIS FAILS OPEN. Each of these is a deliberate `return false`, not
 * an oversight, and each one has a venue behind it.
 */
describe("when it cannot answer confidently", () => {
  it("does nothing when the venue turned it off", () => {
    expect(
      expired({
        timeoutMinutes: INACTIVITY_TIMEOUT_DISABLED,
        lastActiveAt: minutesAgo(10_000)
      })
    ).toBe(false);
  });

  it("does nothing when no timeout is configured at all", () => {
    for (const timeoutMinutes of [null, undefined]) {
      expect(
        expired({ timeoutMinutes, lastActiveAt: minutesAgo(10_000) }),
        String(timeoutMinutes)
      ).toBe(false);
    }
  });

  /**
   * The case that would have signed out every open session in every
   * organization the moment this deployed. Sessions recorded before the column
   * existed have no activity history, and "cannot tell" has to mean "leave
   * them alone".
   */
  it("does nothing for a session with no recorded activity", () => {
    for (const lastActiveAt of [null, undefined, "", "not a date"]) {
      expect(
        expired({ timeoutMinutes: 60, lastActiveAt }),
        String(lastActiveAt)
      ).toBe(false);
    }
  });

  it("does nothing when the recorded activity is in the future", () => {
    // Clock skew between the database and this process, not an idle session.
    expect(
      expired({ timeoutMinutes: 60, lastActiveAt: minutesAgo(-30) })
    ).toBe(false);
  });

  it("does nothing for a broken timeout value", () => {
    for (const timeoutMinutes of [Number.NaN, Number.POSITIVE_INFINITY, -60]) {
      expect(
        expired({ timeoutMinutes, lastActiveAt: minutesAgo(10_000) }),
        String(timeoutMinutes)
      ).toBe(false);
    }
  });

  /**
   * The kitchen board on the wall. Nobody touches it for three hours at a
   * stretch and that is it working, not it being abandoned.
   */
  it("never expires a shared display", () => {
    expect(
      expired({
        timeoutMinutes: 60,
        lastActiveAt: minutesAgo(10_000),
        sharedDevice: true
      })
    ).toBe(false);
  });
});

describe("the countdown the browser draws", () => {
  it("reports the time left", () => {
    expect(
      millisecondsUntilInactivityTimeout({
        timeoutMinutes: 60,
        lastActiveAt: minutesAgo(59),
        now
      })
    ).toBe(60_000);
  });

  it("reports zero rather than a negative once past", () => {
    expect(
      millisecondsUntilInactivityTimeout({
        timeoutMinutes: 60,
        lastActiveAt: minutesAgo(90),
        now
      })
    ).toBe(0);
  });

  /**
   * The two functions have to agree about whether a timeout applies AT ALL.
   * A countdown for a case the server will never act on is a dialog counting
   * down to something that is not going to happen.
   */
  it("returns null in exactly the cases the check ignores", () => {
    for (const input of [
      { timeoutMinutes: 0, lastActiveAt: minutesAgo(10_000) },
      { timeoutMinutes: null, lastActiveAt: minutesAgo(10_000) },
      { timeoutMinutes: 60, lastActiveAt: null },
      { timeoutMinutes: 60, lastActiveAt: minutesAgo(10_000), sharedDevice: true }
    ]) {
      expect(
        millisecondsUntilInactivityTimeout({ ...input, now }),
        JSON.stringify(input)
      ).toBeNull();

      expect(
        isSessionExpiredByInactivity({ ...input, now }),
        JSON.stringify(input)
      ).toBe(false);
    }
  });
});

describe("reading the stored setting", () => {
  it("keeps a value this build offers", () => {
    for (const choice of INACTIVITY_TIMEOUT_CHOICES) {
      expect(readInactivityTimeout(choice)).toBe(choice);
    }
  });

  it("keeps Never, which is a choice rather than a missing value", () => {
    expect(readInactivityTimeout(INACTIVITY_TIMEOUT_DISABLED)).toBe(
      INACTIVITY_TIMEOUT_DISABLED
    );
  });

  it("keeps a custom value a venue set through the API", () => {
    // The dropdown offers five numbers; the column takes any positive integer,
    // and silently rounding somebody's 45 to 60 would be worse than honouring
    // what they asked for.
    expect(readInactivityTimeout(45)).toBe(45);
  });

  it("falls back to the documented default for anything unusable", () => {
    for (const value of [null, undefined, "480", -5, Number.NaN, {}]) {
      expect(readInactivityTimeout(value), String(value)).toBe(
        DEFAULT_INACTIVITY_TIMEOUT_MINUTES
      );
    }
  });

  it("defaults to a shift rather than to a banking session", () => {
    // Thirty minutes in a venue means signing in after every walk-through of
    // the hall. Nobody has been living with the old default because it was
    // never enforced, so there is no expectation to preserve.
    expect(DEFAULT_INACTIVITY_TIMEOUT_MINUTES).toBe(480);
  });
});
