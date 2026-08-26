"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LineIcon } from "@/features/events/components/event-manager-shared";
import {
  formatClock,
  kitchenViewInformation,
  type KitchenView
} from "@/features/kitchen/components/kitchen-shared";

const tabs: Array<{ label: string; value: KitchenView }> = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
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
      className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#e4e4e4] bg-white text-[#061126] transition hover:bg-[#f7f7f7] sm:h-11 sm:w-11"
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
  onTodayNotes,
  notificationCount,
  today
}: {
  activeView: KitchenView;
  anchorDate: Date;
  isOnToday: boolean;
  onChangeView: (view: KitchenView) => void;
  onNext: () => void;
  onPrevious: () => void;
  onToday: () => void;
  onTodayNotes: () => void;
  notificationCount: number;
  today: Date;
}) {
  const information = kitchenViewInformation(activeView, anchorDate, today);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="border-b border-[#8f8f8f] bg-[#a8a8a6] px-3 py-3 text-[#061126] sm:px-4">
      {/*
        * The single-row layout waits for `xl`, not `lg`.
        *
        * It needs the date block's 600px minimum plus the clock and three 120px
        * range tabs - about 1090px. At `lg` on a 1024px iPad the sidebar has
        * already taken ~140px, leaving ~884px, so the date block overflowed its
        * track and the clock was printed straight over the date while the next
        * arrow fell off the row entirely. Two rows until there is genuinely room
        * for one.
        */}
      <div className="grid w-full min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center xl:min-w-150">
          {/*
            * Two different ways of staying clear of the navigation toggle.
            *
            * The dashboard shell parks a fixed strip in the top-left corner for
            * that toggle (`.dashboard-topbar-brand`, 4.5rem wide under 1024px -
            * see globals.css). It floats above this header, so a row starting at
            * the left edge had the burger lines drawn straight over the "Main
            * Menu" label, and a tap there was a coin toss between the two.
            *
            * On a phone the row is this cluster and nothing else, so it moves to
            * the right instead: the toggle keeps the corner, and the space that
            * was empty on the right is used. From `sm` the row is shared with the
            * date navigation, which needs the width more, so the cluster goes
            * back to the left and takes `pl-13` of clearance instead. Only this
            * row runs under the toggle - the date and tabs below already clear
            * its height, which is why the padding is here and not on the header;
            * there it squeezed the range tabs until "This Week" truncated. At
            * `lg` the toggle is gone and neither is needed.
            */}
          <div className="flex min-w-0 items-center justify-end gap-2 sm:justify-start sm:pl-13 lg:pl-0">
            <Link
              className="inline-flex h-10 min-w-0 shrink items-center justify-center border border-[#e4e4e4] bg-white px-3 text-sm font-black text-[#061126] transition hover:bg-[#f7f7f7] sm:h-11 sm:shrink-0 sm:px-4"
              href="/dashboard/menu"
            >
              <span className="ml-1 truncate">Main Menu</span>
            </Link>

            <button
              aria-label="Open kitchen notifications"
              className="relative flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#ff5a36] bg-white text-[#061126] transition hover:bg-[#fff5f2] sm:h-11 sm:w-11"
              onClick={onTodayNotes}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {notificationCount > 0 ? (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center bg-[#ff3b30] px-1 text-[10px] font-black leading-none text-white">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* Between `sm` and `lg` the row is wide enough that a `1fr` middle
              track threw the two arrows to opposite ends of it, leaving the
              previous arrow stranded beside the notification bell with the date
              floating in the gap. Sizing the middle to its content and centring
              the group keeps the arrows either side of the date they move. The
              phone keeps `1fr` - there the row is narrow and the date fills it -
              and so does `lg`, where the group has its own fixed column. */}
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[auto_minmax(0,auto)_auto] sm:justify-center xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:justify-normal">
            <NavButton
              direction="previous"
              label="Show previous dates"
              onClick={onPrevious}
            />

            <div className="min-w-0 px-1 text-center">
              {/* Two spans rather than one truncated string: `hidden` is
                  display:none, so exactly one of them is in the accessibility
                  tree at any width and a screen reader never hears the date
                  twice. `title` stays the unabbreviated form. */}
              <h1
                className="truncate text-lg font-black text-[#061126] sm:text-2xl"
                title={information.heading}
              >
                <span className="sm:hidden">{information.compactHeading}</span>
                <span className="hidden sm:inline">{information.heading}</span>
              </h1>
              {information.rangeLabel ? (
                <p className="mt-0.5 truncate text-center text-xs font-bold text-[#6a7483]">
                  {information.rangeLabel}
                </p>
              ) : null}
            </div>

            <NavButton
              direction="next"
              label="Show next dates"
              onClick={onNext}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center xl:grid-cols-[auto_auto] xl:justify-end">
          <p className="inline-flex h-10 shrink-0 items-center justify-center text-2xl font-black tabular-nums text-[#ffcc55] sm:h-11 sm:px-4 sm:text-3xl">
            <span className="sr-only">Current time</span>
            {now ? formatClock(now) : "--:--"}
          </p>

          <nav
            aria-label="Kitchen board range"
            className="grid min-w-0 grid-cols-3 gap-1"
          >
            {tabs.map((tab) => {
              const active = activeView === tab.value;

              return (
                <button
                  aria-current={active ? "page" : undefined}
                  className={`h-10 min-w-0 truncate border border-[#e4e4e4] px-2 text-sm font-black transition sm:h-11 sm:min-w-30 sm:px-3 sm:text-base ${
                    active
                      ? "bg-[#ffcc55] text-[#061126]"
                      : "bg-white text-[#061126] hover:bg-[#f7f7f7]"
                  }`}
                  key={tab.value}
                  onClick={() => {
                    onChangeView(tab.value);
                    if (tab.value === "today" && !isOnToday) onToday();
                  }}
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
