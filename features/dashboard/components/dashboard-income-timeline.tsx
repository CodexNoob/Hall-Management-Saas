"use client";

import {
  FinancialTimelineGraph,
  type FinancialTimelinePoint,
  type TimeFilter
} from "@/components/layout/dashboard-shell-shared";

type DashboardIncomeTimelineProps = {
  financialRangeLabel: string;
  financeTimeFilter: TimeFilter;
  financialTimeline: FinancialTimelinePoint[];
  isLoading: boolean;
  onFinanceTimeFilterChange: (filter: TimeFilter) => void;
};

export function DashboardIncomeTimeline({
  financialRangeLabel,
  financeTimeFilter,
  financialTimeline,
  isLoading,
  onFinanceTimeFilterChange
}: DashboardIncomeTimelineProps) {
  return (
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
          id="dashboard-income-time-filter"
          name="incomeTimeFilter"
          className="h-10 rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
          onChange={(event) =>
            onFinanceTimeFilterChange(event.target.value as TimeFilter)
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
        <FinancialTimelineGraph
          isLoading={isLoading}
          points={financialTimeline}
        />
      </div>
    </section>
  );
}
