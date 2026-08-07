"use client";

export type ScheduleRow = {
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

export const TODAY_NOTES_READ_STORAGE_KEY =
  "dashboard-today-notes-read-date";

export type DashboardEvent = {
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

export type FinancialTimelinePoint = {
  date: string;
  incomeCents: number;
  expenseCents: number;
};

export type DashboardEventsResponse = {
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

export type TimeFilter = "today" | "week" | "month" | "year" | "custom";

export type TimelineGroup = {
  date: string;
  rows: ScheduleRow[];
};

export function getOperatingDateKey() {
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

export function formatCompactCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1
  })
    .format(cents / 100)
    .replace("K", "k");
}

export function dateKeyFromLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getRangeForFilter(filter: TimeFilter) {
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

export function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export function formatEventTime(value: string | null) {
  if (!value) return "All day";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function eventGuestCount(event: DashboardEvent) {
  return (
    event.couplesCount * 2 +
    event.menCount +
    event.ladiesCount +
    event.boysCount +
    event.girlsCount +
    event.kidsCount
  );
}

export function statusFromEvent(event: DashboardEvent): ScheduleRow["status"] {
  if (event.amountDue && Number(event.amountDue) > 0) return "Balance due";
  if (["HOLD", "TENTATIVE_HOLD"].includes(event.bookingStatus)) return "On hold";
  if (event.eventStatus.toLowerCase().includes("menu")) return "Menu review";
  return "Confirmed";
}

export function toScheduleRow(event: DashboardEvent): ScheduleRow {
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

export function groupEventsByDate(events: DashboardEvent[]) {
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

export function EventCountGraph({
  groups
}: {
  groups: Array<{ date: string; rows: ScheduleRow[] }>;
}) {
  const largestCount = Math.max(0, ...groups.map((group) => group.rows.length));
  const maxCount = Math.max(4, Math.ceil(largestCount / 2) * 2);
  const ticks = Array.from({ length: 5 }, (_, index) =>
    Math.round(maxCount - index * (maxCount / 4))
  );

  return (
    <div className="mt-5 border-t border-[#d8dde5] pt-5">
      <h3 className="text-sm font-black text-[#17202a]">Events overview</h3>
      <div className="mt-4 grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2">
        <div className="flex h-44 flex-col justify-between pb-6 text-[10px] font-bold text-[#6a7483]">
          {ticks.map((value) => (
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

export function groupEventsByMonth(events: DashboardEvent[]) {
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

export function groupEventsByMonthRange(
  events: DashboardEvent[],
  startDate: string,
  endDate: string
) {
  const groupedEvents = groupEventsByMonth(events);
  const rowsByMonth = new Map(
    groupedEvents.map((group) => [group.date, group.rows])
  );
  const start = new Date(`${startDate.slice(0, 7)}-01T00:00:00`);
  const end = new Date(`${endDate.slice(0, 7)}-01T00:00:00`);
  const groups: TimelineGroup[] = [];

  for (
    const cursor = new Date(start);
    cursor <= end;
    cursor.setMonth(cursor.getMonth() + 1)
  ) {
    const monthDate = dateKeyFromLocalDate(cursor);
    groups.push({
      date: monthDate,
      rows: rowsByMonth.get(monthDate) ?? []
    });
  }

  return groups;
}

export function CalendarKpiIcon({ booked = false }: { booked?: boolean }) {
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

export function FinancialTimelineGraph({
  isLoading = false,
  points
}: {
  isLoading?: boolean;
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
              {isLoading
                ? Array.from({ length: 8 }, (_, index) => (
                    <div
                      className="flex min-w-0 flex-1 items-end justify-center gap-1"
                      key={index}
                    >
                      <div
                        className="w-full max-w-4 animate-pulse rounded-t-sm bg-[#dbe4ee]"
                        style={{ height: `${52 + (index % 4) * 28}px` }}
                      />
                      <div
                        className="w-full max-w-4 animate-pulse rounded-t-sm bg-[#edf1f6]"
                        style={{ height: `${28 + (index % 3) * 18}px` }}
                      />
                    </div>
                  ))
                : null}
              {!isLoading ? visiblePoints.map((point) => (
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
              )) : null}
            </div>
          </div>

          <div className="ml-px flex min-w-0 gap-2 px-2 pt-2">
            {(isLoading ? Array.from({ length: 8 }) : visiblePoints).map((point, index) => (
              <span
                className="min-w-0 flex-1 truncate text-center text-[10px] font-bold text-[#6a7483]"
                key={isLoading ? index : (point as FinancialTimelinePoint).date}
              >
                {isLoading ? "..." : formatEventDate((point as FinancialTimelinePoint).date)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {!isLoading && !hasData ? (
        <div className="absolute inset-x-6 top-24 flex justify-center text-center">
          <div className="rounded-2xl border border-[#d8dde5] bg-white/95 px-5 py-4 shadow-sm">
            <p className="text-sm font-black text-[#17202a]">
              No financial activity yet
            </p>
            <p className="mt-1 max-w-sm text-xs font-medium text-[#6a7483]">
              Paid invoices and processed refunds will appear here once billing
              activity is recorded for this period.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
export function StatusBadge({ status }: { status: ScheduleRow["status"] }) {
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
