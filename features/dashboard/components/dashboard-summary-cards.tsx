"use client";

import { useRouter } from "next/navigation";

import {
  CalendarKpiIcon,
  EventCountGraph,
  formatEventDate,
  type ScheduleRow,
  type TimelineGroup
} from "@/components/layout/dashboard-shell-shared";

type BookedEventsSummary = {
  confirmed: number;
  onHold: number;
  total: number;
};

type DashboardSummaryCardsProps = {
  annualGroups: TimelineGroup[];
  annualRangeLabel: string;
  annualTotalEvents: number;
  bookedEvents: BookedEventsSummary;
  isAnnualLoading: boolean;
  nextUpcomingEvent?: ScheduleRow;
};

export function DashboardSummaryCards({
  annualGroups,
  annualRangeLabel,
  annualTotalEvents,
  bookedEvents,
  isAnnualLoading,
  nextUpcomingEvent
}: DashboardSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TotalEventsCard
        annualGroups={annualGroups}
        annualRangeLabel={annualRangeLabel}
        annualTotalEvents={annualTotalEvents}
        isAnnualLoading={isAnnualLoading}
      />
      <BookedEventsCard
        bookedEvents={bookedEvents}
        nextUpcomingEvent={nextUpcomingEvent}
      />
    </div>
  );
}

function TotalEventsCard({
  annualGroups,
  annualRangeLabel,
  annualTotalEvents,
  isAnnualLoading
}: Pick<
  DashboardSummaryCardsProps,
  "annualGroups" | "annualRangeLabel" | "annualTotalEvents" | "isAnnualLoading"
>) {
  return (
    <article className="overflow-hidden rounded-3xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/6">
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-[#07162d] sm:text-xl">
              Total Events
            </h2>
            <p className="mt-4 text-4xl font-black tracking-tight text-[#07162d]">
              {isAnnualLoading ? "..." : annualTotalEvents}
            </p>
          </div>
          <CalendarKpiIcon />
        </div>

        <EventCountGraph groups={annualGroups} />

        <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#edf4ff] px-4 py-3 text-xs font-bold text-[#1261e8]">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-current text-xs">
            i
          </span>
          Showing data for {annualRangeLabel}
        </div>
      </div>
    </article>
  );
}

function BookedEventsCard({
  bookedEvents,
  nextUpcomingEvent
}: Pick<DashboardSummaryCardsProps, "bookedEvents" | "nextUpcomingEvent">) {
  const router = useRouter();
  const bookedConfirmedPercent = bookedEvents.total
    ? Math.round((bookedEvents.confirmed / bookedEvents.total) * 100)
    : 0;
  const bookedOnHoldPercent = bookedEvents.total
    ? Math.round((bookedEvents.onHold / bookedEvents.total) * 100)
    : 0;

  return (
    <article className="overflow-hidden rounded-3xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/6">
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-[#07162d] sm:text-xl">
              Booked Events
            </h2>
          </div>
          <CalendarKpiIcon booked />
        </div>

        <div className="mt-5 grid gap-6 border-t border-[#d8dde5] pt-5 sm:grid-cols-[minmax(150px,0.8fr)_minmax(0,1.2fr)] sm:items-center">
          <div className="relative mx-auto h-44 w-44 rounded-full bg-[conic-gradient(#079447_0_56.25%,#ffb000_56.25%_75%,#1261e8_75%_100%)]">
            <div className="absolute inset-9 flex flex-col items-center justify-center rounded-full bg-white">
              <strong className="text-2xl font-black text-[#07162d]">
                {bookedEvents.total}
              </strong>
              <span className="text-sm font-bold text-[#607089]">Total</span>
            </div>
          </div>

          <div className="divide-y divide-[#d8dde5]">
            {[
              [
                "Confirmed",
                bookedEvents.confirmed,
                bookedConfirmedPercent,
                "#079447",
                "bg-[#eaf7ee] text-[#079447]"
              ],
              [
                "On Hold",
                bookedEvents.onHold,
                bookedOnHoldPercent,
                "#ffb000",
                "bg-[#fff5df] text-[#d88a00]"
              ],
              [
                "Upcoming",
                bookedEvents.onHold,
                bookedOnHoldPercent,
                "#1261e8",
                "bg-[#edf4ff] text-[#1261e8]"
              ]
            ].map(([label, value, percent, color, pillClass]) => (
              <div
                className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 py-4 first:pt-0 last:pb-0"
                key={String(label)}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: String(color) }}
                />
                <span className="text-sm font-bold text-[#17202a]">
                  {label}
                </span>
                <strong className="text-sm text-[#17202a]">{value}</strong>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-black ${pillClass}`}
                >
                  {percent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        className="flex w-full items-center gap-3 border-t border-[#d8dde5] bg-[#f7fcf9] px-5 py-4 text-left hover:bg-[#eef9f2] sm:px-7"
        onClick={() => router.push("/dashboard/events", { scroll: false })}
        type="button"
      >
        <CalendarKpiIcon booked />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-[#079447]">
            Next upcoming event
          </span>
          <span className="mt-1 block truncate text-sm font-medium text-[#607089]">
            {nextUpcomingEvent
              ? `${formatEventDate(nextUpcomingEvent.date)} • ${nextUpcomingEvent.time}`
              : "No upcoming event scheduled"}
          </span>
        </span>
        <span className="text-2xl text-[#07162d]">›</span>
      </button>
    </article>
  );
}
