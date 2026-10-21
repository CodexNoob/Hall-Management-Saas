"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthSession } from "@/features/dashboard/hooks/use-dashboard-permission";
import {
  INACTIVITY_WARNING_SECONDS,
  millisecondsUntilInactivityTimeout
} from "@/lib/auth/inactivity";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

/**
 * THE BROWSER'S HALF OF "SIGN OUT AFTER INACTIVITY".
 *
 * Two jobs, and neither is the control:
 *
 *   1. Tell the server somebody is here. Throttled hard, because the server's
 *      whole notion of activity comes from this and nothing else - there is no
 *      passive signal that means "a person is present" rather than "a tab is
 *      open" (see the comment on `POST /api/me/activity`).
 *
 *   2. Warn before the deadline, and give a way back. This is the difference
 *      between a security feature and one staff learn to hate: a busy person
 *      glancing at the screen taps once and keeps working, while an unattended
 *      screen counts down and goes.
 *
 * `resolveUserActor` refuses an idle session regardless of what happens here.
 * A browser that never runs this, or whose timer is wrong, gets a 401 from the
 * next request it makes.
 */

/**
 * The shortest gap between two activity pings.
 *
 * Somebody typing produces a keypress every few hundred milliseconds, and an
 * unthrottled ping would be a request per keystroke. Five minutes is coarse
 * enough to cost nothing and fine enough that the server's view of "last
 * active" is never more than five minutes behind the truth - which matters
 * only against timeouts measured in hours, and the shortest we offer is one.
 */
const PING_THROTTLE_MS = 5 * 60_000;

/** What counts as a person being here. Passive events are deliberately absent. */
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "scroll",
  "touchstart"
] as const;

export type InactivityStatus = {
  /** Seconds left before sign-out, or null when nothing is counting down. */
  secondsRemaining: number | null;
  /** True once inside the warning window. */
  isWarning: boolean;
  /** Resets the clock and tells the server. For the "Stay signed in" button. */
  staySignedIn: () => void;
};

export function useInactivityTimeout(options: {
  /** Ran when the deadline passes. Signing out is the caller's business. */
  onExpired: () => void;
}): InactivityStatus {
  const { onExpired } = options;
  const session = useAuthSession();
  const timeoutMinutes = session?.inactivity?.timeoutMinutes ?? 0;
  const sharedDevice = session?.inactivity?.sharedDevice ?? false;

  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  /**
   * Local, and NOT read from the session.
   *
   * The session's `lastActiveAt` is up to five minutes stale by design - that
   * is the throttle working. Counting down from it would show a warning while
   * somebody was still typing. The browser knows exactly when it last saw an
   * event, so it counts from that and the server checks the coarser copy.
   */
  const lastActiveAt = useRef<number>(Date.now());
  const lastPingAt = useRef<number>(0);
  // Held in a ref so the event listeners below are installed once rather than
  // re-bound every time the callback identity changes.
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  const ping = useCallback(() => {
    const now = Date.now();

    if (now - lastPingAt.current < PING_THROTTLE_MS) return;

    lastPingAt.current = now;
    // Failure is swallowed: this runs behind whatever the person is doing, and
    // a missed ping costs at most one throttle window of accuracy. The refusal
    // that matters is the API's on the next real request.
    void authenticatedFetch("/api/me/activity", { method: "POST" }).catch(
      () => undefined
    );
  }, []);

  const staySignedIn = useCallback(() => {
    lastActiveAt.current = Date.now();
    // Forced past the throttle: the person has just told us they are here, and
    // this is exactly the moment the server needs to hear it.
    lastPingAt.current = 0;
    ping();
    setSecondsRemaining(null);
  }, [ping]);

  // Record interaction. Installed once, and only while a timeout applies -
  // a venue with this turned off, or a kitchen board, listens to nothing.
  useEffect(() => {
    if (!timeoutMinutes || sharedDevice) return;

    const onActivity = () => {
      lastActiveAt.current = Date.now();
      ping();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [ping, sharedDevice, timeoutMinutes]);

  // Count down. One interval rather than one per event, so a burst of typing
  // costs nothing beyond updating a ref.
  useEffect(() => {
    if (!timeoutMinutes || sharedDevice) {
      setSecondsRemaining(null);
      return;
    }

    const tick = () => {
      const remaining = millisecondsUntilInactivityTimeout({
        timeoutMinutes,
        lastActiveAt: new Date(lastActiveAt.current),
        sharedDevice,
        now: new Date()
      });

      if (remaining === null) {
        setSecondsRemaining(null);
        return;
      }

      if (remaining <= 0) {
        setSecondsRemaining(0);
        onExpiredRef.current();
        return;
      }

      const seconds = Math.ceil(remaining / 1000);

      // Only inside the warning window. Setting state every second for eight
      // hours would re-render the whole dashboard 28,800 times to display
      // nothing.
      setSecondsRemaining(seconds <= INACTIVITY_WARNING_SECONDS ? seconds : null);
    };

    tick();
    const timer = setInterval(tick, 1_000);

    return () => clearInterval(timer);
  }, [sharedDevice, timeoutMinutes]);

  return {
    secondsRemaining,
    isWarning: secondsRemaining !== null && secondsRemaining > 0,
    staySignedIn
  };
}
