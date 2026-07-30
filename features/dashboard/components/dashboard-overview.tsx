"use client";

import { DashboardIncomeTimeline } from "@/features/dashboard/components/dashboard-income-timeline";
import { DashboardModuleLinks } from "@/features/dashboard/components/dashboard-module-links";
import { DashboardOperatingSchedule } from "@/features/dashboard/components/dashboard-operating-schedule";
import { DashboardSidePanels } from "@/features/dashboard/components/dashboard-side-panels";
import { DashboardSummaryCards } from "@/features/dashboard/components/dashboard-summary-cards";
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
  return (
    <div className="mx-auto w-full max-w-[1800px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <DashboardSummaryCards
        annualGroups={annualGroups}
        annualRangeLabel={annualRangeLabel}
        annualTotalEvents={annualTotalEvents}
        bookedEvents={bookedEvents}
        isAnnualLoading={isAnnualLoading}
        nextUpcomingEvent={nextUpcomingEvent}
      />

      <DashboardIncomeTimeline
        financialRangeLabel={financialRangeLabel}
        financialTimeline={financialTimeline}
        financeTimeFilter={financeTimeFilter}
        onFinanceTimeFilterChange={onFinanceTimeFilterChange}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.75fr)]">
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
