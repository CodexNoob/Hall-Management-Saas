import type { EventKitchenSheet } from "@/features/events/components/event-manager-shared";
import { SERVICE_STYLES } from "@/features/menu/lib/service-style";
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
  workers: Array<{ id: string; name: string; isStaff: boolean }>;
  /** Menus a kitchen event can be raised against. */
  menus: Array<{ id: string; name: string; dishCount: number }>;
  permissions: {
    canAssignWorkers: boolean;
    canUpdateKitchenStatus: boolean;
    canAddKitchenEvents: boolean;
  };
};

/**
 * Which way a replacement dish will be served.
 *
 * A swap should not quietly change how the food reaches the table, so the line
 * keeps the style it already had whenever the dish going on has a rule for it.
 * Failing that, a dish served exactly one way needs no decision - and a dish
 * served both ways with no style to inherit is left unanswered rather than
 * guessed, because the guess would decide the quantity the kitchen cooks.
 *
 * Shared with the server so the style the drawer promises is the one the swap
 * actually writes.
 */
export function resolveReplacementStyle(
  currentStyle: string | null,
  replacementStyles: string[]
) {
  // Walked from the known styles rather than the incoming list, which both
  // deduplicates it and drops anything that is not a style this product serves.
  const styles = SERVICE_STYLES.filter((style) =>
    replacementStyles.includes(style)
  );

  if (styles.some((style) => style === currentStyle)) return currentStyle;

  return styles.length === 1 ? styles[0] : null;
}

export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Shabbos"];

/**
 * How a day is tinted across the three views.
 *
 * In one place so a Shabbos reads the same in the week columns as it does in
 * the four-week grid. The two used to pick their own purples - `#a25bff` in one
 * and `#8b37f5` in the other - neither of which appears anywhere else in the
 * product; this is the indigo the calendar already marks school dates with.
 */
export function kitchenDayTone(day: KitchenDay) {
  if (day.today || day.selected) {
    return {
      outline: "ring-2 ring-inset ring-[#1f4d73]",
      header: "border-[#cddff0] bg-[#eef4fa]",
      title: "text-[#1f4d73]",
      date: "text-[#3d6d93]"
    };
  }

  if (day.shabbos) {
    return {
      outline: "",
      header: "border-[#d8d5f6] bg-[#f4f3fe]",
      title: "text-[#5649dd]",
      date: "text-[#6f68c9]"
    };
  }

  return {
    outline: "",
    header: "border-[#d8dde5] bg-[#fbfcfd]",
    title: "text-[#17202a]",
    date: "text-[#6a7483]"
  };
}

/** "No events", "1 event", "4 events" - said the way a person would. */
export function eventCountLabel(events: KitchenEvent[] | undefined) {
  const count = events?.length ?? 0;

  return count === 1 ? "1 event" : `${count} events`;
}

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

/**
 * The same ratio as a fraction of one, for the bar drawn under it.
 *
 * Null wherever `formatProgress` has no number to print, so a card can never end
 * up with an empty bar sitting beside the words "No dishes" - which reads as
 * work nobody has started rather than work that does not exist.
 */
export function progressFraction(summary: EventKitchenSheet["summary"] | null) {
  if (!summary || summary.dishes === 0) return null;

  return summary.complete / summary.dishes;
}

/**
 * The wall clock, as the board's header prints it.
 *
 * Kept apart from the range heading because the two change on completely
 * different schedules: the heading only when someone navigates, the clock every
 * minute on its own. Formatting them together is what left the board showing the
 * time it was first rendered for as long as the tab stayed open.
 */
export function formatClock(now: Date) {
  return timeFormat.format(now);
}

const relativeDayNames = new Map([
  [-1, "Yesterday"],
  [0, "Today"],
  [1, "Tomorrow"]
]);

/**
 * What the header says it is showing.
 *
 * `heading` is the one line a cook reads to know where the board is pointed;
 * `rangeLabel` is the supporting detail underneath. They used to be joined with
 * a middle dot into a single string that had to be truncated on a phone, which
 * cut the dates off the end - the half that says which four weeks these are.
 */
export function kitchenViewInformation(
  activeView: KitchenView,
  anchorDate: Date,
  today: Date
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

  if (activeView === "today") {
    const dayOffset = Math.round(
      (anchorDate.getTime() - today.getTime()) / 86_400_000
    );

    return {
      heading: fullDate.format(anchorDate),
      rangeLabel: relativeDayNames.get(dayOffset) ?? null
    };
  }

  const rangeStart = startOfWeek(anchorDate);
  const rangeEnd = addDays(rangeStart, activeView === "week" ? 6 : 27);

  return {
    heading: activeView === "week" ? "This Week" : "4 Weeks",
    rangeLabel: `${shortDate.format(rangeStart)} – ${shortDate.format(rangeEnd)}, ${rangeEnd.getFullYear()}`
  };
}
