"use client";

import { type KitchenEvent } from "@/features/kitchen/components/kitchen-shared";

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
        {hold ? "HOLD" : "KITCHEN"} · {event.title}
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

      <p className="mt-1 text-xs font-bold text-[#41556c]">{event.portions}</p>

      <p className="mt-1 text-xs font-bold text-[#41556c]">
        {event.packageName}
      </p>

      {event.status ? (
        <span className="mt-3 inline-flex bg-[#ff7624] px-3 py-1 text-[10px] font-black uppercase text-white">
          {event.status}
        </span>
      ) : null}
    </button>
  );
}
