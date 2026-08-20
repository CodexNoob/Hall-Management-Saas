"use client";

import { useEffect, useState } from "react";
import { LineIcon } from "@/features/events/components/event-manager-shared";
import {
  formatClock,
  kitchenViewInformation,
  type KitchenView
} from "@/features/kitchen/components/kitchen-shared";

/**
 * Where the board is pointed, and how far it is looking.
 *
 * One responsive tree rather than the two it used to draw - a phone copy and a
 * desktop copy, each with its own arrows, heading and tab strip. Every change to
 * the header had to be made twice, and the two had already drifted apart.
 */

const tabs: Array<{ label: string; value: KitchenView }> = [
  { label: "Day", value: "today" },
  { label: "Week", value: "week" },
  { label: "4 Weeks", value: "four-weeks" }
];

function NavButton({
  direction,
  label,
  onClick
}: {
  direction: "previous" | "next";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#b9c2cf] bg-white text-[#1f4d73] transition hover:border-[#1f4d73] hover:bg-[#eef4fa]"
      onClick={onClick}
      title={label}
      type="button"
    >
      <LineIcon
        className={`h-5 w-5 ${direction === "previous" ? "rotate-180" : ""}`}
        name="chevron"
      />
    </button>
  );
}

export function KitchenHeader({
  activeView,
  anchorDate,
  isOnToday,
  onChangeView,
  onNext,
  onPrevious,
  onToday,
  today
}: {
  activeView: KitchenView;
  anchorDate: Date;
  isOnToday: boolean;
  onChangeView: (view: KitchenView) => void;
  onNext: () => void;
  onPrevious: () => void;
  onToday: () => void;
  today: Date;
}) {
  const information = kitchenViewInformation(activeView, anchorDate, today);
  // Null until mounted: the clock is the one thing on this page whose value
  // differs between the server render and the first client render, and a
  // hydration mismatch on it would be reported against the whole header.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    // Every half minute rather than every second: the board prints hours and
    // minutes, so a per-second tick would re-render the header sixty times to
    // change nothing.
    const timer = setInterval(() => setNow(new Date()), 30_000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="border-b border-[#d8dde5] bg-white px-3 py-3 sm:px-5">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <NavButton
            direction="previous"
            label="Show previous dates"
            onClick={onPrevious}
          />
          <NavButton
            direction="next"
            label="Show next dates"
            onClick={onNext}
          />

          <div className="min-w-0 flex-1 px-1">
            <h1
              className="truncate text-base font-black text-[#17202a] sm:text-lg 2xl:text-xl"
              title={information.heading}
            >
              {information.heading}
            </h1>
            {information.rangeLabel ? (
              <p className="mt-0.5 truncate text-xs font-bold text-[#6a7483]">
                {information.rangeLabel}
              </p>
            ) : null}
          </div>

          {/* Hidden rather than disabled when the board is already on today:
              a control that does nothing is still a control to read past. */}
          {isOnToday ? null : (
            <button
              className="h-10 shrink-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#1f4d73] transition hover:border-[#1f4d73] hover:bg-[#eef4fa]"
              onClick={onToday}
              type="button"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3 xl:justify-end">
          <p className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d8dde5] bg-[#fbfcfd] px-2.5 py-1.5 text-xs font-black tabular-nums text-[#516071]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[#178151]"
            />
            <span className="sr-only">Current time</span>
            {now ? formatClock(now) : "--:--"}
          </p>

          <nav
            aria-label="Kitchen board range"
            className="grid shrink-0 grid-cols-3 gap-1 rounded-xl border border-[#b9c2cf] bg-[#fbfcfd] p-1"
          >
            {tabs.map((tab) => {
              const active = activeView === tab.value;

              return (
                <button
                  aria-current={active ? "page" : undefined}
                  className={`h-9 min-w-0 whitespace-nowrap rounded-lg px-3 text-xs font-black transition sm:min-w-20 sm:text-sm ${
                    active
                      ? "bg-[#1f4d73] text-white shadow-sm"
                      : "text-[#516071] hover:bg-[#eef4fa] hover:text-[#17202a]"
                  }`}
                  key={tab.value}
                  onClick={() => onChangeView(tab.value)}
                  type="button"
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
