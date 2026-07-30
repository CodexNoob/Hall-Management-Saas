"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionButton, LineIcon } from "@/features/events/components/event-manager-shared";

function KitchenItemCard({
  title,
  amount,
  status,
  note
}: {
  title: string;
  amount: string;
  status: string;
  note: string;
}) {
  const statusClass =
    status === "COMPLETE"
      ? "text-[#146c43]"
      : status === "IN PROGRESS"
        ? "text-[#9a5b00]"
        : "text-[#17202a]";

  return (
    <article className="w-full min-w-0 border border-[#d8dde5] bg-white p-3 xl:w-27">
      <h3 className="border-b border-[#d8dde5] pb-3 text-center text-lg font-black leading-4 text-[#17202a]">
        {title}
      </h3>
      <p className="mt-3 text-xs font-black text-[#17202a]">{amount}</p>
      <p
        className={`mt-1 text-[11px] font-black uppercase tracking-[0.08em] ${statusClass}`}
      >
        {status}
      </p>
      <p className="mt-2 text-[11px] leading-4 text-[#6a7483]">{note}</p>
    </article>
  );
}

export function EventKitchenContent() {
  type KitchenView = "Today" | "This Week" | "4 Weeks";
  const initialKitchenDate = useMemo(() => new Date(2026, 6, 8, 12), []);
  const [kitchenView, setKitchenView] = useState<KitchenView>("Today");
  const [kitchenDate, setKitchenDate] = useState(initialKitchenDate);
  const [currentTime, setCurrentTime] = useState("3:56 PM");

  useEffect(() => {
    const updateCurrentTime = () => {
      setCurrentTime(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit"
        }).format(new Date())
      );
    };

    updateCurrentTime();
    const timer = window.setInterval(updateCurrentTime, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const moveKitchenDate = (direction: -1 | 1) => {
    const increment =
      kitchenView === "Today" ? 1 : kitchenView === "This Week" ? 7 : 28;
    setKitchenDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + direction * increment);
      return next;
    });
  };

  const kitchenDateLabel = useMemo(() => {
    const fullDate = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
    if (kitchenView === "Today") return fullDate.format(kitchenDate);

    const start = new Date(kitchenDate);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + (kitchenView === "This Week" ? 6 : 27));
    const shortDate = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric"
    });
    return `${kitchenView} · ${shortDate.format(start)} – ${shortDate.format(end)}, ${end.getFullYear()}`;
  }, [kitchenDate, kitchenView]);

  const kitchenItems = [
    ["Challah rolls", "240", "COMPLETE", "Already prepared"],
    ["Chicken soup", "120 bowls", "IN PROGRESS", "Already in progress"],
    ["Braised short ribs", "24 trays", "PENDING", "Changes still allowed"],
    ["Potato kugel", "18 pans", "PENDING", "Changes still allowed"],
    ["Children schnitzel", "38 portions", "PENDING", "Changes still allowed"]
  ];

  return (
    <div className="space-y-3">
      <section className="hidden min-w-0 bg-[#a9a9a9] p-3 text-[#17202a] sm:p-4">
        <div className="space-y-3 xl:hidden">
          <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2">
            <button
              aria-label="Previous date range"
              className="flex h-10 w-10 shrink-0 items-center justify-center bg-transparent text-[#07162d] hover:text-[#1f4d73]"
              onClick={() => moveKitchenDate(-1)}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-6 w-6"
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
            <h2 className="min-w-0 text-center text-base font-black leading-tight">
              {kitchenDateLabel}
            </h2>
            <button
              aria-label="Next date range"
              className="flex h-10 w-10 shrink-0 items-center justify-center bg-transparent text-[#07162d] hover:text-[#1f4d73]"
              onClick={() => moveKitchenDate(1)}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-6 w-6"
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
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["Today", "This Week", "4 Weeks"] as KitchenView[]).map(
              (view) => (
                <button
                  className={`h-10 min-w-0 px-2 text-sm font-black ${
                    kitchenView === view ? "bg-[#f5c542]" : "bg-white"
                  }`}
                  key={view}
                  onClick={() => setKitchenView(view)}
                  type="button"
                >
                  {view}
                </button>
              )
            )}
          </div>

          <p className="text-center text-xl font-black text-[#ffe36e]">
            {currentTime}
          </p>
        </div>

        <div className="hidden xl:block">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="flex h-11 w-9 shrink-0 items-center justify-center bg-transparent text-[#07162d] hover:text-[#1f4d73]"
                onClick={() => moveKitchenDate(-1)}
                type="button"
                aria-label="Previous date range"
              >
                <svg
                  aria-hidden="true"
                  className="h-8 w-8"
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
              <h2 className="flex h-10 min-w-0 items-center whitespace-nowrap text-2xl font-black">
                {kitchenDateLabel}
              </h2>
              <button
                className="flex h-11 w-9 shrink-0 items-center justify-center bg-transparent text-[#07162d] hover:text-[#1f4d73]"
                onClick={() => moveKitchenDate(1)}
                type="button"
                aria-label="Next date range"
              >
                <svg
                  aria-hidden="true"
                  className="h-8 w-8"
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
            </div>

            <p className="flex h-10 items-center justify-center whitespace-nowrap px-1 text-2xl font-black text-[#ffe36e]">
              {currentTime}
            </p>

            <div className="flex flex-wrap justify-end gap-3">
              {(["Today", "This Week", "4 Weeks"] as KitchenView[]).map(
                (view) => (
                  <button
                    className={`h-10 px-5 text-sm font-black ${
                      kitchenView === view ? "bg-[#f5c542]" : "bg-white"
                    }`}
                    key={view}
                    onClick={() => setKitchenView(view)}
                    type="button"
                  >
                    {view}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      <button
        className="hidden h-11 w-full items-center gap-3 border border-[#d8dde5] bg-white px-4 text-sm font-black text-[#6a7483]"
        type="button"
      >
        <LineIcon name="plus" />
        Kitchen live view
      </button>

      <section className="min-w-0 border border-[#b9c2cf] bg-[#d8eeee] p-2 sm:p-4">
        <div className="min-w-0 border border-[#b9c2cf] bg-[#d8eeee] p-3 sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
            <div className="min-w-0 border-l-5 border-[#21b8ae] pl-3 sm:pl-5">
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[#17202a]">
                Friedman Wedding
              </p>
              <h2 className="mt-4 text-2xl font-black text-[#001a33]">
                278 portions
              </h2>
              <button
                className="mt-3 inline-flex h-7 items-center gap-2 border border-[#c77cff] bg-[#f7eaff] px-3 text-xs font-black text-[#8a3fd1]"
                type="button"
              >
                <LineIcon name="document" className="h-3.5 w-3.5" />
                Kitchen live
              </button>
              <p className="mt-4 text-sm font-black uppercase tracking-[0.12em] text-[#516174]">
                Gold dinner menu assigned
              </p>
              <div className="mt-3 border border-[#e6c35c] bg-[#fff7d7] px-3 py-2 text-sm font-black text-[#9a5b00]">
                Needs it ready for 6:30 PM
              </div>
              <p className="mt-4 max-w-md text-xs leading-5 text-[#1f4d73]">
                Read-only event view. This reflects the kitchen in real time.
                Kitchen is already in progress. Items already started are no
                longer changeable.
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-2 items-start gap-2 sm:grid-cols-3 xl:flex xl:flex-wrap xl:gap-3">
              {kitchenItems.map(([title, amount, status, note]) => (
                <KitchenItemCard
                  key={title}
                  title={title}
                  amount={amount}
                  status={status}
                  note={note}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
