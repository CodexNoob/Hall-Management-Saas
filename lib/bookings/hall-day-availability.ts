/**
 * Whether one hall can take another event on one day.
 *
 * The Calendar's Availability tab answers a wider question - it reads the whole
 * venue, so a day is "hold" there when any hall has a tentative booking on it.
 * Moving an existing event is narrower: only the hall the event sits in can
 * refuse it, so this reads one hall's own daily limit against one hall's own
 * bookings.
 *
 * Both sides of the move run this. The event-details date picker offers only
 * the days it calls "available", and PATCH /api/events/[eventId] re-checks with
 * the same rule before writing, so a tab left open while a day fills up cannot
 * save a date the picker would have refused.
 */
export type HallDayStatus = "available" | "blocked" | "hold" | "full";

export type HallDayInput = {
  /** Covered by a holiday or a manually blocked range. */
  isBlocked: boolean;
  /** Tentative holds already on this day in this hall. */
  holdCount: number;
  /** Holds and confirmed bookings together - what the daily limit counts. */
  activeCount: number;
  dailyEventLimit: number;
};

/**
 * A hold refuses the day ahead of the limit check, and refuses it even with
 * slots to spare. A held date is one somebody is already negotiating for, and
 * the whole point of asking before moving an event is to not land on top of
 * that conversation.
 */
export function hallDayStatus({
  isBlocked,
  holdCount,
  activeCount,
  dailyEventLimit
}: HallDayInput): HallDayStatus {
  if (isBlocked) return "blocked";
  if (holdCount > 0) return "hold";
  if (activeCount >= dailyEventLimit) return "full";

  return "available";
}

export function isHallDayOpen(input: HallDayInput) {
  return hallDayStatus(input) === "available";
}

/**
 * Why a day was refused, in the words the save feedback and the picker both
 * use. Null for a day that was not refused at all.
 */
export function hallDayRefusal(
  status: HallDayStatus,
  { hallName, dateLabel }: { hallName: string; dateLabel: string }
) {
  switch (status) {
    case "blocked":
      return `${dateLabel} is a blocked date.`;
    case "hold":
      return `${dateLabel} already has an event on hold in ${hallName}. Release or confirm that hold before moving an event onto this date.`;
    case "full":
      return `${hallName} has no event slots left on ${dateLabel}.`;
    default:
      return null;
  }
}

/**
 * The organization-wide fallback limit, read out of the settings document.
 *
 * Written by /api/settings into `integrations.calendar.dailyEventLimit`, and
 * used for any hall that has not been given a limit of its own. Anything
 * missing or malformed reads as the shipped default of 2, the same as an
 * organization that has never opened Settings.
 */
export function dailyEventLimitFromIntegrations(integrations: unknown) {
  if (
    integrations &&
    typeof integrations === "object" &&
    "calendar" in integrations
  ) {
    const calendar = (integrations as { calendar?: unknown }).calendar;

    if (calendar && typeof calendar === "object") {
      const value = (calendar as { dailyEventLimit?: unknown }).dailyEventLimit;

      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
  }

  return 2;
}
