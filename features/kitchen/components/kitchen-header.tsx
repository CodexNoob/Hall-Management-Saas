"use client";

import { useEffect, useState } from "react";
import { requestDashboardSidebarOpenFromKitchen } from "@/components/layout/dashboard-sidebar-shared";
import { LineIcon } from "@/features/events/components/event-manager-shared";
import { useKitchenRegion } from "@/features/kitchen/components/kitchen-region-context";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import {
  formatClock,
  kitchenViewInformation,
  type KitchenView
} from "@/features/kitchen/components/kitchen-shared";

const tabs: Array<{
  labelKey: "kitchen.today" | "kitchen.thisWeek" | "kitchen.fourWeeks";
  value: KitchenView;
}> = [
  { labelKey: "kitchen.today", value: "today" },
  { labelKey: "kitchen.thisWeek", value: "week" },
  { labelKey: "kitchen.fourWeeks", value: "four-weeks" }
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
  const regionalSettings = useKitchenRegion();
  const { t } = useAppLanguage();
  const information = kitchenViewInformation(
    activeView,
    anchorDate,
    today,
    regionalSettings,
    t
  );
  const [now, setNow] = useState<Date | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleSidebarChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setIsSidebarOpen(Boolean(customEvent.detail?.open));
    };
    window.addEventListener(
      "dashboard-mobile-sidebar-change",
      handleSidebarChange
    );
    return () =>
      window.removeEventListener(
        "dashboard-mobile-sidebar-change",
        handleSidebarChange
      );
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
           * Starts at the left edge, at every width.
           *
           * This cluster used to be pushed right - `justify-end` on a phone,
           * `sm:pl-13` above it - to stay clear of the shell's fixed corner
           * strip (`.dashboard-topbar-brand`), whose burger was otherwise drawn
           * straight over the button's label. The board takes the whole screen
           * now and that strip is not rendered on this route at all, so the
           * clearance was holding an empty gap open for something that no
           * longer arrives.
           *
           * When the sidebar opens the whole board shifts to its right, keeping
           * this control visible. The same button then closes it, avoiding a
           * duplicate X inside the Kitchen sidebar.
           */}
          <div className="flex min-w-0 items-center gap-2">
            <button
              className="inline-flex h-10 min-w-0 shrink items-center justify-center border border-[#e4e4e4] bg-white px-3 text-sm font-black text-[#061126] transition hover:bg-[#f7f7f7] sm:h-11 sm:shrink-0 sm:px-4"
              onClick={requestDashboardSidebarOpenFromKitchen}
              type="button"
            >
              <LineIcon className="h-4 w-4" name="menu" />
              <span className="ml-2 truncate">
                {isSidebarOpen
                  ? t("kitchen.closeSidebar")
                  : t("kitchen.openSidebar")}
              </span>
            </button>

            <button
              aria-label={t("kitchen.notifications")}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center border border-[#e4e4e4] bg-white text-[#061126] transition hover:bg-[#f7f7f7] sm:h-11 sm:w-11"
              onClick={onTodayNotes}
              type="button"
            >
              <svg
                aria-hidden="true"
                className={`h-5 w-5 ${notificationCount > 0 ? "text-[#ef2b2d]" : "text-[#061126]"}`}
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
              label={t("kitchen.previousDates")}
              onClick={onPrevious}
            />

            <div className="min-w-0 px-1 text-center">
              {/* Two spans rather than one truncated string: `hidden` is
                  display:none, so exactly one of them is in the accessibility
                  tree at any width and a screen reader never hears the date
                  twice. `title` stays the unabbreviated form. */}
              <h1
                className="truncate text-lg font-black text-[#061126] sm:text-2xl"
                title={
                  activeView === "week"
                    ? t("kitchen.thisWeek")
                    : activeView === "four-weeks"
                      ? t("kitchen.fourWeeks")
                      : information.heading
                }
              >
                <span className="sm:hidden">
                  {activeView === "week"
                    ? t("kitchen.thisWeek")
                    : activeView === "four-weeks"
                      ? t("kitchen.fourWeeks")
                      : information.compactHeading}
                </span>
                <span className="hidden sm:inline">
                  {activeView === "week"
                    ? t("kitchen.thisWeek")
                    : activeView === "four-weeks"
                      ? t("kitchen.fourWeeks")
                      : information.heading}
                </span>
              </h1>
              {information.rangeLabel ? (
                <p className="mt-0.5 truncate text-center text-xs font-bold text-[#6a7483]">
                  {information.rangeLabel}
                </p>
              ) : null}
            </div>

            <NavButton
              direction="next"
              label={t("kitchen.nextDates")}
              onClick={onNext}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center xl:grid-cols-[auto_auto] xl:justify-end">
          <p className="inline-flex h-10 shrink-0 items-center justify-center text-2xl font-black tabular-nums text-[#ffcc55] sm:h-11 sm:px-4 sm:text-3xl">
            <span className="sr-only">{t("kitchen.currentTime")}</span>
            {now ? formatClock(now, regionalSettings) : "--:--"}
          </p>

          <nav
            aria-label={t("kitchen.range")}
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
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
