"use client";

import { useRouter } from "next/navigation";

import {
  StatusBadge,
  type ScheduleRow,
  type TimeFilter
} from "@/components/layout/dashboard-shell-shared";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import { useAppLanguage } from "@/components/providers/app-language-provider";

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
  const { t } = useAppLanguage();
  const router = useRouter();
  const { canAccessRoute } = useDashboardAccess();
  // Checked against the route map so the schedule can never offer a link the
  // layout guard would then refuse. Redundant today - the schedule renders on
  // the same permission pair /dashboard/events requires - but it keeps the two
  // in step if either changes.
  const canOpenEvents = canAccessRoute("/dashboard/events");

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4">
      <div className="flex flex-col gap-4 border-b border-[#d8dde5] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-[#17202a]">
            {t("dashboard.schedule.title")}
          </h2>
          <p className="mt-1 text-sm font-medium text-[#6a7483]">
            {t("dashboard.schedule.blurb")}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <select
            aria-label={t("dashboard.timeFilter")}
            id="dashboard-operating-time-filter"
            name="operatingTimeFilter"
            className="h-10 rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
            onChange={(event) =>
              onTimeFilterChange(event.target.value as TimeFilter)
            }
            value={timeFilter}
          >
            <option value="today">{t("dashboard.range.today")}</option>
            <option value="week">{t("dashboard.range.thisWeek")}</option>
            <option value="month">{t("dashboard.range.thisMonth")}</option>
            <option value="year">{t("dashboard.range.thisYear")}</option>
            <option value="custom">{t("dashboard.range.custom")}</option>
          </select>

          {canOpenEvents ? (
            <button
              className="h-10 min-w-32 whitespace-nowrap rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
              type="button"
              onClick={() => router.push("/dashboard/events", { scroll: false })}
            >
              {t("dashboard.schedule.openEvents")}
            </button>
          ) : null}
        </div>
      </div>

      {timeFilter === "custom" ? (
        <div className="grid gap-3 border-b border-[#d8dde5] bg-[#fbfcfd] p-4 sm:grid-cols-2">
          <label className="text-xs font-black text-[#6a7483]" htmlFor="dashboard-custom-start-date">
            {t("dashboard.startDate")}
            <input
              id="dashboard-custom-start-date"
              name="customStartDate"
              className="mt-1 h-10 w-full rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm font-bold text-[#17202a]"
              onChange={(event) => onCustomStartDateChange(event.target.value)}
              type="date"
              value={customStartDate}
            />
          </label>

          <label className="text-xs font-black text-[#6a7483]" htmlFor="dashboard-custom-end-date">
            {t("dashboard.endDate")}
            <input
              id="dashboard-custom-end-date"
              name="customEndDate"
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
  const { t } = useAppLanguage();

  return (
    <div className="space-y-2 p-3 md:hidden">
      {isLoading ? (
        <MobileScheduleSkeleton />
      ) : scheduleRows.length === 0 ? (
        <ScheduleEmptyState />
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
                <dt className="font-black text-[#6a7483]">{t("dashboard.schedule.owner")}</dt>
                <dd className="mt-1">{row.owner}</dd>
              </div>
              <div>
                <dt className="font-black text-[#6a7483]">{t("dashboard.schedule.nextItem")}</dt>
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
  const { t } = useAppLanguage();
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-220 table-fixed text-left">
        <thead className="border-b border-[#d8dde5] bg-[#fbfcfd] text-xs font-black uppercase tracking-[0.04em] text-[#6a7483]">
          <tr>
            <th className="w-[10%] px-4 py-4">{t("common.time")}</th>
            <th className="w-[23%] px-4 py-4">{t("common.event")}</th>
            <th className="w-[17%] px-4 py-4">{t("dashboard.schedule.room")}</th>
            <th className="w-[16%] px-4 py-4">{t("dashboard.schedule.owner")}</th>
            <th className="w-[15%] px-4 py-4">{t("common.status")}</th>
            <th className="w-[19%] px-4 py-4">{t("dashboard.schedule.nextItem")}</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-[#d8dde5]">
          {isLoading ? (
            <DesktopScheduleSkeleton />
          ) : scheduleRows.length === 0 ? (
            <tr>
              <td
                className="px-4 py-8"
                colSpan={6}
              >
                <ScheduleEmptyState />
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

function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block h-3 animate-pulse rounded-full bg-[#dbe4ee] ${className}`}
    />
  );
}

function MobileScheduleSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }, (_, index) => (
        <article
          className="rounded-xl border border-[#d8dde5] p-3"
          key={index}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SkeletonLine className="w-2/3" />
              <SkeletonLine className="mt-2 w-1/2" />
            </div>
            <SkeletonLine className="h-6 w-20" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <SkeletonLine />
            <SkeletonLine />
          </div>
        </article>
      ))}
    </>
  );
}

function DesktopScheduleSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <tr className="align-middle" key={index}>
          <td className="px-4 py-5">
            <SkeletonLine className="w-16" />
          </td>
          <td className="px-4 py-5">
            <SkeletonLine className="w-36" />
            <SkeletonLine className="mt-2 w-48" />
          </td>
          <td className="px-4 py-5">
            <SkeletonLine className="w-28" />
          </td>
          <td className="px-4 py-5">
            <SkeletonLine className="w-24" />
          </td>
          <td className="px-4 py-5">
            <SkeletonLine className="h-6 w-24" />
          </td>
          <td className="px-4 py-5">
            <SkeletonLine className="w-32" />
          </td>
        </tr>
      ))}
    </>
  );
}

function ScheduleEmptyState() {
  const { t } = useAppLanguage();
  const router = useRouter();
  const { canAccessRoute } = useDashboardAccess();
  const canOpenEvents = canAccessRoute("/dashboard/events");

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center rounded-2xl border border-dashed border-[#c7d0dc] bg-[#fbfcfd] px-5 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef4fa] text-[#1f4d73]">
        <svg
          aria-hidden="true"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.25"
          viewBox="0 0 24 24"
        >
          <rect height="17" rx="2" width="18" x="3" y="4" />
          <path d="M8 2v4M16 2v4M3 9h18M8 13h4M8 17h8" />
        </svg>
      </span>
      <p className="mt-3 text-sm font-black text-[#17202a]">
        {t("dashboard.schedule.noEvents")}
      </p>
      <p className="mt-1 text-xs font-medium text-[#6a7483]">
        {t("dashboard.schedule.emptyBody")}
      </p>
      {canOpenEvents ? (
        <button
          className="mt-4 h-10 rounded-xl bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#15344f]"
          onClick={() => router.push("/dashboard/events", { scroll: false })}
          type="button"
        >
          {t("dashboard.schedule.openEventManager")}
        </button>
      ) : null}
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
  const { t } = useAppLanguage();

  if (scheduleRows.length === 0) return null;

  return (
    <nav
      aria-label={t("dashboard.schedule.pages")}
      className="flex flex-wrap items-center justify-center gap-1 border-t border-[#d8dde5] px-3 py-4"
    >
      <button
        aria-label={t("dashboard.schedule.previousPage")}
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
        aria-label={t("dashboard.schedule.nextPage")}
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
