import type { EventKitchenSheet } from "@/features/events/components/event-manager-shared";
import { addDays, startOfWeek } from "@/lib/dates/calendar-date";

export type KitchenView = "today" | "week" | "four-weeks";

/**
 * One card on the board.
 *
 * The fields it used to carry - `portions` as a pre-formatted string, a package
 * name, and a flat list of menu item names - were what the board could build
 * from `Event.menuItemIds`, which is to say almost nothing. A kitchen needs to
 * know when the food is wanted and how much of the work is done; neither was on
 * here.
 *
 * `summary` is null for a kitchen event someone added by hand: it has no menu
 * document behind it, so there is no production to be part-way through.
 */
export type KitchenEvent = {
  id: string;
  category: string;
  title: string;
  status?: string;
  statusType?: "hold" | "kitchen";
  /// ISO, or null on an event nobody has given a start time.
  startsAt: string | null;
  /// Waiters excluded, worked out server-side by `totalGuests`. The board used
  /// to sum the head counts in the browser and silently leave waiters out of
  /// the arithmetic while implying they were in it.
  totalGuests: number;
  menuStatus: string;
  summary: EventKitchenSheet["summary"] | null;
};

export type KitchenDay = {
  dateKey: string;
  dayName: string;
  dateLabel: string;
  dayNumber: number;
  shabbos?: boolean;
  selected?: boolean;
  today?: boolean;
  events?: KitchenEvent[];
};

/**
 * The board's payload: one summary per confirmed event in the window.
 *
 * No `lines`. The dish list for one event is fetched by the details dialog from
 * `GET /api/events/[eventId]/kitchen`, which is the route that signs the
 * pictures - four weeks of dish lists is a large response for a view that draws
 * a ratio.
 */
export type KitchenResponse = {
  events: Array<{
    id: string;
    clientName: string;
    eventDate: string;
    eventType: string | null;
    eventStatus: string;
    startsAt: string | null;
    packageName: string | null;
    hall: { name: string };
    menuStatus: string;
    counts: EventKitchenSheet["counts"];
    summary: EventKitchenSheet["summary"];
  }>;
  workers: Array<{ id: string; name: string }>;
  permissions: {
    canAssignWorkers: boolean;
    canUpdateKitchenStatus: boolean;
    canAddKitchenEvents: boolean;
  };
};

export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Shabbos"];

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit"
});

/**
 * When the food is wanted.
 *
 * An em dash rather than "TBC" or a blank: a card with no time still has to
 * hold its column, and the absence is the answer - nobody has said yet.
 */
export function formatServeTime(startsAt: string | null) {
  if (!startsAt) return "—";

  const parsed = new Date(startsAt);

  return Number.isNaN(parsed.getTime()) ? "—" : timeFormat.format(parsed);
}

/**
 * How much of an event's cooking is done, as the card prints it.
 *
 * A menu with no dishes reads "No dishes" rather than "0/0 done", which looks
 * like a job nobody has started rather than one that does not exist yet.
 */
export function formatProgress(summary: EventKitchenSheet["summary"] | null) {
  if (!summary) return null;
  if (summary.dishes === 0) return "No dishes";

  return `${summary.complete}/${summary.dishes} done`;
}

export function kitchenViewInformation(
  activeView: KitchenView,
  anchorDate: Date
) {
  const fullDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  const shortDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  });
  const rangeStart =
    activeView === "today" ? anchorDate : startOfWeek(anchorDate);
  const rangeEnd = addDays(rangeStart, activeView === "week" ? 6 : 27);

  return {
    heading:
      activeView === "today"
        ? fullDate.format(anchorDate)
        : `${activeView === "week" ? "This Week" : "4 Weeks"} · ${shortDate.format(rangeStart)} – ${shortDate.format(rangeEnd)}`,
    time: `Current time: ${timeFormat.format(new Date())}`
  };
}
