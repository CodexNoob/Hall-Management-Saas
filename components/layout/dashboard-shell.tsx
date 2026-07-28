"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { NewBookingDialog } from "@/features/bookings/forms/new-booking-dialog";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { TodayNotesDrawer } from "@/components/shared/today-notes-drawer";
import type { SyncedUser, SyncedUserAccess } from "@/lib/auth/client";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";

type DashboardShellProps = {
  user: SyncedUser;
  access: SyncedUserAccess;
};

type ScheduleRow = {
  id: string;
  date: string;
  time: string;
  event: string;
  details: string;
  room: string;
  owner: string;
  status: "Confirmed" | "Menu review" | "On hold" | "Balance due";
  next: string;
};

const TODAY_NOTES_READ_STORAGE_KEY = "dashboard-today-notes-read-date";
type DashboardEvent = {
  id: string;
  clientName: string;
  eventDate: string;
  eventStatus: string;
  bookingStatus: string;
  startsAt: string | null;
  endsAt: string | null;
  hallName: string | null;
  eventType: string | null;
  packageName: string | null;
  couplesCount: number;
  menCount: number;
  ladiesCount: number;
  boysCount: number;
  girlsCount: number;
  kidsCount: number;
  waitersCount: number;
  paymentStatus: string | null;
  amountDue: string | null;
  hall: { name: string } | null;
  createdBy: { name: string | null } | null;
};

type FinancialTimelinePoint = {
  date: string;
  incomeCents: number;
  expenseCents: number;
};

type DashboardEventsResponse = {
  filters: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalEvents: number;
    bookedEvents: {
      confirmed: number;
      onHold: number;
      total: number;
    };
    financial: {
      canView: boolean;
      incomeCents: number;
      expenseCents: number;
    };
  };
  financialTimeline: FinancialTimelinePoint[];
  events: DashboardEvent[];
};

type TimeFilter = "today" | "week" | "month" | "year" | "custom";

type TimelineGroup = {
  date: string;
  rows: ScheduleRow[];
};

function getOperatingDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function formatCompactCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1
  })
    .format(cents / 100)
    .replace("K", "k");
}

function dateKeyFromLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getRangeForFilter(filter: TimeFilter) {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (filter === "week") {
    const mondayOffset = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - mondayOffset);
    end.setDate(start.getDate() + 6);
  }

  if (filter === "month") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  }

  if (filter === "year") {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  }

  return {
    startDate: dateKeyFromLocalDate(start),
    endDate: dateKeyFromLocalDate(end)
  };
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatEventTime(value: string | null) {
  if (!value) return "All day";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function eventGuestCount(event: DashboardEvent) {
  return (
    event.couplesCount * 2 +
    event.menCount +
    event.ladiesCount +
    event.boysCount +
    event.girlsCount +
    event.kidsCount
  );
}

function statusFromEvent(event: DashboardEvent): ScheduleRow["status"] {
  if (event.amountDue && Number(event.amountDue) > 0) return "Balance due";
  if (event.bookingStatus === "HOLD") return "On hold";
  if (event.eventStatus.toLowerCase().includes("menu")) return "Menu review";
  return "Confirmed";
}

function toScheduleRow(event: DashboardEvent): ScheduleRow {
  const guestCount = eventGuestCount(event);
  const status = statusFromEvent(event);

  return {
    id: event.id,
    date: event.eventDate.slice(0, 10),
    time: formatEventTime(event.startsAt),
    event: event.clientName,
    details:
      [event.eventType, guestCount ? `${guestCount} guests` : null]
        .filter(Boolean)
        .join(" - ") || "Event details pending",
    room: event.hallName ?? event.hall?.name ?? "Unassigned hall",
    owner: event.createdBy?.name ?? "Unassigned",
    status,
    next:
      status === "Balance due"
        ? "Billing follow-up"
        : status === "On hold"
          ? "Confirm booking"
          : (event.packageName ?? "Review event file")
  };
}

function groupEventsByDate(events: DashboardEvent[]) {
  return events.reduce<TimelineGroup[]>((groups, event) => {
    const row = toScheduleRow(event);
    const existing = groups.find((group) => group.date === row.date);

    if (existing) {
      existing.rows.push(row);
    } else {
      groups.push({ date: row.date, rows: [row] });
    }

    return groups;
  }, []);
}

function EventCountGraph({
  groups
}: {
  groups: Array<{ date: string; rows: ScheduleRow[] }>;
}) {
  const maxCount = Math.max(10, ...groups.map((group) => group.rows.length));

  return (
    <div className="mt-5 border-t border-[#d8dde5] pt-5">
      <h3 className="text-sm font-black text-[#17202a]">Events overview</h3>
      <div className="mt-4 grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2">
        <div className="flex h-44 flex-col justify-between pb-6 text-[10px] font-bold text-[#6a7483]">
          {[10, 8, 6, 4, 2, 0].map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
        <div className="relative h-44 border-b border-[#cbd5df]">
          {[0, 1, 2, 3, 4].map((line) => (
            <span
              className="absolute left-0 right-0 border-t border-dashed border-[#d8dde5]"
              key={line}
              style={{ top: `${line * 20}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-3 px-3">
            {groups.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center pb-6 text-xs font-bold text-[#6a7483]">
                No events in range
              </div>
            ) : (
              groups.map((group) => (
                <div
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                  key={group.date}
                >
                  <div
                    className="mx-auto w-full max-w-18 rounded-t-md bg-[#1261e8] shadow-sm"
                    style={{
                      height: `${Math.max(8, (group.rows.length / maxCount) * 142)}px`
                    }}
                    title={`${formatEventDate(group.date)}: ${group.rows.length} events`}
                  />
                  <span className="mt-2 h-5 truncate text-center text-[10px] font-bold text-[#6a7483]">
                    {formatEventDate(group.date)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function groupEventsByMonth(events: DashboardEvent[]) {
  return events.reduce<TimelineGroup[]>((groups, event) => {
    const row = toScheduleRow(event);
    const monthDate = `${row.date.slice(0, 7)}-01`;
    const existing = groups.find((group) => group.date === monthDate);

    if (existing) {
      existing.rows.push(row);
    } else {
      groups.push({ date: monthDate, rows: [row] });
    }

    return groups;
  }, []);
}

function CalendarKpiIcon({ booked = false }: { booked?: boolean }) {
  return (
    <span
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
        booked ? "bg-[#eaf7ee] text-[#079447]" : "bg-[#edf4ff] text-[#1261e8]"
      }`}
    >
      <svg
        aria-hidden="true"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        viewBox="0 0 24 24"
      >
        <rect height="17" rx="2" width="18" x="3" y="4" />
        <path d="M8 2v4M16 2v4M3 9h18" />
        {booked ? <path d="m8 15 2.5 2.5L16 12" /> : null}
      </svg>
    </span>
  );
}

function FinancialTimelineGraph({
  points
}: {
  points: FinancialTimelinePoint[];
}) {
  const maxValue = 1_500_000;
  const hasData = points.some(
    (point) => point.incomeCents > 0 || point.expenseCents > 0
  );
  const visiblePoints =
    points.length > 14
      ? points.filter((_, index) => index % Math.ceil(points.length / 14) === 0)
      : points;

  return (
    <div className="relative overflow-hidden p-1">
      <div className="mb-3 flex items-center gap-4 text-xs font-black text-[#6a7483]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-[#168a55]" />
          Income
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-[#c4382f]" />
          Expenses
        </span>
      </div>

      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
        <div className="grid grid-rows-[11rem_1.75rem] text-[10px] font-bold text-[#6a7483]">
          <div className="flex flex-col justify-between">
            <span>$15000</span>
            <span>$10000</span>
            <span>$5000</span>
            <span>$0</span>
          </div>
        </div>

        <div className="grid min-w-0 grid-rows-[11rem_1.75rem]">
          <div className="relative border-b border-l border-[#d8dde5]">
            {[0, 1, 2].map((line) => (
              <span
                className="absolute left-0 right-0 border-t border-[#d8dde5]"
                key={line}
                style={{ top: `${line * (100 / 3)}%` }}
              />
            ))}

            <div className="relative z-1 flex h-full items-end gap-2 px-2">
              {visiblePoints.map((point) => (
                <div
                  className="flex min-w-0 flex-1 items-end justify-center gap-1"
                  key={point.date}
                >
                  <div
                    className="w-full max-w-4 rounded-t-sm bg-[#168a55] shadow-sm shadow-[#17202a]/10"
                    style={{
                      height: `${Math.max(3, (point.incomeCents / maxValue) * 176)}px`
                    }}
                    title={`${formatEventDate(point.date)} income: ${formatCompactCurrency(point.incomeCents)}`}
                  />
                  <div
                    className="w-full max-w-4 rounded-t-sm bg-[#c4382f] shadow-sm shadow-[#17202a]/10"
                    style={{
                      height: `${Math.max(3, (point.expenseCents / maxValue) * 176)}px`
                    }}
                    title={`${formatEventDate(point.date)} expenses: ${formatCompactCurrency(point.expenseCents)}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="ml-px flex min-w-0 gap-2 px-2 pt-2">
            {visiblePoints.map((point) => (
              <span
                className="min-w-0 flex-1 truncate text-center text-[10px] font-bold text-[#6a7483]"
                key={point.date}
              >
                {formatEventDate(point.date)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 pt-8 text-center text-sm font-bold text-[#6a7483]">
          No income or expense activity for this filter.
        </div>
      ) : null}
    </div>
  );
}
function StatusBadge({ status }: { status: ScheduleRow["status"] }) {
  const classes: Record<ScheduleRow["status"], string> = {
    Confirmed: "border-[#146c43] bg-[#eef4fa] text-[#146c43]",
    "Menu review": "border-[#9a5b00] bg-[#fbfcfd] text-[#9a5b00]",
    "On hold": "border-[#b9c2cf] bg-[#eef4fa] text-[#1f4d73]",
    "Balance due": "border-[#a62b24] bg-[#fbfcfd] text-[#a62b24]"
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-black ${classes[status]}`}
    >
      {status}
    </span>
  );
}

export function DashboardShell({ access }: DashboardShellProps) {
  const [pageSearchQuery] = useDashboardPageSearch("Dashboard");
  const router = useRouter();
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const [todayNotesNeedRevision, setTodayNotesNeedRevision] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("week");
  const [schedulePage, setSchedulePage] = useState(1);
  const [financeTimeFilter, setFinanceTimeFilter] =
    useState<TimeFilter>("month");
  const defaultCustomRange = useMemo(() => getRangeForFilter("week"), []);
  const [customStartDate, setCustomStartDate] = useState(
    defaultCustomRange.startDate
  );
  const [customEndDate, setCustomEndDate] = useState(
    defaultCustomRange.endDate
  );
  const dashboardDateRange = useMemo(() => {
    if (timeFilter === "custom") {
      return {
        startDate: customStartDate,
        endDate:
          customEndDate < customStartDate ? customStartDate : customEndDate
      };
    }

    return getRangeForFilter(timeFilter);
  }, [customEndDate, customStartDate, timeFilter]);
  const dashboardQueryUrl = `/api/dashboard?startDate=${dashboardDateRange.startDate}&endDate=${dashboardDateRange.endDate}`;
  const dashboardQuery = useAuthenticatedQuery<DashboardEventsResponse>(
    dashboardQueryUrl,
    access.canViewCalendar || access.canViewEventManager
  );
  const annualDateRange = useMemo(() => getRangeForFilter("year"), []);
  const annualDashboardQuery = useAuthenticatedQuery<DashboardEventsResponse>(
    `/api/dashboard?startDate=${annualDateRange.startDate}&endDate=${annualDateRange.endDate}`,
    access.canViewCalendar || access.canViewEventManager
  );
  const financialDateRange = useMemo(
    () =>
      getRangeForFilter(
        financeTimeFilter === "custom" ? "month" : financeTimeFilter
      ),
    [financeTimeFilter]
  );
  const financialQueryUrl = `/api/dashboard?startDate=${financialDateRange.startDate}&endDate=${financialDateRange.endDate}`;
  const financialQuery = useAuthenticatedQuery<DashboardEventsResponse>(
    financialQueryUrl,
    access.canViewCalendar || access.canViewEventManager
  );
  const dashboardEvents = useMemo(
    () => dashboardQuery.data?.events ?? [],
    [dashboardQuery.data?.events]
  );
  const scheduleRows = useMemo(() => {
    const normalizedQuery = pageSearchQuery.trim().toLowerCase();
    const rows = dashboardEvents.map(toScheduleRow);

    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      [
        row.event,
        row.details,
        row.room,
        row.owner,
        row.status,
        row.next,
        row.date,
        row.time
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [dashboardEvents, pageSearchQuery]);
  const schedulePageCount = Math.max(1, Math.ceil(scheduleRows.length / 10));
  const visibleScheduleRows = scheduleRows.slice(
    (schedulePage - 1) * 10,
    schedulePage * 10
  );
  const firstSchedulePage = Math.min(
    Math.max(1, schedulePage - 4),
    Math.max(1, schedulePageCount - 9)
  );
  const schedulePageNumbers = Array.from(
    { length: Math.min(10, schedulePageCount) },
    (_, index) => firstSchedulePage + index
  );
  const timelineGroups = useMemo(() => {
    const visibleIds = new Set(scheduleRows.map((row) => row.id));
    return groupEventsByDate(
      dashboardEvents.filter((event) => visibleIds.has(event.id))
    );
  }, [dashboardEvents, scheduleRows]);
  const totalEvents = dashboardQuery.data?.summary.totalEvents ?? 0;
  const rangeLabel = `${formatEventDate(dashboardDateRange.startDate)} - ${formatEventDate(dashboardDateRange.endDate)}`;
  const annualEvents = annualDashboardQuery.data?.events ?? [];
  const annualTimelineGroups = groupEventsByMonth(annualEvents);
  const annualTotalEvents = annualDashboardQuery.data?.summary.totalEvents ?? 0;
  const annualRangeLabel = `${formatEventDate(annualDateRange.startDate)} - ${formatEventDate(annualDateRange.endDate)}`;
  const bookedEvents = dashboardQuery.data?.summary.bookedEvents ?? {
    confirmed: 0,
    onHold: 0,
    total: 0
  };
  const financialTimeline = financialQuery.data?.financialTimeline ?? [];
  const financialRangeLabel = `${formatEventDate(financialDateRange.startDate)} - ${formatEventDate(financialDateRange.endDate)}`;
  const bookedConfirmedPercent = bookedEvents.total
    ? Math.round((bookedEvents.confirmed / bookedEvents.total) * 100)
    : 0;
  const bookedOnHoldPercent = bookedEvents.total
    ? Math.round((bookedEvents.onHold / bookedEvents.total) * 100)
    : 0;
  const nextUpcomingEvent = scheduleRows[0];
  useEffect(() => {
    setTodayNotesNeedRevision(
      window.localStorage.getItem(TODAY_NOTES_READ_STORAGE_KEY) !==
        getOperatingDateKey()
    );
  }, []);

  useEffect(() => {
    setSchedulePage(1);
  }, [dashboardQueryUrl]);

  useEffect(() => {
    setSchedulePage((current) => Math.min(current, schedulePageCount));
  }, [schedulePageCount]);

  const closeNewBooking = useCallback(() => {
    setIsNewBookingOpen(false);
  }, []);

  const closeTodayNotes = useCallback(() => {
    setIsTodayNotesOpen(false);
  }, []);

  const openTodayNotes = useCallback(() => {
    window.localStorage.setItem(
      TODAY_NOTES_READ_STORAGE_KEY,
      getOperatingDateKey()
    );
    setTodayNotesNeedRevision(false);
    setIsTodayNotesOpen(true);
  }, []);

  const continueNewBooking = useCallback(async () => {
    setIsNewBookingOpen(false);
    await Promise.all([
      dashboardQuery.refetch(),
      annualDashboardQuery.refetch()
    ]);
  }, [annualDashboardQuery, dashboardQuery]);

  return (
    <div className="dashboard-scrollbars flex h-dvh min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <header className="relative z-40 shrink-0 bg-white">
        <DashboardTopbar
          title="Dashboard"
          subtitle="Current operating day overview for halls, kitchen, dining, events, billing, and staff."
          onTodayNotes={openTodayNotes}
          todayNotesNeedRevision={todayNotesNeedRevision}
          onNewBooking={() => setIsNewBookingOpen(true)}
        />
      </header>

      <TodayNotesDrawer onClose={closeTodayNotes} open={isTodayNotesOpen} />

      <NewBookingDialog
        onClose={closeNewBooking}
        onSubmit={continueNewBooking}
        open={isNewBookingOpen}
      />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[1800px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2">
            <article className="overflow-hidden rounded-3xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/6">
              <div className="p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-[#07162d] sm:text-xl">
                      Total Events
                    </h2>
                    <p className="mt-4 text-4xl font-black tracking-tight text-[#07162d]">
                      {annualDashboardQuery.isLoading
                        ? "..."
                        : annualTotalEvents}
                    </p>
                  </div>
                  <CalendarKpiIcon />
                </div>
                <EventCountGraph groups={annualTimelineGroups} />
                <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#edf4ff] px-4 py-3 text-xs font-bold text-[#1261e8]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-current text-xs">
                    i
                  </span>
                  Showing data for {annualRangeLabel}
                </div>
              </div>
            </article>

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
                      <span className="text-sm font-bold text-[#607089]">
                        Total
                      </span>
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
                        <strong className="text-sm text-[#17202a]">
                          {value}
                        </strong>
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
                onClick={() =>
                  router.push("/dashboard/events", { scroll: false })
                }
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
          </div>

          <section className="mt-5 overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4">
            <div className="flex flex-col gap-4 border-b border-[#d8dde5] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-[#17202a]">
                  Income timeline
                </h2>
                <p className="mt-1 text-sm font-medium text-[#6a7483]">
                  Income and expenses by period for {financialRangeLabel}.
                </p>
              </div>

              <select
                aria-label="Income timeline filter"
                className="h-10 rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
                onChange={(event) =>
                  setFinanceTimeFilter(event.target.value as TimeFilter)
                }
                value={financeTimeFilter}
              >
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
              </select>
            </div>

            <div className="p-5">
              <FinancialTimelineGraph points={financialTimeline} />
            </div>
          </section>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.75fr)]">
            <section className="min-w-0 overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4">
              <div className="flex flex-col gap-4 border-b border-[#d8dde5] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#17202a]">
                    Operating schedule
                  </h2>

                  <p className="mt-1 text-sm font-medium text-[#6a7483]">
                    Live work list for office, kitchen, and dining room
                    managers.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                  <select
                    aria-label="Dashboard time filter"
                    className="h-10 rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
                    onChange={(event) =>
                      setTimeFilter(event.target.value as TimeFilter)
                    }
                    value={timeFilter}
                  >
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                    <option value="year">This year</option>
                    <option value="custom">Custom</option>
                  </select>

                  <button
                    className="h-10 min-w-32 whitespace-nowrap rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
                    type="button"
                    onClick={() =>
                      router.push("/dashboard/events", { scroll: false })
                    }
                  >
                    Open events
                  </button>
                </div>
              </div>

              {timeFilter === "custom" ? (
                <div className="grid gap-3 border-b border-[#d8dde5] bg-[#fbfcfd] p-4 sm:grid-cols-2">
                  <label className="text-xs font-black text-[#6a7483]">
                    Start date
                    <input
                      className="mt-1 h-10 w-full rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm font-bold text-[#17202a]"
                      onChange={(event) =>
                        setCustomStartDate(event.target.value)
                      }
                      type="date"
                      value={customStartDate}
                    />
                  </label>

                  <label className="text-xs font-black text-[#6a7483]">
                    End date
                    <input
                      className="mt-1 h-10 w-full rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm font-bold text-[#17202a]"
                      min={customStartDate}
                      onChange={(event) => setCustomEndDate(event.target.value)}
                      type="date"
                      value={customEndDate}
                    />
                  </label>
                </div>
              ) : null}

              {dashboardQuery.error ? (
                <div className="border-b border-[#d8dde5] bg-[#fff7ed] p-4 text-sm font-bold text-[#9a5b00]">
                  {dashboardQuery.error}
                </div>
              ) : null}

              <div className="space-y-2 p-3 md:hidden">
                {scheduleRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#c7d0dc] p-4 text-sm font-bold text-[#6a7483]">
                    {dashboardQuery.isLoading
                      ? "Loading events..."
                      : "No events in this time range."}
                  </div>
                ) : (
                  visibleScheduleRows.map((row) => (
                    <article
                      className="rounded-xl border border-[#d8dde5] p-3"
                      key={row.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <strong className="block text-sm">{row.event}</strong>
                          <span className="mt-1 block text-xs text-[#6a7483]">
                            {row.time} · {row.room}
                          </span>
                        </div>
                        <StatusBadge status={row.status} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <dt className="font-black text-[#6a7483]">Owner</dt>
                          <dd className="mt-1">{row.owner}</dd>
                        </div>
                        <div>
                          <dt className="font-black text-[#6a7483]">
                            Next item
                          </dt>
                          <dd className="mt-1">{row.next}</dd>
                        </div>
                      </dl>
                    </article>
                  ))
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-220 table-fixed text-left">
                  <thead className="border-b border-[#d8dde5] bg-[#fbfcfd] text-xs font-black uppercase tracking-[0.04em] text-[#6a7483]">
                    <tr>
                      <th className="w-[10%] px-4 py-4">Time</th>
                      <th className="w-[23%] px-4 py-4">Event</th>
                      <th className="w-[17%] px-4 py-4">Room</th>
                      <th className="w-[16%] px-4 py-4">Owner</th>
                      <th className="w-[15%] px-4 py-4">Status</th>
                      <th className="w-[19%] px-4 py-4">Next item</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#d8dde5]">
                    {scheduleRows.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-8 text-center text-sm font-bold text-[#6a7483]"
                          colSpan={6}
                        >
                          {dashboardQuery.isLoading
                            ? "Loading events..."
                            : "No events in this time range."}
                        </td>
                      </tr>
                    ) : (
                      visibleScheduleRows.map((row) => (
                        <tr key={row.id} className="align-middle">
                          <td className="px-4 py-4 text-sm font-semibold text-[#17202a]">
                            {row.time}
                          </td>

                          <td className="px-4 py-4">
                            <p className="text-sm font-black text-[#17202a]">
                              {row.event}
                            </p>

                            <p className="mt-1 text-sm font-medium text-[#6a7483]">
                              {row.details}
                            </p>
                          </td>

                          <td className="px-4 py-4 text-sm font-medium text-[#17202a]">
                            {row.room}
                          </td>

                          <td className="px-4 py-4 text-sm font-medium text-[#17202a]">
                            {row.owner}
                          </td>

                          <td className="px-4 py-4">
                            <StatusBadge status={row.status} />
                          </td>

                          <td className="px-4 py-4 text-sm font-medium text-[#17202a]">
                            {row.next}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {scheduleRows.length > 0 ? (
                <nav
                  aria-label="Operating schedule pages"
                  className="flex flex-wrap items-center justify-center gap-1 border-t border-[#d8dde5] px-3 py-4"
                >
                  <button
                    aria-label="Previous schedule page"
                    className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-[#b9c2cf] bg-white px-2 text-sm font-black text-[#17202a] enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={schedulePage === 1}
                    onClick={() =>
                      setSchedulePage((current) => Math.max(1, current - 1))
                    }
                    type="button"
                  >
                    ‹
                  </button>
                  {schedulePageNumbers.map((page) => (
                    <button
                      aria-current={schedulePage === page ? "page" : undefined}
                      className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-black ${
                        schedulePage === page
                          ? "border-[#1f4d73] bg-[#1f4d73] text-white"
                          : "border-[#b9c2cf] bg-white text-[#17202a] hover:bg-[#eef4fa]"
                      }`}
                      key={page}
                      onClick={() => setSchedulePage(page)}
                      type="button"
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    aria-label="Next schedule page"
                    className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-[#b9c2cf] bg-white px-2 text-sm font-black text-[#17202a] enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={schedulePage === schedulePageCount}
                    onClick={() =>
                      setSchedulePage((current) =>
                        Math.min(schedulePageCount, current + 1)
                      )
                    }
                    type="button"
                  >
                    ›
                  </button>
                </nav>
              ) : null}
            </section>

            <div className="space-y-5">
              <section className="overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4">
                <div className="border-b border-[#d8dde5] p-5">
                  <h2 className="text-base font-black text-[#17202a]">
                    Events timeline
                  </h2>

                  <p className="mt-1 text-xs font-medium text-[#6a7483]">
                    {totalEvents} events from {rangeLabel}.
                  </p>
                </div>

                <div className="max-h-96 space-y-4 overflow-y-auto p-4">
                  {timelineGroups.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#c7d0dc] p-4 text-sm font-bold text-[#6a7483]">
                      {dashboardQuery.isLoading
                        ? "Loading timeline..."
                        : "No timeline items for this filter."}
                    </p>
                  ) : (
                    timelineGroups.map((group) => (
                      <div className="relative pl-5" key={group.date}>
                        <span className="absolute bottom-0 left-1.5 top-7 w-px bg-[#d8dde5]" />
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full bg-[#1f4d73]" />
                          <h3 className="text-sm font-black text-[#17202a]">
                            {formatEventDate(group.date)}
                          </h3>
                          <span className="rounded-full bg-[#eef4fa] px-2 py-1 text-[10px] font-black text-[#1f4d73]">
                            {group.rows.length}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          {group.rows.map((row) => (
                            <button
                              className="w-full rounded-xl border border-[#d8dde5] bg-white p-3 text-left transition hover:border-[#1f4d73] hover:bg-[#fbfcfd]"
                              key={row.id}
                              onClick={() => router.push("/dashboard/events")}
                              type="button"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-[#17202a]">
                                    {row.event}
                                  </p>
                                  <p className="mt-1 text-xs font-medium text-[#6a7483]">
                                    {row.time} - {row.room}
                                  </p>
                                </div>
                                <StatusBadge status={row.status} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4">
                <div className="border-b border-[#d8dde5] p-5">
                  <h2 className="text-base font-black text-[#17202a]">
                    Attention needed
                  </h2>

                  <p className="mt-1 text-xs font-medium text-[#6a7483]">
                    Issues blocking a clean operating day.
                  </p>
                </div>

                <div className="space-y-2.5 p-4">
                  <div className="rounded-xl border border-[#9a5b00] bg-[#fbfcfd] p-3 text-xs leading-5 text-[#9a5b00]">
                    <strong>Nachlas Yehuda menu lock:</strong> Second room
                    booking must follow the first menu for the night.
                  </div>

                  <div className="rounded-xl border border-[#a62b24] bg-[#fbfcfd] p-3 text-xs leading-5 text-[#a62b24]">
                    <strong>Friedman Dinner:</strong> Final balance remains
                    open. Event starts 8:30 PM.
                  </div>

                  <div className="rounded-xl border border-[#b9c2cf] bg-[#eef4fa] p-3 text-xs leading-5 text-[#1f4d73]">
                    <strong>Vendor delivery:</strong> Linen order for Grand Hall
                    marked ready, not received.
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4">
                <div className="border-b border-[#d8dde5] p-5">
                  <h2 className="text-base font-black text-[#17202a]">
                    Quick actions
                  </h2>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  <button
                    className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] transition hover:border-[#1f4d73] hover:bg-[#eef4fa]"
                    type="button"
                    onClick={() => router.push("/dashboard/events")}
                  >
                    Book event
                  </button>

                  <button
                    className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] transition hover:border-[#1f4d73] hover:bg-[#eef4fa]"
                    type="button"
                    onClick={() => router.push("/dashboard/kitchen")}
                  >
                    Kitchen board
                  </button>

                  <button
                    className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] transition hover:border-[#1f4d73] hover:bg-[#eef4fa]"
                    type="button"
                    onClick={() => router.push("/dashboard/billing")}
                  >
                    Open billing
                  </button>

                  <button
                    className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] transition hover:border-[#1f4d73] hover:bg-[#eef4fa]"
                    type="button"
                    onClick={() => router.push("/dashboard/dining-manager")}
                  >
                    Dining sheets
                  </button>
                </div>
              </section>
            </div>
          </div>

          <section className="mt-6 grid grid-flow-col auto-cols-[minmax(12rem,1fr)] gap-4 overflow-x-auto pb-6 pt-2">
            {[
              {
                eyebrow: "Live",
                title: "Kitchen",
                description:
                  "Menu production, quantities, workers, and completion status.",
                metric: "34 items active",
                route: "/dashboard/kitchen"
              },
              {
                eyebrow: "Booking",
                title: "Calendar",
                description:
                  "Month view with room availability and closed-date rules.",
                metric: "8 bookings this week",
                route: "/dashboard/calendar"
              },
              {
                eyebrow: "Manage",
                title: "Events",
                description:
                  "Full event file: client, menu, dining, staff, vendors, files.",
                metric: "27 open files",
                route: "/dashboard/events"
              },
              {
                eyebrow: "Office",
                title: "Billing",
                description:
                  "Retainers, invoices, payment links, and balances due.",
                metric: "$18.7k open",
                route: "/dashboard/billing"
              }
            ].map((item) => (
              <button
                key={item.title}
                className="min-h-38 rounded-2xl border border-[#d8dde5] bg-white p-4 text-left shadow-sm shadow-[#17202a]/4 transition hover:-translate-y-0.5 hover:border-[#1f4d73] hover:bg-[#fbfcfd] hover:shadow-md"
                type="button"
                onClick={() =>
                  router.push(item.route as Parameters<typeof router.push>[0])
                }
              >
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6a7483]">
                  {item.eyebrow}
                </p>

                <h3 className="mt-3 text-lg font-black text-[#17202a]">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm font-medium leading-6 text-[#6a7483]">
                  {item.description}
                </p>

                <p className="mt-4 whitespace-nowrap text-sm font-black text-[#1f4d73]">
                  {item.metric}
                </p>
              </button>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
