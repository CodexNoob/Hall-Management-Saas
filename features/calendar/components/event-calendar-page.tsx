"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { centerMobileTab } from "@/lib/ui/center-mobile-tab";
import { formatHebrewDateWithoutYear } from "@/lib/dates/hebrew-date";
import { CalendarBookingDialog } from "@/features/calendar/forms/calendar-booking-dialog";
import { type DateRange } from "@/features/calendar/forms/date-range-picker-dialog";
import { AsyncState } from "@/components/ui/async-state";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  dateKey,
  dateKeyFromIso,
  startOfDay,
  startOfMonth,
  weekDates
} from "@/lib/dates/calendar-date";
import { hallDayStatus } from "@/lib/bookings/hall-day-availability";
import {
  prefetchAuthenticatedQuery,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAccess } from "@/features/dashboard/hooks/use-dashboard-permission";

import { AvailabilityView } from "@/features/calendar/components/calendar-availability-tab";
import { CalendarAgendaView } from "@/features/calendar/components/calendar-agenda-view";
import {
  createCalendarDayReader,
  hasOpenAvailability
} from "@/features/calendar/components/calendar-day-model";
import { EventPill } from "@/features/calendar/components/calendar-event-pill";
import { CalendarSettingsView } from "@/features/calendar/components/calendar-settings-tab";
import {
  CalendarBodySkeleton,
  CalendarSelectedDaySkeleton
} from "@/features/calendar/components/calendar-skeleton";
import { CalendarWeekView } from "@/features/calendar/components/calendar-week-view";
import {
  BuildingIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SettingsIcon,
  StatusDot,
  weekDayLabels,
  type AvailabilityDay,
  type CalendarBooking,
  type EventsResponse
} from "@/features/calendar/components/calendar-shared";

/** Hoisted out of the day loop, which builds one of these per day otherwise. */
const availabilityDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric"
});

const availabilityDayNameFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short"
});

/**
 * The url one period is read from.
 *
 * Bounded by the month rather than by the rendered grid, because the grid now
 * depends on a setting this very query returns. A 42-cell grid always starts
 * within six days before the 1st and ends within 41 days after it, whichever day
 * the week is set to start on, so this covers every rotation and stays the same
 * url when the setting arrives - no refetch, no flash of a grid drawn from a
 * range that was measured for a different one.
 *
 * The Availability tab's range is folded in so both tabs read one request.
 *
 * A function rather than an inline expression so the periods either side can be
 * addressed with it too: warming the exact url the arrows will ask for is what
 * makes stepping through months land on the cache instead of a request.
 */
function calendarQueryUrlFor(month: Date, availabilityRange: DateRange) {
  const monthStart = startOfMonth(month);
  const dates = [
    addDays(monthStart, -7),
    addDays(monthStart, 42),
    availabilityRange.startDate,
    availabilityRange.endDate
  ];
  const times = dates.map((date) => date.getTime());

  return `/api/calendar?startDate=${dateKey(new Date(Math.min(...times)))}&endDate=${dateKey(new Date(Math.max(...times)))}`;
}

