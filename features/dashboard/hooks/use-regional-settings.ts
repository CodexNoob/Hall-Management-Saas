"use client";

import { useMemo } from "react";

import { useAuthSession } from "@/features/dashboard/hooks/use-dashboard-permission";
import * as format from "@/lib/dates/format";
import {
  DEFAULT_REGIONAL_SETTINGS,
  type RegionalSettings
} from "@/lib/dates/regional-settings";

/**
 * HOW THIS ORGANIZATION WRITES A DATE AND A TIME, on the client.
 *
 * ONE SOURCE, AND IT IS THE SESSION. Not a second fetch, not a provider of its
 * own, not a context somebody has to remember to wrap a tree in. The settings
 * arrive on `POST /api/auth/session` - which every authenticated user receives,
 * which resolves them server-side from the authenticated organization, and
 * which already lands in a reactive store - so a component that wants a date
 * formatted asks this hook and nothing fetches anything.
 *
 * That reuse is what buys the hard requirements for free:
 *
 *   * Saving Settings updates mounted screens immediately, because the save
 *     refetches the session and the store notifies its subscribers.
 *   * A page refresh loads the persisted settings, because the session is
 *     fetched on every cold load.
 *   * Another open session gets the change, because `organization_settings` is
 *     published and mapped to a session refresh.
 *   * Signing out or switching organization cannot leave stale settings behind,
 *     because `clearCachedAuthSession` empties the same store.
 *
 * `/api/settings` would have been the obvious source and is the wrong one: it
 * needs `settings.read`, which kitchen staff do not hold, so dates would have
 * formatted correctly for managers and fallen back to defaults for cooks on the
 * very same screen.
 */
export function useRegionalSettings(): RegionalSettings {
  const session = useAuthSession();

  return session?.regional ?? DEFAULT_REGIONAL_SETTINGS;
}

/**
 * The formatters, already bound to this organization's settings.
 *
 * Bound rather than passed, because the alternative - every call site reaching
 * for the settings and remembering to hand them over - is how the previous
 * arrangement drifted: a formatter that WORKS without settings will be called
 * without them, and it will silently produce American dates.
 *
 * The category names are kept, deliberately. There is no `formatDate` here and
 * there must not be one: `formatDateOnly` and `formatOrganizationDate` differ
 * only in which timezone they read in, and choosing wrong moves an event to the
 * previous day. A caller has to say which kind of value it holds.
 */
export function useDateFormatters() {
  const settings = useRegionalSettings();

  return useMemo(
    () => ({
      settings,
      /** A real instant, in the venue's timezone. Audit rows, payments, logins. */
      date: (value: format.DateLike) =>
        format.formatOrganizationDate(value, settings),
      time: (value: format.DateLike) =>
        format.formatOrganizationTime(value, settings),
      dateTime: (value: format.DateLike) =>
        format.formatOrganizationDateTime(value, settings),
      /** A calendar date, never moved. Event dates, due dates, blocked days. */
      dateOnly: (value: format.DateLike) =>
        format.formatDateOnly(value, settings),
      weekday: (value: format.DateLike, style?: "long" | "short") =>
        format.formatDateOnlyWeekday(value, settings, style),
      /** A time somebody typed, never shifted. `startsAt`, serve times. */
      eventTime: (value: format.DateLike) =>
        format.formatEventWallClockTime(value, settings),
      eventDateTime: (value: format.DateLike) =>
        format.formatEventWallClockDateTime(value, settings),
      monthYear: (value: format.DateLike) =>
        format.formatMonthYear(value, settings)
    }),
    [settings]
  );
}
