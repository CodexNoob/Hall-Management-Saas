"use client";

import { useRouter } from "next/navigation";

import {
  StatusBadge,
  type ScheduleRow,
  type TimeFilter
} from "@/components/layout/dashboard-shell-shared";

type DashboardOperatingScheduleProps = {
  customEndDate: string;
  customStartDate: string;
  dashboardError?: string | null;
  isLoading: boolean;
  schedulePage: number;
  schedulePageCount: number;
  schedulePageNumbers: number[];
  scheduleRows: ScheduleRow[];
  timeFilter: TimeFilter;
  visibleScheduleRows: ScheduleRow[];
  onCustomEndDateChange: (value: string) => void;
  onCustomStartDateChange: (value: string) => void;
  onSchedulePageChange: (value: number | ((current: number) => number)) => void;
  onTimeFilterChange: (value: TimeFilter) => void;
};

export function DashboardOperatingSchedule({
  customEndDate,
  customStartDate,
  dashboardError,
  isLoading,
  schedulePage,
  schedulePageCount,
  schedulePageNumbers,
  scheduleRows,
  timeFilter,
  visibleScheduleRows,
  onCustomEndDateChange,
  onCustomStartDateChange,
  onSchedulePageChange,
  onTimeFilterChange
}: DashboardOperatingScheduleProps) {
  const router = useRouter();

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4">
      <div className="flex flex-col gap-4 border-b border-[#d8dde5] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-[#17202a]">
            Operating schedule
          </h2>
          <p className="mt-1 text-sm font-medium text-[#6a7483]">
            Live work list for office, kitchen, and dining room managers.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <select
            aria-label="Dashboard time filter"
            className="h-10 rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
            onChange={(event) =>
              onTimeFilterChange(event.target.value as TimeFilter)
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
            onClick={() => router.push("/dashboard/events", { scroll: false })}
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
              onChange={(event) => onCustomStartDateChange(event.target.value)}
              type="date"
              value={customStartDate}
            />
          </label>

          <label className="text-xs font-black text-[#6a7483]">
            End date
            <input
              className="mt-1 h-10 w-full rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm font-bold text-[#17202a]"
              min={customStartDate}
              onChange={(event) => onCustomEndDateChange(event.target.value)}
              type="date"
              value={customEndDate}
            />
          </label>
        </div>
      ) : null}

      {dashboardError ? (
        <div className="border-b border-[#d8dde5] bg-[#fff7ed] p-4 text-sm font-bold text-[#9a5b00]">
          {dashboardError}
        </div>
      ) : null}

      <MobileScheduleList
        isLoading={isLoading}
        scheduleRows={scheduleRows}
        visibleScheduleRows={visibleScheduleRows}
      />
      <DesktopScheduleTable
        isLoading={isLoading}
        scheduleRows={scheduleRows}
        visibleScheduleRows={visibleScheduleRows}
      />
      <SchedulePagination
        schedulePage={schedulePage}
        schedulePageCount={schedulePageCount}
        schedulePageNumbers={schedulePageNumbers}
        scheduleRows={scheduleRows}
        onSchedulePageChange={onSchedulePageChange}
      />
    </section>
  );
}

function MobileScheduleList({
  isLoading,
  scheduleRows,
  visibleScheduleRows
}: Pick<
  DashboardOperatingScheduleProps,
  "isLoading" | "scheduleRows" | "visibleScheduleRows"
>) {
  return (
    <div className="space-y-2 p-3 md:hidden">
      {scheduleRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#c7d0dc] p-4 text-sm font-bold text-[#6a7483]">
          {isLoading ? "Loading events..." : "No events in this time range."}
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
                <dt className="font-black text-[#6a7483]">Next item</dt>
                <dd className="mt-1">{row.next}</dd>
              </div>
            </dl>
          </article>
        ))
      )}
    </div>
  );
}

function DesktopScheduleTable({
  isLoading,
  scheduleRows,
  visibleScheduleRows
}: Pick<
  DashboardOperatingScheduleProps,
  "isLoading" | "scheduleRows" | "visibleScheduleRows"
>) {
  return (
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
                {isLoading ? "Loading events..." : "No events in this time range."}
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
  );
}

function SchedulePagination({
  schedulePage,
  schedulePageCount,
  schedulePageNumbers,
  scheduleRows,
  onSchedulePageChange
}: Pick<
  DashboardOperatingScheduleProps,
  | "schedulePage"
  | "schedulePageCount"
  | "schedulePageNumbers"
  | "scheduleRows"
  | "onSchedulePageChange"
>) {
  if (scheduleRows.length === 0) return null;

  return (
    <nav
      aria-label="Operating schedule pages"
      className="flex flex-wrap items-center justify-center gap-1 border-t border-[#d8dde5] px-3 py-4"
    >
      <button
        aria-label="Previous schedule page"
        className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-[#b9c2cf] bg-white px-2 text-sm font-black text-[#17202a] enabled:hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={schedulePage === 1}
        onClick={() => onSchedulePageChange((current) => Math.max(1, current - 1))}
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
          onClick={() => onSchedulePageChange(page)}
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
          onSchedulePageChange((current) =>
            Math.min(schedulePageCount, current + 1)
          )
        }
        type="button"
      >
        ›
      </button>
    </nav>
  );
}
