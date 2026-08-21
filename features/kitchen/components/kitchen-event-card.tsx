"use client";

import { Badge } from "@/features/events/components/event-manager-shared";
import {
  formatMealsNotShown,
  formatProgress,
  formatServeTime,
  progressFraction,
  type KitchenEvent
} from "@/features/kitchen/components/kitchen-shared";

/**
 * One event, as the board draws it.
 *
 * The three things a kitchen asks of a list - when is it wanted, how much of it
 * is done, and is anything blocked - and nothing else. It used to print the
 * package name and a guest count, neither of which answers any of them.
 *
 * The ratio now has a bar under it. "2/3 done" has to be read and divided; a
 * bar is answered by a glance across a column of cards, which is how this
 * screen is actually used - on a wall, from across the room.
 */
export function KitchenEventCard({
  compact = false,
  event,
  onSelect
}: {
  compact?: boolean;
  event: KitchenEvent;
  onSelect: (event: KitchenEvent) => void;
}) {
  const hold = event.statusType === "hold";
  const serveTime = formatServeTime(event.startsAt);
  const progress = formatProgress(event.summary);
  const fraction = progressFraction(event.summary);
  const needsAttention = event.summary?.needsAttention ?? 0;
  // Everything above this line describes one meal. This says how many more
  // there are, because the ratio and the bar are otherwise read as the whole
  // job when they are a fraction of it.
  const mealsNotShown = formatMealsNotShown(event.otherMeals);

  if (compact) {
    return (
      <button
        className={`flex w-full min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4d73] ${
          hold
            ? "border-[#e5c894] bg-[#fffaf1] text-[#8a6414] hover:border-[#b66b00]"
            : "border-[#c9d2de] bg-white text-[#17202a] hover:border-[#1f4d73] hover:bg-[#eef4fa]"
        }`}
        onClick={() => onSelect(event)}
        title={`${serveTime} · ${event.title}${progress ? ` · ${progress}` : ""}${mealsNotShown ? ` · ${mealsNotShown}` : ""}`}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            hold ? "bg-[#b66b00]" : fraction === 1 ? "bg-[#178151]" : "bg-[#1f4d73]"
          }`}
        />
        <span
          className={`shrink-0 ${event.startsAt ? "tabular-nums text-[#516071]" : "font-bold text-[#94a1b1]"}`}
        >
          {event.startsAt ? serveTime : "No time"}
        </span>
        <span className="min-w-0 flex-1 truncate">{event.title}</span>
      </button>
    );
  }

  return (
    <button
      className={`block w-full rounded-xl border p-3 text-left transition hover:border-[#1f4d73] hover:bg-[#f8fbfd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4d73] ${
        hold ? "border-[#e5c894] bg-[#fffaf1]" : "border-[#d8dde5] bg-white"
      }`}
      onClick={() => onSelect(event)}
      type="button"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
            {event.category}
          </p>
          {/* Wrapped rather than truncated: in the week view a card is a
              seventh of the screen wide, and "Gold We..." beside "Weiss B..."
              is a column nobody can read. */}
          <h3 className="mt-0.5 line-clamp-2 text-sm font-black text-[#17202a]">
            {event.title}
          </h3>
        </div>

        {/* The serve time is the one number this card is scanned for, so it is
            the one thing set apart from the prose rather than a term in a list
            of four look-alike terms. */}
        {event.startsAt ? (
          <span className="inline-flex shrink-0 items-center rounded-lg bg-[#eef4fa] px-2 py-1 text-xs font-black tabular-nums text-[#1f4d73]">
            <span className="sr-only">Serves at </span>
            {serveTime}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center rounded-lg bg-[#f1f4f8] px-2 py-1 text-xs font-black text-[#6a7483]">
            No time
          </span>
        )}
      </div>

      {progress ? (
        <div className="mt-2.5">
          <div className="flex items-baseline justify-between gap-2 text-[11px] font-black">
            <span className="text-[#6a7483]">{progress}</span>
            {fraction !== null ? (
              <span className="tabular-nums text-[#516071]">
                {Math.round(fraction * 100)}%
              </span>
            ) : null}
          </div>

          {fraction !== null ? (
            <div
              aria-hidden="true"
              className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#e9eef4]"
            >
              <div
                className={`h-full rounded-full transition-[width] ${
                  fraction === 1 ? "bg-[#178151]" : "bg-[#1f4d73]"
                }`}
                style={{ width: `${Math.round(fraction * 100)}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {event.status ? (
          <Badge tone={hold ? "gold" : "green"}>{event.status}</Badge>
        ) : null}

        {/* The one thing on this card that is a call to action rather than a
            fact: a dish with no quantity is not a slow dish, it is a dish
            nobody can start. */}
        {needsAttention > 0 ? (
          <Badge tone="red">
            {needsAttention} need{needsAttention === 1 ? "s" : ""} a quantity
          </Badge>
        ) : null}

        {/* The other reason this card can be complete and wrong at the same
            time: the board draws one meal, and a Shabbos event is three or
            four. Red rather than gold - like the quantity badge above, this is
            food that will not get cooked unless somebody acts. */}
        {mealsNotShown ? <Badge tone="red">{mealsNotShown}</Badge> : null}

        <span className="ml-auto text-[11px] font-black tabular-nums text-[#6a7483]">
          {event.totalGuests} portions
        </span>
      </div>
    </button>
  );
}