export function EventCalendarPage() {
  const settingsMutation = useAuthenticatedMutation<
    { dailyEventLimit: number },
    unknown
  >("/api/settings", "PATCH");
  const createBlockedDateMutation = useAuthenticatedMutation<
    { hallId: string; startDate: string; endDate: string; label: string },
    unknown
  >("/api/calendar/blocked-dates");
  const removeBlockedDateMutation = useAuthenticatedMutation<
    { id: string },
    unknown
  >("/api/calendar/blocked-dates", "DELETE");
  const [activeTab, setActiveTab] = useState<
    "calendar" | "availability" | "settings"
  >("calendar");
  const today = useMemo(() => startOfDay(new Date()), []);
  // Deliberately empty: the Availability tab shows nothing until a hall is
  // chosen, because every number on it is a fact about one hall.
  const [availabilityHallId, setAvailabilityHallId] = useState("");
  const [availabilityRange, setAvailabilityRange] = useState<DateRange>(() => {
    const startDate = startOfMonth(today);
    return {
      startDate,
      endDate: new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
    };
  });
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDateValue, setSelectedDateValue] = useState(today);
  const selectedDate = dateKey(selectedDateValue);
  const [hallFilter, setHallFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [bookingSuccessMessage, setBookingSuccessMessage] = useState("");
  const canCreateEvent = useAccess("booking.create");
  const canUpdateSettings = useAccess("settings.update");
  const calendarQueryUrl = useMemo(
    () => calendarQueryUrlFor(visibleMonth, availabilityRange),
    [availabilityRange, visibleMonth]
  );
  const eventsQuery = useAuthenticatedQuery<EventsResponse>(calendarQueryUrl);
  /*
   * The last response that landed, whichever period it was for.
   *
   * Only `events` is scoped to the period; the halls, the event types, the
   * blocked ranges and the calendar settings come back identical every time. So
   * a step into a month that is not cached yet can keep drawing the page's
   * chrome - the filters, the arrows, the legend, the view it is in - from the
   * previous response instead of tearing the page down to a spinner, and only
   * the parts that actually show bookings wait.
   */
  const lastLoadedRef = useRef<EventsResponse | null>(null);

  if (eventsQuery.data) lastLoadedRef.current = eventsQuery.data;

  const calendarData = eventsQuery.data ?? lastLoadedRef.current;
  const hasLoadedOnce = calendarData !== null;
  // A period whose events are still on the way, with a page already on screen.
  // The first load has no page to keep and still owns the whole main area.
  const isPeriodLoading = eventsQuery.isLoading && hasLoadedOnce;
  const periodError = hasLoadedOnce ? eventsQuery.error : null;
  const weekStartsOn = calendarData?.calendarSettings?.weekStartsOn ?? "sunday";
  // Settings can drop the + button on each day and let the whole cell open the
  // booking form instead. Off, a day click only selects the day.
  const clickAnywhereToAdd =
    calendarData?.calendarSettings?.clickAnywhereToAdd ?? false;
  const showHebrewDate = calendarData?.calendarSettings?.showHebrewDate ?? true;
  const showAvailability =
    calendarData?.calendarSettings?.showAvailability ?? true;
  /*
   * The two periods the arrows lead to, warmed while this one is being read.
   *
   * Stepping a month is the one navigation on this page that changes the query
   * url, and it is nearly always followed by another step in the same direction
   * or straight back. Fetching both neighbours once the current period has
   * landed turns those clicks into cache reads, which is the version of this
   * with no loading state at all. Anything already fresh costs nothing.
   */
  const adjacentQueryUrls = useMemo(
    () => [
      calendarQueryUrlFor(addMonths(visibleMonth, -1), availabilityRange),
      calendarQueryUrlFor(addMonths(visibleMonth, 1), availabilityRange)
    ],
    [availabilityRange, visibleMonth]
  );
  const isLoadingCalendar = eventsQuery.isLoading;

  useEffect(() => {
    if (!bookingSuccessMessage) return;

    const timeout = window.setTimeout(
      () => setBookingSuccessMessage(""),
      4000
    );
    return () => window.clearTimeout(timeout);
  }, [bookingSuccessMessage]);

  useEffect(() => {
    // The period on screen goes first: a prefetch racing it would be competing
    // for the connection with the request the reader is actually waiting on.
    if (isLoadingCalendar) return;

    for (const url of adjacentQueryUrls) {
      void prefetchAuthenticatedQuery(url);
    }
  }, [adjacentQueryUrls, isLoadingCalendar]);
  /*
   * The only thing that picks the view now that the in-page switcher is gone:
   * Settings > Calendar > Default view, which arrives with the calendar data
   * rather than being known at mount. Reading it straight off the response,
   * instead of seeding state from it, is what lets the setting apply the moment
   * it lands without an effect racing the first paint.
   */
  const calendarView = calendarData?.calendarSettings?.defaultView ?? "month";
  const calendarGridDays = useMemo(
    () => buildMonthGrid(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn]
  );
  const gridWeekDays = useMemo(
    () => weekDayLabels(weekStartsOn),
    [weekStartsOn]
  );
  const dailyEventLimit = calendarData?.calendarSettings?.dailyEventLimit ?? 2;
  const bookings = useMemo<CalendarBooking[]>(
    () =>
      (calendarData?.events ?? []).map((event) => {
        const normalizedStatus = event.bookingStatus.toLowerCase();
        const isSchoolEvent = event.eventType?.toLowerCase().includes("school");

        return {
          id: event.id,
          dateKey: dateKeyFromIso(event.eventDate),
          title: event.clientName,
          hall: event.hall.name,
          hallId: event.hall.id,
          hallColor: event.hall.color,
          type: event.eventType ?? "Event",
          packageName: event.packageName ?? undefined,
          status: isSchoolEvent
            ? "school"
            : normalizedStatus.includes("confirm")
              ? "confirmed"
              : "hold"
        };
      }),
    [calendarData]
  );
  const halls = useMemo(
    () => (calendarData?.halls ?? []).map((hall) => hall.name),
    [calendarData]
  );
  const availabilityRangeDays = useMemo(() => {
    const days: Date[] = [];

    for (
      let day = startOfDay(availabilityRange.startDate);
      day <= availabilityRange.endDate;
      day = addDays(day, 1)
    ) {
      days.push(day);
    }

    return days;
  }, [availabilityRange.endDate, availabilityRange.startDate]);
  /*
   * One hall's days, not the venue's.
   *
   * Empty until a hall is picked: "which days are free" has no answer across a
   * venue whose halls have separate limits and separate holds, and the summed
   * total the tab used to show could call a day available while the room the
   * caller actually wanted was taken.
   *
   * Blocked days drop out of the list rather than appearing greyed: they are
   * closed for every hall, so there is nothing hall-specific to say about them.
   */
  const liveAvailabilityDays = useMemo<AvailabilityDay[]>(() => {
    if (!availabilityHallId) return [];

    const hall = (calendarData?.halls ?? []).find(
      (option) => option.id === availabilityHallId
    );
    const hallDailyEventLimit = hall?.dailyEventLimit ?? dailyEventLimit;
    const hallBookings = bookings.filter(
      (booking) => booking.hallId === availabilityHallId
    );

    return availabilityRangeDays
      .map((day) => {
        const currentDateKey = dateKey(day);
        const dayBookings = hallBookings.filter(
          (booking) => booking.dateKey === currentDateKey
        );

        return {
          dateKey: currentDateKey,
          dateLabel: availabilityDateFormatter.format(day),
          day: day.getDate(),
          dayName: availabilityDayNameFormatter.format(day),
          hebrewDate: formatHebrewDateWithoutYear(day),
          roomsAvailable: Math.max(0, hallDailyEventLimit - dayBookings.length),
          status: hallDayStatus({
            // Only the ranges that close this hall. A null hall is a range from
            // before ranges named one, which closed the whole venue.
            isBlocked: (calendarData?.blockedDates ?? []).some(
              (range) =>
                (range.hallId === null ||
                  range.hallId === availabilityHallId) &&
                currentDateKey >= dateKeyFromIso(range.startDate) &&
                currentDateKey <= dateKeyFromIso(range.endDate)
            ),
            holdCount: dayBookings.filter(
              (booking) => booking.status === "hold"
            ).length,
            activeCount: dayBookings.length,
            dailyEventLimit: hallDailyEventLimit
          })
        };
      })
      .filter((day) => day.status !== "blocked");
  }, [
    availabilityHallId,
    availabilityRangeDays,
    bookings,
    dailyEventLimit,
    calendarData?.blockedDates,
    calendarData?.halls
  ]);

  const filteredBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        const matchesHall = hallFilter === "all" || booking.hall === hallFilter;

        const matchesStatus =
          statusFilter === "all" || booking.status === statusFilter;

        const matchesType = typeFilter === "all" || booking.type === typeFilter;

        return matchesHall && matchesStatus && matchesType;
      }),
    [bookings, hallFilter, statusFilter, typeFilter]
  );

  const readDay = useMemo(
    () =>
      createCalendarDayReader({
        bookings,
        filteredBookings,
        halls: calendarData?.halls ?? [],
        blockedDates: calendarData?.blockedDates ?? [],
        dailyEventLimit,
        selectedDate,
        todayKey: dateKey(today),
        canCreateEvent
      }),
    [
      bookings,
      canCreateEvent,
      dailyEventLimit,
      calendarData?.blockedDates,
      calendarData?.halls,
      filteredBookings,
      selectedDate,
      today
    ]
  );
  const monthDays = useMemo(
    () =>
      calendarGridDays.map((calendarDay) =>
        readDay(calendarDay.date, calendarDay.currentMonth)
      ),
    [calendarGridDays, readDay]
  );
  // Anchored on the selected day rather than on the month, because a week is
  // what the user steps through in this view - and `selectDate` keeps the month
  // pointed at it, so the week always sits inside the range already fetched.
  const weekDaysInView = useMemo(
    () =>
      weekDates(selectedDateValue, weekStartsOn).map((date) => readDay(date)),
    [readDay, selectedDateValue, weekStartsOn]
  );
  const agendaDays = useMemo(
    () =>
      monthDays
        .filter((day) => day.inView)
        .sort((first, second) => first.dateKey.localeCompare(second.dateKey)),
    [monthDays]
  );

  const selectedBookings = useMemo(
    () => bookings.filter((booking) => booking.dateKey === selectedDate),
    [bookings, selectedDate]
  );
  const hallAvailability = useMemo(
    () =>
      (calendarData?.halls ?? []).map((hall) => {
        const limit = hall.dailyEventLimit ?? dailyEventLimit;
        const used = selectedBookings.filter(
          (booking) => booking.hall === hall.name
        ).length;

        return {
          id: hall.id,
          name: hall.name,
          limit,
          used,
          isFull: used >= limit,
          usesDefaultLimit: hall.dailyEventLimit === null
        };
      }),
    [dailyEventLimit, calendarData?.halls, selectedBookings]
  );
  const selectedDateIsBlocked = (calendarData?.blockedDates ?? []).some(
    (range) =>
      selectedDate >= dateKeyFromIso(range.startDate) &&
      selectedDate <= dateKeyFromIso(range.endDate)
  );
  // A past day can still be selected - the schedule that ran on it is worth
  // reading - but nothing new is booked onto it, so the buttons that open the
  // form go away with the day's + button.
  const selectedDateIsPast = selectedDate < dateKey(today);
  const canBookSelectedDate =
    canCreateEvent &&
    !selectedDateIsPast &&
    !selectedDateIsBlocked &&
    hallAvailability.some((hall) => !hall.isFull);

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(visibleMonth);
  const weekRangeLabel = `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(weekDaysInView[0].date)} – ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(weekDaysInView[6].date)}`;
  const periodLabel = calendarView === "week" ? weekRangeLabel : monthLabel;
  const calendarViewHeading =
    calendarView === "week"
      ? "Week Calendar"
      : calendarView === "agenda"
        ? "Agenda"
        : "Month Calendar";
  const selectedDateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(selectedDateValue);
  const rangeDateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const availabilityStartDateLabel = rangeDateFormatter.format(
    availabilityRange.startDate
  );
  const availabilityEndDateLabel = rangeDateFormatter.format(
    availabilityRange.endDate
  );

  function selectDate(date: Date) {
    setSelectedDateValue(date);
    setVisibleMonth(startOfMonth(date));
  }

  function openBookingForDate(date: Date) {
    selectDate(date);
    setIsNewBookingOpen(true);
  }

  function moveMonth(amount: number) {
    const nextMonth = addMonths(visibleMonth, amount);
    setVisibleMonth(nextMonth);
    setSelectedDateValue(nextMonth);
  }

  // One pair of arrows for all three views, stepping by whatever the view is
  // measured in. Week steps through `selectDate`, which drags the visible month
  // along with it - the calendar query is bounded by that month, so a week that
  // crossed into the next one without it would ask the grid to draw bookings
  // the page never fetched.
  function movePeriod(amount: number) {
    if (calendarView === "week") {
      selectDate(addDays(selectedDateValue, 7 * amount));
      return;
    }
    moveMonth(amount);
  }

  function goToToday() {
    setVisibleMonth(startOfMonth(today));
    setSelectedDateValue(today);
  }

  return (
    <div className="flex h-dvh min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      {/*
        Search and Today notes are dropped here: the calendar has its own hall,
        status and type filters below, and the day cells themselves are where a
        booking is found. New booking stays.
      */}
      <DashboardTopbar
        title="Calendar"
        subtitle="Review hall availability, bookings, holds, and fully booked dates."
        onNewBooking={
          canBookSelectedDate ? () => setIsNewBookingOpen(true) : undefined
        }
        showSearch={false}
        showTodayNotesAction={false}
      />

      {/*
        Named, because the sidebar is a navigation landmark too and one of its
        entries is also called "Settings". Two unnamed navs leave a screen reader
        - and anything else looking a control up by its name - unable to say
        which "Settings" it found.
      */}
      <nav
        aria-label="Calendar views"
        className="mt-2 shrink-0 overflow-hidden border-b border-t border-[#d8dde5] bg-white px-0 sm:px-5 lg:mt-0 lg:border-t-0"
      >
        <div className="grid w-full min-w-0 grid-cols-3 sm:flex sm:min-w-max sm:gap-2">
          <button
            className={`flex h-12 min-w-0 items-center justify-center gap-1 whitespace-nowrap border-b-3 px-1 text-xs font-black sm:gap-2 sm:px-2 sm:text-sm ${activeTab === "calendar" ? "border-[#1f4d73] text-[#17202a]" : "border-transparent text-[#516071]"}`}
            onClick={(event) => {
              setActiveTab("calendar");
              centerMobileTab(event.currentTarget);
            }}
            type="button"
          >
            <CalendarIcon className="hidden h-4 w-4 sm:block" />
            Calendar
          </button>

          <button
            className={`flex h-12 min-w-0 items-center justify-center gap-1 whitespace-nowrap border-b-3 px-1 text-xs font-black sm:gap-2 sm:px-2 sm:text-sm ${activeTab === "availability" ? "border-[#1f4d73] text-[#17202a]" : "border-transparent text-[#516071]"}`}
            onClick={(event) => {
              setActiveTab("availability");
              centerMobileTab(event.currentTarget);
            }}
            type="button"
          >
            <BuildingIcon className="hidden h-4 w-4 sm:block" />
            Availability
          </button>

          <button
            className={`flex h-12 min-w-0 items-center justify-center gap-1 whitespace-nowrap border-b-3 px-1 text-xs font-black sm:gap-2 sm:px-2 sm:text-sm ${activeTab === "settings" ? "border-[#1f4d73] text-[#17202a]" : "border-transparent text-[#516071]"}`}
            onClick={(event) => {
              setActiveTab("settings");
              centerMobileTab(event.currentTarget);
            }}
            type="button"
          >
            <SettingsIcon className="hidden h-4 w-4 sm:block" />
            Settings
          </button>
        </div>
      </nav>

      {bookingSuccessMessage ? (
        <div
          aria-live="polite"
          className="mx-2 mt-2 shrink-0 rounded-lg border border-[#a9dfc9] bg-[#effaf5] px-4 py-2 text-sm font-bold text-[#147653] sm:mx-4"
          role="status"
        >
          {bookingSuccessMessage}
        </div>
      ) : null}

      <main className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-2 sm:p-4">
        {/*
          Only the very first load owns the whole main area. Once there is a
          page on screen, a period being fetched is the business of the panels
          that draw bookings, not of the page around them.
        */}
        {!hasLoadedOnce ? (
          <div className="flex h-full min-h-80 items-center justify-center">
            <AsyncState
              error={eventsQuery.error}
              isLoading={eventsQuery.isLoading}
              onRetry={eventsQuery.refetch}
            />
          </div>
        ) : activeTab === "availability" ? (
          <AvailabilityView
            blockDateError={createBlockedDateMutation.error}
            canManageBlockedDates={canUpdateSettings}
            days={liveAvailabilityDays}
            isLoadingDays={isPeriodLoading}
            endDate={availabilityRange.endDate}
            endDateLabel={availabilityEndDateLabel}
            halls={(calendarData?.halls ?? []).map((hall) => ({
              id: hall.id,
              name: hall.name
            }))}
            onHallChange={setAvailabilityHallId}
            onNewBooking={
              canBookSelectedDate ? () => setIsNewBookingOpen(true) : undefined
            }
            // Closes the hall the tab is currently reading, which is the only
            // hall these rows describe. There is always one: the list does not
            // render until a hall is picked.
            onRemoveDay={async (removedDateKey) => {
              await createBlockedDateMutation.mutate({
                hallId: availabilityHallId,
                startDate: removedDateKey,
                endDate: removedDateKey,
                label: `Blocked ${removedDateKey}`
              });
              await eventsQuery.refetch();
            }}
            onRangeChange={setAvailabilityRange}
            selectedHallId={availabilityHallId}
            showHebrewDate={showHebrewDate}
            startDate={availabilityRange.startDate}
            startDateLabel={availabilityStartDateLabel}
            weekStartsOn={weekStartsOn}
          />
        ) : activeTab === "settings" ? (
          <CalendarSettingsView
            blockedDateMutationError={
              createBlockedDateMutation.error ?? removeBlockedDateMutation.error
            }
            blockedDates={calendarData?.blockedDates ?? []}
            canUpdateSettings={canUpdateSettings}
            dailyEventLimit={dailyEventLimit}
            hallAvailability={hallAvailability}
            isMutatingBlockedDate={
              createBlockedDateMutation.isPending ||
              removeBlockedDateMutation.isPending
            }
            isSavingDailyEventLimit={settingsMutation.isPending}
            onSaveDailyEventLimit={async (nextLimit) => {
              await settingsMutation.mutate({ dailyEventLimit: nextLimit });
              await eventsQuery.refetch();
            }}
            onAddBlockedRange={async (range, hallId) => {
              const startDate = dateKey(range.startDate);
              const endDate = dateKey(range.endDate);
              await createBlockedDateMutation.mutate({
                hallId,
                startDate,
                endDate,
                label:
                  startDate === endDate
                    ? `Blocked ${startDate}`
                    : `Blocked ${startDate} to ${endDate}`
              });
              await eventsQuery.refetch();
            }}
            onRemoveBlockedRange={async (id) => {
              await removeBlockedDateMutation.mutate({ id });
              await eventsQuery.refetch();
            }}
            saveDailyEventLimitError={settingsMutation.error}
            weekStartsOn={weekStartsOn}
          />
        ) : (
          <div className="mx-auto grid w-full min-w-0 max-w-[1800px] gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="dashboard-panel-enter min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
              <div className="flex flex-col gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon />
                    <h1 className="text-sm font-black">
                      {calendarViewHeading}
                    </h1>
                  </div>

                  <p className="mt-1 text-xs text-[#6a7483]">
                    {calendarView === "agenda"
                      ? "Every booked day this month, in date order."
                      : clickAnywhereToAdd
                        ? "Click any bookable day to start a booking on that date."
                        : "Click a day to review the schedule, or + to book it."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <StatusDot color="bg-[#178151]" label="Confirmed" />
                  <StatusDot color="bg-[#b66b00]" label="Hold" />
                  <StatusDot color="bg-[#5649dd]" label="School" />
                  <StatusDot color="bg-[#aab5c3]" label="Fully booked" />
                  {showAvailability ? (
                    <StatusDot color="bg-[#087047]" label="Open slots" />
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-black">{periodLabel}</h2>

                  {/*
                    Arrows rather than words, so the period controls stay a
                    compact cluster at the end of the header instead of
                    stretching across it on a narrow screen. The labels move to
                    aria-label, which is what the tests and a screen reader read
                    anyway.
                  */}
                  <div className="flex items-center gap-2">
                    <button
                      aria-label={
                        calendarView === "week"
                          ? "Show previous week"
                          : "Show previous month"
                      }
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#b9c2cf] text-[#516071] hover:bg-[#eef4fa]"
                      onClick={() => movePeriod(-1)}
                      type="button"
                    >
                      <ChevronLeftIcon />
                    </button>

                    <button
                      className="h-9 rounded-lg border border-[#b9c2cf] px-3 text-xs font-black hover:bg-[#eef4fa]"
                      onClick={goToToday}
                      type="button"
                    >
                      Today
                    </button>

                    <button
                      aria-label={
                        calendarView === "week"
                          ? "Show next week"
                          : "Show next month"
                      }
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#b9c2cf] text-[#516071] hover:bg-[#eef4fa]"
                      onClick={() => movePeriod(1)}
                      type="button"
                    >
                      <ChevronRightIcon />
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <select
                    className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
                    name="calendarHallFilter"
                    onChange={(event) => setHallFilter(event.target.value)}
                    value={hallFilter}
                  >
                    <option value="all">All halls</option>
                    {halls.map((hall) => (
                      <option key={hall} value={hall}>
                        {hall}
                      </option>
                    ))}
                  </select>

                  <select
                    className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
                    name="calendarStatusFilter"
                    onChange={(event) => setStatusFilter(event.target.value)}
                    value={statusFilter}
                  >
                    <option value="all">All statuses</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="hold">Hold</option>
                    <option value="school">School</option>
                  </select>

                  <select
                    className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
                    name="calendarTypeFilter"
                    onChange={(event) => setTypeFilter(event.target.value)}
                    value={typeFilter}
                  >
                    <option value="all">All types</option>
                    {(calendarData?.eventTypes ?? []).map((eventType) => (
                      <option key={eventType.id} value={eventType.name}>
                        {eventType.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isPeriodLoading ? (
                <CalendarBodySkeleton
                  view={calendarView}
                  weekDayLabels={gridWeekDays}
                />
              ) : periodError ? (
                <div className="px-3 pb-3">
                  <AsyncState
                    error={periodError}
                    onRetry={eventsQuery.refetch}
                  />
                </div>
              ) : calendarView === "agenda" ? (
                <CalendarAgendaView
                  days={agendaDays}
                  emptyMessage={`Nothing is booked in ${monthLabel}${hallFilter !== "all" || statusFilter !== "all" || typeFilter !== "all" ? " that matches the current filters" : ""}.`}
                  onBookDate={openBookingForDate}
                  onSelectDate={selectDate}
                  showAvailability={showAvailability}
                  showHebrewDate={showHebrewDate}
                />
              ) : calendarView === "week" ? (
                <CalendarWeekView
                  clickAnywhereToAdd={clickAnywhereToAdd}
                  days={weekDaysInView}
                  onBookDate={openBookingForDate}
                  onSelectDate={selectDate}
                  showAvailability={showAvailability}
                  showHebrewDate={showHebrewDate}
                />
              ) : (
                <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain px-3 pb-3">
                  <div className="min-w-212.5 overflow-hidden rounded-xl border border-[#d8dde5]">
                    <div className="grid grid-cols-7 bg-[#fbfcfd]">
                      {gridWeekDays.map((day) => (
                        <div
                          key={day}
                          className="border-r border-[#d8dde5] py-3 text-center text-[10px] font-black tracking-wider text-[#6a7483] last:border-r-0"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7">
                      {monthDays.map((calendarDay) => {
                        const bookOnDayClick =
                          clickAnywhereToAdd && calendarDay.canBook;
                        const dateLabel = calendarDay.dateLabel;

                        return (
                          <div
                            key={calendarDay.dateKey}
                            className={`relative min-h-32 border-r border-t border-[#d8dde5] p-2 text-left transition nth-[7n]:border-r-0 ${calendarDay.inView ? "bg-white hover:bg-[#f8fbfd]" : "bg-[#f8f9fb] text-[#94a1b1] hover:bg-[#eef2f6]"} ${calendarDay.isToday ? "z-2 ring-3 ring-inset ring-[#1f4d73]" : calendarDay.isSelected ? "z-1 ring-2 ring-inset ring-[#a8ccec]" : ""}`}
                          >
                            <button
                              aria-label={
                                bookOnDayClick
                                  ? `Book ${dateLabel}`
                                  : `Select ${dateLabel}`
                              }
                              className="absolute inset-0 z-0"
                              onClick={() =>
                                bookOnDayClick
                                  ? openBookingForDate(calendarDay.date)
                                  : selectDate(calendarDay.date)
                              }
                              title={
                                bookOnDayClick ? `Book ${dateLabel}` : undefined
                              }
                              type="button"
                            />

                            <div className="pointer-events-none relative z-1 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                              <strong className="text-sm">
                                {calendarDay.day}
                              </strong>
                              {showHebrewDate ? (
                                <span
                                  className="justify-self-center text-center text-[9px] font-semibold"
                                  dir="rtl"
                                >
                                  {calendarDay.hebrewDate}
                                </span>
                              ) : null}
                            </div>

                            {calendarDay.canBook && !clickAnywhereToAdd ? (
                              <button
                                aria-label={`Book ${dateLabel}`}
                                className="absolute right-2 top-2 z-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#b9c2cf] bg-white text-sm font-black leading-none text-[#1f4d73] shadow-sm transition hover:border-[#1f4d73] hover:bg-[#eef4fa] focus:outline-none focus:ring-2 focus:ring-[#a8ccec]"
                                onClick={() =>
                                  openBookingForDate(calendarDay.date)
                                }
                                title={`Book ${dateLabel}`}
                                type="button"
                              >
                                +
                              </button>
                            ) : null}

                            <div className="relative z-1 mt-2 space-y-1">
                              {calendarDay.bookings.map((booking) => (
                                <EventPill
                                  booking={booking}
                                  key={booking.id}
                                  onSelect={() => selectDate(calendarDay.date)}
                                />
                              ))}
                            </div>

                            {calendarDay.fullyBooked ? (
                              <span className="pointer-events-none absolute bottom-2 right-2 z-1 text-[9px] font-black text-[#516071]">
                                Fully booked
                              </span>
                            ) : null}
                            {calendarDay.isBlocked ? (
                              <span className="pointer-events-none absolute bottom-2 right-2 z-1 text-[9px] font-black text-[#b42318]">
                                Blocked
                              </span>
                            ) : null}
                            {showAvailability &&
                            !calendarDay.isBlocked &&
                            hasOpenAvailability(calendarDay) ? (
                              <span className="pointer-events-none absolute bottom-2 right-2 z-1 text-[9px] font-black text-[#087047]">
                                {calendarDay.openSlots} open
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <aside className="dashboard-panel-enter self-start overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8dde5] p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon />
                    <h2 className="text-sm font-black">{selectedDateLabel}</h2>
                  </div>

                  <p className="mt-1 text-xs text-[#6a7483]">
                    {isPeriodLoading
                      ? "Counting bookings on this date…"
                      : `${selectedBookings.length} ${selectedBookings.length === 1 ? "booking" : "bookings"} on this date`}
                  </p>
                </div>

                {canBookSelectedDate ? (
                  <button
                    className="h-9 shrink-0 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f]"
                    onClick={() => setIsNewBookingOpen(true)}
                    type="button"
                  >
                    Book date
                  </button>
                ) : null}
              </div>

              {isPeriodLoading ? (
                <CalendarSelectedDaySkeleton />
              ) : (
                <div className="space-y-3 p-3">
                  {selectedBookings.map((booking) => (
                    <article
                      className="dashboard-hover-card rounded-xl border border-[#1f4d73] bg-[#eef4fa] p-3"
                      key={booking.id}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8dde5] bg-white text-[#1f4d73]">
                          ✓
                        </span>

                        <div className="min-w-0 flex-1">
                          <strong className="block truncate text-sm">
                            {booking.title}
                          </strong>

                          <p className="mt-1 truncate text-xs text-[#6a7483]">
                            {booking.hall} · {booking.type}
                            {booking.packageName
                              ? ` · ${booking.packageName}`
                              : ""}
                          </p>
                        </div>

                        <span
                          className={`rounded-full border bg-white px-2 py-1 text-[9px] font-black ${
                            booking.status === "confirmed"
                              ? "border-[#b9ddcf] text-[#178151]"
                              : booking.status === "school"
                                ? "border-[#c9c4fa] text-[#5649dd]"
                                : "border-[#efcf98] text-[#995700]"
                          }`}
                        >
                          {booking.status === "confirmed"
                            ? "Confirmed"
                            : booking.status === "school"
                              ? "School"
                              : "Hold"}
                        </span>
                      </div>
                    </article>
                  ))}

                  <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
                    <div className="border-b border-[#d8dde5] px-3 py-2">
                      <h3 className="text-sm font-black">Hall availability</h3>
                      <p className="mt-1 text-[10px] font-medium text-[#6a7483]">
                        {selectedDateLabel}. Limits come from each hall.
                      </p>
                    </div>

                    <div className="divide-y divide-[#e5eaf0]">
                      {hallAvailability.map((hall) => (
                        <div
                          className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2"
                          key={hall.id}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-[#17202a]">
                              {hall.name}
                            </p>
                            {hall.usesDefaultLimit ? (
                              <p className="mt-0.5 text-[9px] font-medium text-[#6a7483]">
                                Uses Calendar default
                              </p>
                            ) : null}
                          </div>

                          <span
                            className={`rounded-full px-2 py-1 text-[9px] font-black ${
                              hall.isFull
                                ? "bg-[#fff0ed] text-[#b42318]"
                                : "bg-[#e9f8f0] text-[#087047]"
                            }`}
                          >
                            {hall.isFull ? "Full" : "Available"}
                          </span>

                          <span className="text-xs font-black tabular-nums text-[#17202a]">
                            {hall.used} / {hall.limit}
                          </span>
                        </div>
                      ))}

                      {hallAvailability.length === 0 ? (
                        <p className="px-3 py-4 text-xs font-medium text-[#6a7483]">
                          No bookable halls are saved yet. Add halls in
                          Settings.
                        </p>
                      ) : null}
                    </div>
                  </section>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>

      <CalendarBookingDialog
        eventTypes={calendarData?.eventTypes ?? []}
        halls={calendarData?.halls ?? []}
        onClose={() => setIsNewBookingOpen(false)}
        onEventTypesChanged={async () => {
          await eventsQuery.refetch();
        }}
        onSaved={async () => {
          await eventsQuery.refetch();
          setBookingSuccessMessage("Booking saved and added to the calendar.");
        }}
        open={isNewBookingOpen}
        selectedDate={selectedDate}
      />
    </div>
  );
}
