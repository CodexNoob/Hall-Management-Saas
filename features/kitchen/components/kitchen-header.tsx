"use client";

import {
  kitchenViewInformation,
  type KitchenView
} from "@/features/kitchen/components/kitchen-shared";

export function KitchenHeader({
  activeView,
  anchorDate,
  onChangeView,
  onNext,
  onPrevious
}: {
  activeView: KitchenView;
  anchorDate: Date;
  onChangeView: (view: KitchenView) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const information = kitchenViewInformation(activeView, anchorDate);

  const tabs: Array<{
    label: string;
    value: KitchenView;
  }> = [
    { label: "Today", value: "today" },
    { label: "This Week", value: "week" },
    { label: "4 Weeks", value: "four-weeks" }
  ];

  const previousButton = (compact = false) => (
    <button
      aria-label="Previous date range"
      className={`flex shrink-0 items-center justify-center bg-transparent text-[#07162d] hover:text-[#1f4d73] ${
        compact ? "h-10 w-10" : "h-11 w-9"
      }`}
      onClick={onPrevious}
      type="button"
    >
      <svg
        aria-hidden="true"
        className={compact ? "h-6 w-6" : "h-8 w-8"}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="m15 4-8 8 8 8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.5"
        />
      </svg>
    </button>
  );

  const nextButton = (compact = false) => (
    <button
      aria-label="Next date range"
      className={`flex shrink-0 items-center justify-center bg-transparent text-[#07162d] hover:text-[#1f4d73] ${
        compact ? "h-10 w-10" : "h-11 w-9"
      }`}
      onClick={onNext}
      type="button"
    >
      <svg
        aria-hidden="true"
        className={compact ? "h-6 w-6" : "h-8 w-8"}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="m9 4 8 8-8 8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.5"
        />
      </svg>
    </button>
  );

  const viewTabs = (compact = false) =>
    tabs.map((tab) => {
      const active = activeView === tab.value;

      return (
        <button
          className={`h-11 whitespace-nowrap border text-sm font-black ${
            compact ? "min-w-0 px-2" : "min-w-20 px-3 2xl:min-w-24 2xl:px-4"
          } ${
            active
              ? "border-2 border-black bg-[#ffc958] shadow-[inset_0_0_0_1px_white]"
              : "border-[#d6dde5] bg-white hover:bg-[#f6f8fa]"
          }`}
          key={tab.value}
          onClick={() => onChangeView(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      );
    });

  return (
    <header className="border-b border-[#d6dde5] bg-white px-4 py-3 xl:py-4">
      <div className="xl:hidden">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1">
          {previousButton(true)}
          <h1
            className="min-w-0 whitespace-nowrap text-center text-[clamp(0.75rem,4vw,1.125rem)] font-black leading-tight text-[#07162d]"
            title={information.heading}
          >
            {information.heading}
          </h1>
          {nextButton(true)}
        </div>

        <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
          <strong className="min-w-0 flex-1 text-center text-base font-black leading-tight text-[#ffd45c]">
            {information.time}
          </strong>
          <span className="shrink-0 whitespace-nowrap bg-[#07162d] px-3 py-2.5 text-[10px] font-black uppercase tracking-wide text-white">
            Hall Manager
          </span>
        </div>

        <nav
          aria-label="Kitchen calendar views"
          className="mt-3 grid min-w-0 grid-cols-3 gap-2"
        >
          {viewTabs(true)}
        </nav>
      </div>

      <div className="hidden w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 xl:grid">
        <div className="flex min-w-0 items-center gap-2">
          {previousButton()}
          <h1
            className="min-w-0 max-w-[24rem] truncate whitespace-nowrap text-xl font-black text-[#07162d] 2xl:text-2xl"
            title={information.heading}
          >
            {information.heading}
          </h1>
          {nextButton()}
        </div>

        <strong className="whitespace-nowrap text-center text-lg font-black text-[#ffd45c] 2xl:text-xl">
          {information.time}
        </strong>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="shrink-0 whitespace-nowrap bg-[#07162d] px-3 py-3 text-xs font-black uppercase tracking-wide text-white">
            Hall Manager
          </span>

          <nav
            aria-label="Kitchen calendar views"
            className="flex min-w-0 shrink-0 gap-1"
          >
            {viewTabs()}
          </nav>
        </div>
      </div>
    </header>
  );
}
