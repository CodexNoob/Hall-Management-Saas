"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { NewBookingDialog } from "@/features/bookings/forms/new-booking-dialog";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { TodayNotesDrawer } from "@/components/shared/today-notes-drawer";
import { UpgradePlanDialog } from "@/components/forms/upgrade-plan-dialog";
import type {
  SyncedOrganization,
  SyncedUser,
  SyncedUserAccess
} from "@/lib/auth/client";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import {
  getTrialDaysRemaining,
  isTrialExpired
} from "@/lib/subscription/trial";

type DashboardShellProps = {
  user: SyncedUser;
  access: SyncedUserAccess;
  activeOrganizationId: string;
  organizations: SyncedOrganization[];
};

import {
  TODAY_NOTES_READ_STORAGE_KEY,
  formatEventDate,
  getOperatingDateKey,
  getRangeForFilter,
  groupEventsByDate,
  groupEventsByMonthRange,
  toScheduleRow,
  type DashboardEventsResponse,
  type TimeFilter
} from "@/components/layout/dashboard-shell-shared";
export function DashboardShell({
  access,
  activeOrganizationId,
  organizations,
  user
}: DashboardShellProps) {
  const [pageSearchQuery] = useDashboardPageSearch("Dashboard");
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
  const annualTimelineGroups = groupEventsByMonthRange(
    annualEvents,
    annualDateRange.startDate,
    annualDateRange.endDate
  );
  const annualTotalEvents = annualDashboardQuery.data?.summary.totalEvents ?? 0;
  const annualRangeLabel = `${formatEventDate(annualDateRange.startDate)} - ${formatEventDate(annualDateRange.endDate)}`;
  const bookedEvents = dashboardQuery.data?.summary.bookedEvents ?? {
    confirmed: 0,
    onHold: 0,
    total: 0
  };
  const financialTimeline = financialQuery.data?.financialTimeline ?? [];
  const financialRangeLabel = `${formatEventDate(financialDateRange.startDate)} - ${formatEventDate(financialDateRange.endDate)}`;
  const nextUpcomingEvent = scheduleRows[0];
  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ??
    null;
  const trialExpired = isTrialExpired({
    email: user.email,
    subscriptionStatus: activeOrganization?.subscriptionStatus,
    trialEndsAt: activeOrganization?.trialEndsAt
  });
  const trialDaysRemaining = getTrialDaysRemaining(
    activeOrganization?.trialEndsAt
  );
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

      <UpgradePlanDialog
        description={
          trialDaysRemaining === 0
            ? "Your 14-day free trial has ended. Choose a subscription plan to continue using Event Core."
            : "Choose a subscription plan to continue using Event Core."
        }
        forceSelection={trialExpired}
        onClose={() => {}}
        open={trialExpired}
        title="Your free trial has ended"
      />

      <main className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <DashboardOverview
          annualGroups={annualTimelineGroups}
          annualRangeLabel={annualRangeLabel}
          annualTotalEvents={annualTotalEvents}
          bookedEvents={bookedEvents}
          customEndDate={customEndDate}
          customStartDate={customStartDate}
          dashboardError={dashboardQuery.error}
          financialRangeLabel={financialRangeLabel}
          financialTimeline={financialTimeline}
          financeTimeFilter={financeTimeFilter}
          isAnnualLoading={annualDashboardQuery.isLoading}
          isDashboardLoading={dashboardQuery.isLoading}
          nextUpcomingEvent={nextUpcomingEvent}
          rangeLabel={rangeLabel}
          schedulePage={schedulePage}
          schedulePageCount={schedulePageCount}
          schedulePageNumbers={schedulePageNumbers}
          scheduleRows={scheduleRows}
          timeFilter={timeFilter}
          timelineGroups={timelineGroups}
          totalEvents={totalEvents}
          visibleScheduleRows={visibleScheduleRows}
          onCustomEndDateChange={setCustomEndDate}
          onCustomStartDateChange={setCustomStartDate}
          onFinanceTimeFilterChange={setFinanceTimeFilter}
          onNewBooking={() => setIsNewBookingOpen(true)}
          onSchedulePageChange={setSchedulePage}
          onTimeFilterChange={setTimeFilter}
        />
      </main>
    </div>
  );
}
