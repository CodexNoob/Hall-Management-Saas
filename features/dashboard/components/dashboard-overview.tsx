"use client";

import { DashboardIncomeTimeline } from "@/features/dashboard/components/dashboard-income-timeline";
import { DashboardModuleLinks } from "@/features/dashboard/components/dashboard-module-links";
import { DashboardOperatingSchedule } from "@/features/dashboard/components/dashboard-operating-schedule";
import { DashboardSidePanels } from "@/features/dashboard/components/dashboard-side-panels";
import { DashboardSummaryCards } from "@/features/dashboard/components/dashboard-summary-cards";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import type {
  FinancialTimelinePoint,
  ScheduleRow,
  TimeFilter,
  TimelineGroup
} from "@/components/layout/dashboard-shell-shared";

type BookedEventsSummary = {
  confirmed: number;
  onHold: number;
  total: number;
};

type DashboardOverviewProps = {
  annualGroups: TimelineGroup[];
  annualRangeLabel: string;
  annualTotalEvents: number;
  bookedEvents: BookedEventsSummary;
  customEndDate: string;
  customStartDate: string;
  dashboardError?: string | null;
  financialRangeLabel: string;
  financialTimeline: FinancialTimelinePoint[];
  financeTimeFilter: TimeFilter;
  isAnnualLoading: boolean;
  isDashboardLoading: boolean;
  nextUpcomingEvent?: ScheduleRow;
  rangeLabel: string;
  schedulePage: number;
  schedulePageCount: number;
  schedulePageNumbers: number[];
  scheduleRows: ScheduleRow[];
  timeFilter: TimeFilter;
  timelineGroups: TimelineGroup[];
  totalEvents: number;
  visibleScheduleRows: ScheduleRow[];
  onCustomEndDateChange: (value: string) => void;
  onCustomStartDateChange: (value: string) => void;
  onFinanceTimeFilterChange: (value: TimeFilter) => void;
  onSchedulePageChange: (value: number | ((current: number) => number)) => void;
  onTimeFilterChange: (value: TimeFilter) => void;
};

export function DashboardOverview({
  annualGroups,
  annualRangeLabel,
  annualTotalEvents,
  bookedEvents,
  customEndDate,
  customStartDate,
  dashboardError,
  financialRangeLabel,
  financialTimeline,
  financeTimeFilter,
  isAnnualLoading,
  isDashboardLoading,
  nextUpcomingEvent,
  rangeLabel,
  schedulePage,
  schedulePageCount,
  schedulePageNumbers,
  scheduleRows,
  timeFilter,
  timelineGroups,
  totalEvents,
  visibleScheduleRows,
  onCustomEndDateChange,
  onCustomStartDateChange,
  onFinanceTimeFilterChange,
  onSchedulePageChange,
  onTimeFilterChange
}: DashboardOverviewProps) {
  const { hasPermission } = useDashboardAccess();

  // Gating keys off the VIEW permissions, not the Staff page's role-matrix
  // columns. Those columns are all-of checks over groups that mix view and edit
  // rights, so a view-only role reads as "-" there even though it can open the
  // page - mirroring them would hide surfaces the sidebar and the layout guard
  // both allow. See lib/auth/dashboard-routes.ts for the same any-of semantics.
  if (!hasPermission("calendar.read")) return null;

  // Mirrors requireAnyPermission(["calendar.read", "event.read"]) in
  // app/api/dashboard/route.ts - the events, counts and schedule all come from
  // that one endpoint.
  const showEventOverview = hasPermission([
    "calendar.read",
    "event.read"
  ]);
  const showIncomeTimeline = hasPermission("invoice.read");

  return (
    <div className="mx-auto w-full max-w-[1800px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      {showEventOverview ? (
        <DashboardSummaryCards
          annualGroups={annualGroups}
          annualRangeLabel={annualRangeLabel}
          annualTotalEvents={annualTotalEvents}
          bookedEvents={bookedEvents}
          isDashboardLoading={isDashboardLoading}
          isAnnualLoading={isAnnualLoading}
          nextUpcomingEvent={nextUpcomingEvent}
        />
      ) : null}

      {showIncomeTimeline ? (
        <DashboardIncomeTimeline
          financialRangeLabel={financialRangeLabel}
          financialTimeline={financialTimeline}
          financeTimeFilter={financeTimeFilter}
          isLoading={isDashboardLoading}
          onFinanceTimeFilterChange={onFinanceTimeFilterChange}
        />
      ) : null}

      {/* The single mobile column needs minmax(0,1fr) for the same reason the
          xl tracks do: an implicit `auto` track is sized by its items'
          min-content, so one long client name or a nowrap status badge widened
          the column past the screen and pushed Operating schedule, Events
          timeline, Attention needed and Quick actions off the right edge. */}
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.75fr)]">
        {showEventOverview ? (
          <DashboardOperatingSchedule
            customEndDate={customEndDate}
            customStartDate={customStartDate}
            dashboardError={dashboardError}
            isLoading={isDashboardLoading}
            schedulePage={schedulePage}
            schedulePageCount={schedulePageCount}
            schedulePageNumbers={schedulePageNumbers}
            scheduleRows={scheduleRows}
            timeFilter={timeFilter}
            visibleScheduleRows={visibleScheduleRows}
            onCustomEndDateChange={onCustomEndDateChange}
            onCustomStartDateChange={onCustomStartDateChange}
            onSchedulePageChange={onSchedulePageChange}
            onTimeFilterChange={onTimeFilterChange}
          />
        ) : null}

        <DashboardSidePanels
          isLoading={isDashboardLoading}
          rangeLabel={rangeLabel}
          timelineGroups={timelineGroups}
          totalEvents={totalEvents}
        />
      </div>

      <DashboardModuleLinks />
    </div>
  );
}
