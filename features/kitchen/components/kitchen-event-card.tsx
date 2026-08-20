"use client";

import {
  formatProgress,
  formatServeTime,
  type KitchenEvent
} from "@/features/kitchen/components/kitchen-shared";

/**
 * One event, as the board draws it.
 *
 * The three things a kitchen asks of a list - when is it wanted, how much of it
 * is done, and is anything blocked - and nothing else. It used to print the
 * package name and a guest count, neither of which answers any of them.
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
  const needsAttention = event.summary?.needsAttention ?? 0;

  if (compact) {
    return (
      <button
        className={`block w-full truncate border px-2 py-1 text-left text-xs font-black ${
          hold
            ? "border-[#f0a326] bg-[#fff5e4] text-[#914700]"
            : "border-[#16a267] bg-[#effcf5] text-[#006d3e]"
        }`}
        onClick={() => onSelect(event)}
        type="button"
      >
        {serveTime} · {event.title}
        {progress ? ` · ${progress}` : ""}
      </button>
    );
  }

  return (
    <button
      className={`block w-full border border-dashed p-3 text-left transition hover:border-[#1f4d73] hover:bg-[#eef6fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4d73] ${
        hold ? "border-[#f0a326] bg-[#fffaf1]" : "border-[#c8d6e3] bg-[#f8fafc]"
      }`}
      onClick={() => onSelect(event)}
      type="button"
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-[#34465b]">
        {event.category}
      </p>

      <h3 className="mt-1 text-sm font-black text-[#07162d]">{event.title}</h3>

      <dl className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs font-bold text-[#41556c]">
        <div className="flex items-baseline gap-1.5">
          <dt className="text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
            Serves
          </dt>
          <dd className="text-sm font-black text-[#07162d]">{serveTime}</dd>
        </div>

        {progress ? (
          <div className="flex items-baseline gap-1.5">
            <dt className="text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
              Prepared
            </dt>
            <dd>{progress}</dd>
          </div>
        ) : null}

        <div className="flex items-baseline gap-1.5">
          <dt className="text-[10px] font-black uppercase tracking-wide text-[#6a7483]">
            Portions
          </dt>
          <dd>{event.totalGuests}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {event.status ? (
          <span className="inline-flex bg-[#ff7624] px-3 py-1 text-[10px] font-black uppercase text-white">
            {event.status}
          </span>
        ) : null}

        {/* The one thing on this card that is a call to action rather than a
            fact: a dish with no quantity is not a slow dish, it is a dish
            nobody can start. */}
        {needsAttention > 0 ? (
          <span className="inline-flex border border-[#f0d9a8] bg-[#fdf8ec] px-3 py-1 text-[10px] font-black uppercase text-[#8a6414]">
            {needsAttention} need{needsAttention === 1 ? "s" : ""} a quantity
          </span>
        ) : null}
      </div>
    </button>
  );
}
