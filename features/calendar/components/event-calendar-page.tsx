"use client";

import { useMemo, useState } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { centerMobileTab } from "@/lib/ui/center-mobile-tab";
import { formatHebrewDateWithoutYear } from "@/lib/dates/hebrew-date";
import { TodayNotesDrawer } from "@/components/shared/today-notes-drawer";
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
  startOfMonth
} from "@/lib/dates/calendar-date";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { useAccess } from "@/features/dashboard/hooks/use-dashboard-permission";

import { AvailabilityView } from "@/features/calendar/components/calendar-availability-tab";
import { EventPill } from "@/features/calendar/components/calendar-event-pill";
import { CalendarSettingsView } from "@/features/calendar/components/calendar-settings-tab";
import {
  BuildingIcon,
  CalendarIcon,
  SettingsIcon,
  StatusDot,
  weekDays,
  type AvailabilityDay,
  type CalendarBooking,
  type EventsResponse
} from "@/features/calendar/components/calendar-shared";
export function EventCalendarPage() {
  const settingsMutation = useAuthenticatedMutation<
    { dailyEventLimit: number },
    unknown
  >("/api/settings", "PATCH");
  const createBlockedDateMutation = useAuthenticatedMutation<
    { startDate: string; endDate: string; label: string },
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
  const [searchQuery, setSearchQuery] = useDashboardPageSearch("Calendar");
  const [hallFilter, setHallFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const canCreateEvent = useAccess("booking.create");
  const canUpdateSettings = useAccess("settings.update");
  const calendarGridDays = useMemo(
    () => buildMonthGrid(visibleMonth),
    [visibleMonth]
  );
  const calendarQueryRange = useMemo(() => {
    const dates = [
      calendarGridDays[0].date,
      calendarGridDays[calendarGridDays.length - 1].date,
      availabilityRange.startDate,
      availabilityRange.endDate
    ];
    return {
      startDate: new Date(Math.min(...dates.map((date) => date.getTime()))),
      endDate: new Date(Math.max(...dates.map((date) => date.getTime())))
    };
  }, [availabilityRange, calendarGridDays]);
  const calendarQueryUrl = `/api/calendar?startDate=${dateKey(calendarQueryRange.startDate)}&endDate=${dateKey(calendarQueryRange.endDate)}`;
  const eventsQuery = useAuthenticatedQuery<EventsResponse>(calendarQueryUrl);
  const dailyEventLimit =
    eventsQuery.data?.calendarSettings?.dailyEventLimit ?? 2;
  const dailyHallCapacity = useMemo(() => {
    const halls = eventsQuery.data?.halls ?? [];

    if (halls.length === 0) return dailyEventLimit;

    return halls.reduce(
      (total, hall) => total + (hall.dailyEventLimit ?? dailyEventLimit),
      0
    );
  }, [dailyEventLimit, eventsQuery.data?.halls]);
  const bookings = useMemo<CalendarBooking[]>(
    () =>
      (eventsQuery.data?.events ?? []).map((event) => {
        const normalizedStatus = event.bookingStatus.toLowerCase();
        const isSchoolEvent = event.eventType?.toLowerCase().includes("school");

        return {
          id: event.id,
          dateKey: dateKeyFromIso(event.eventDate),
          title: event.clientName,
          hall: event.hall.name,
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
    [eventsQuery.data]
  );
  const halls = useMemo(
    () => (eventsQuery.data?.halls ?? []).map((hall) => hall.name),
    [eventsQuery.data]
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
  const liveAvailabilityDays = useMemo<AvailabilityDay[]>(
    () =>
      availabilityRangeDays
        .map((day) => {
          const currentDateKey = dateKey(day);
          const dayBookings = bookings.filter(
            (booking) => booking.dateKey === currentDateKey
          );
          return {
            dateKey: currentDateKey,
            dateLabel: new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric"
            }).format(day),
            day: day.getDate(),
            dayName: new Intl.DateTimeFormat("en-US", {
              weekday: "short"
            }).format(day),
            hebrewDate: formatHebrewDateWithoutYear(day),
            roomsAvailable: Math.max(0, dailyHallCapacity - dayBookings.length),
            status: dayBookings.some((booking) => booking.status === "hold")
              ? ("hold" as const)
              : ("available" as const)
          };
        })
        .filter(
          (day) =>
            !(eventsQuery.data?.blockedDates ?? []).some(
              (range) =>
                day.dateKey >= dateKeyFromIso(range.startDate) &&
                day.dateKey <= dateKeyFromIso(range.endDate)
            )
        ),
    [
      availabilityRangeDays,
      bookings,
      dailyHallCapacity,
      eventsQuery.data?.blockedDates
    ]
  );

  const filteredBookings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesSearch =
        !query ||
        [booking.title, booking.hall, booking.type, booking.packageName ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesHall = hallFilter === "all" || booking.hall === hallFilter;

      const matchesStatus =
        statusFilter === "all" || booking.status === statusFilter;

      const matchesType = typeFilter === "all" || booking.type === typeFilter;

      return matchesSearch && matchesHall && matchesStatus && matchesType;
    });
  }, [bookings, hallFilter, searchQuery, statusFilter, typeFilter]);

  const selectedBookings = useMemo(
    () => bookings.filter((booking) => booking.dateKey === selectedDate),
    [bookings, selectedDate]
  );
  const hallAvailability = useMemo(
    () =>
      (eventsQuery.data?.halls ?? []).map((hall) => {
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
    [dailyEventLimit, eventsQuery.data?.halls, selectedBookings]
  );
  const selectedDateIsBlocked = (eventsQuery.data?.blockedDates ?? []).some(
    (range) =>
      selectedDate >= dateKeyFromIso(range.startDate) &&
      selectedDate <= dateKeyFromIso(range.endDate)
  );
  const canBookSelectedDate =
    canCreateEvent &&
    !selectedDateIsBlocked &&
    hallAvailability.some((hall) => !hall.isFull);

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(visibleMonth);
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

  function goToToday() {
    setVisibleMonth(startOfMonth(today));
    setSelectedDateValue(today);
  }

  return (
    <div className="flex h-dvh min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Calendar"
        subtitle="Review hall availability, bookings, holds, and fully booked dates."
        onNewBooking={
          canBookSelectedDate ? () => setIsNewBookingOpen(true) : undefined
        }
        onTodayNotes={() => setIsTodayNotesOpen(true)}
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
            Month Calendar
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

      <main className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-2 sm:p-4">
        {eventsQuery.isLoading || eventsQuery.error ? (
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
            endDate={availabilityRange.endDate}
            endDateLabel={availabilityEndDateLabel}
            onNewBooking={
              canBookSelectedDate ? () => setIsNewBookingOpen(true) : undefined
            }
            onRemoveDay={async (removedDateKey) => {
              await createBlockedDateMutation.mutate({
                startDate: removedDateKey,
                endDate: removedDateKey,
                label: `Blocked ${removedDateKey}`
              });
              await eventsQuery.refetch();
            }}
            onRangeChange={setAvailabilityRange}
            startDate={availabilityRange.startDate}
            startDateLabel={availabilityStartDateLabel}
          />
        ) : activeTab === "settings" ? (
          <CalendarSettingsView
            blockedDateMutationError={
              createBlockedDateMutation.error ?? removeBlockedDateMutation.error
            }
            blockedDates={eventsQuery.data?.blockedDates ?? []}
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
            onAddBlockedRange={async (range) => {
              const startDate = dateKey(range.startDate);
              const endDate = dateKey(range.endDate);
              await createBlockedDateMutation.mutate({
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
          />
        ) : (
          <div className="mx-auto grid w-full min-w-0 max-w-[1800px] gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="dashboard-panel-enter min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
              <div className="flex flex-col gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon />
                    <h1 className="text-sm font-black">Month Calendar</h1>
                  </div>

                  <p className="mt-1 text-xs text-[#6a7483]">
                    Click a day to book or review the schedule.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <StatusDot color="bg-[#178151]" label="Confirmed" />
                  <StatusDot color="bg-[#b66b00]" label="Hold" />
                  <StatusDot color="bg-[#5649dd]" label="School" />
                  <StatusDot color="bg-[#aab5c3]" label="Fully booked" />
                </div>
              </div>

              <div className="flex flex-col gap-3 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-black">{monthLabel}</h2>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      aria-label="Show previous month"
                      className="h-9 rounded-lg border border-[#b9c2cf] px-3 text-xs font-black hover:bg-[#eef4fa]"
                      onClick={() => moveMonth(-1)}
                      type="button"
                    >
                      Previous
                    </button>

                    <button
                      className="h-9 rounded-lg border border-[#b9c2cf] px-3 text-xs font-black hover:bg-[#eef4fa]"
                      onClick={goToToday}
                      type="button"
                    >
                      Today
                    </button>

                    <button
                      aria-label="Show next month"
                      className="h-9 rounded-lg border border-[#b9c2cf] px-3 text-xs font-black hover:bg-[#eef4fa]"
                      onClick={() => moveMonth(1)}
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-[minmax(190px,2fr)_repeat(3,minmax(120px,1fr))]">
                  <input
                    className="h-10 min-w-0 rounded-lg border border-[#b9c2cf] px-3 text-sm outline-none focus:border-[#1f4d73]"
                    name="calendarSearch"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search calendar"
                    type="search"
                    value={searchQuery}
                  />

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
                    {(eventsQuery.data?.eventTypes ?? []).map((eventType) => (
                      <option key={eventType.id} value={eventType.name}>
                        {eventType.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain px-3 pb-3">
                <div className="min-w-212.5 overflow-hidden rounded-xl border border-[#d8dde5]">
                  <div className="grid grid-cols-7 bg-[#fbfcfd]">
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className="border-r border-[#d8dde5] py-3 text-center text-[10px] font-black tracking-wider text-[#6a7483] last:border-r-0"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {calendarGridDays.map((calendarDay) => {
                      const dayBookings = filteredBookings.filter(
                        (booking) => booking.dateKey === calendarDay.dateKey
                      );
                      const allDayBookings = bookings.filter(
                        (booking) => booking.dateKey === calendarDay.dateKey
                      );
                      const isSelected = calendarDay.dateKey === selectedDate;
                      const isToday = calendarDay.dateKey === dateKey(today);
                      const isBlocked = (
                        eventsQuery.data?.blockedDates ?? []
                      ).some(
                        (range) =>
                          calendarDay.dateKey >=
                            dateKeyFromIso(range.startDate) &&
                          calendarDay.dateKey <= dateKeyFromIso(range.endDate)
                      );
                      const fullyBooked =
                        calendarDay.currentMonth &&
                        (eventsQuery.data?.halls ?? []).length > 0 &&
                        (eventsQuery.data?.halls ?? []).every((hall) => {
                          const limit = hall.dailyEventLimit ?? dailyEventLimit;
                          return (
                            allDayBookings.filter(
                              (booking) => booking.hall === hall.name
                            ).length >= limit
                          );
                        });
                      const dateLabel = new Intl.DateTimeFormat("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric"
                      }).format(calendarDay.date);

                      return (
                        <div
                          key={calendarDay.dateKey}
                          className={`relative min-h-32 border-r border-t border-[#d8dde5] p-2 text-left transition nth-[7n]:border-r-0 ${calendarDay.currentMonth ? "bg-white hover:bg-[#f8fbfd]" : "bg-[#f8f9fb] text-[#94a1b1] hover:bg-[#eef2f6]"} ${isToday ? "z-2 ring-3 ring-inset ring-[#1f4d73]" : isSelected ? "z-1 ring-2 ring-inset ring-[#a8ccec]" : ""}`}
                        >
                          <button
                            aria-label={`Select ${dateLabel}`}
                            className="absolute inset-0 z-0"
                            onClick={() => selectDate(calendarDay.date)}
                            type="button"
                          />

                          <div className="pointer-events-none relative z-1 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                            <strong className="text-sm">
                              {calendarDay.day}
                            </strong>
                            <span
                              className="justify-self-center text-center text-[9px] font-semibold"
                              dir="rtl"
                            >
                              {formatHebrewDateWithoutYear(calendarDay.date)}
                            </span>
                          </div>

                          {calendarDay.currentMonth &&
                          !fullyBooked &&
                          !isBlocked &&
                          canCreateEvent ? (
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
                            {dayBookings.map((booking) => (
                              <EventPill
                                booking={booking}
                                key={booking.id}
                                onSelect={() => selectDate(calendarDay.date)}
                              />
                            ))}
                          </div>

                          {fullyBooked ? (
                            <span className="pointer-events-none absolute bottom-2 right-2 z-1 text-[9px] font-black text-[#516071]">
                              Fully booked
                            </span>
                          ) : null}
                          {isBlocked ? (
                            <span className="pointer-events-none absolute bottom-2 right-2 z-1 text-[9px] font-black text-[#b42318]">
                              Blocked
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <aside className="dashboard-panel-enter self-start overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8dde5] p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon />
                    <h2 className="text-sm font-black">{selectedDateLabel}</h2>
                  </div>

                  <p className="mt-1 text-xs text-[#6a7483]">
                    {selectedBookings.length}{" "}
                    {selectedBookings.length === 1 ? "booking" : "bookings"} on
                    this date
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
                        No bookable halls are saved yet. Add halls in Settings.
                      </p>
                    ) : null}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        )}
      </main>

      <CalendarBookingDialog
        eventTypes={eventsQuery.data?.eventTypes ?? []}
        halls={eventsQuery.data?.halls ?? []}
        onClose={() => setIsNewBookingOpen(false)}
        onEventTypesChanged={async () => {
          await eventsQuery.refetch();
        }}
        onSaved={async () => {
          await eventsQuery.refetch();
        }}
        open={isNewBookingOpen}
        selectedDate={selectedDate}
      />
      <TodayNotesDrawer
        onClose={() => setIsTodayNotesOpen(false)}
        open={isTodayNotesOpen}
      />
    </div>
  );
}
