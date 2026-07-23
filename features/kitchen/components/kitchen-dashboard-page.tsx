"use client";

import { useMemo, useState } from "react";
import {
  AddKitchenEventDialog,
  type AddKitchenEventFormValues
} from "@/features/kitchen/forms/add-kitchen-event-dialog";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { TodayNotesDrawer } from "@/components/shared/today-notes-drawer";
import { NewBookingDialog } from "@/features/bookings/forms/new-booking-dialog";
import { AsyncState } from "@/components/ui/async-state";
import { addDays, dateKey, dateKeyFromIso, startOfDay, startOfWeek } from "@/lib/dates/calendar-date";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";

type KitchenView = "today" | "week" | "four-weeks";

type KitchenEvent = {
  id: string;
  category: string;
  title: string;
  portions: string;
  packageName: string;
  status?: string;
  statusType?: "hold" | "kitchen";
};

type KitchenDay = {
  dateKey: string;
  dayName: string;
  dateLabel: string;
  dayNumber: number;
  shabbos?: boolean;
  selected?: boolean;
  today?: boolean;
  events?: KitchenEvent[];
};

type KitchenResponse = {
  events: Array<{
    id: string;
    clientName: string;
    eventDate: string;
    eventType: string | null;
    eventStatus: string;
    packageName: string | null;
    couplesCount: number;
    menCount: number;
    ladiesCount: number;
    boysCount: number;
    girlsCount: number;
    kidsCount: number;
    hall: { name: string };
  }>;
  workers: Array<{ id: string; name: string }>;
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Shabbos"];

function kitchenViewInformation(activeView: KitchenView, anchorDate: Date) {
  const fullDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  const shortDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  });
  const rangeStart = activeView === "today" ? anchorDate : startOfWeek(anchorDate);
  const rangeEnd = addDays(rangeStart, activeView === "week" ? 6 : 27);

  return {
    heading:
      activeView === "today"
        ? fullDate.format(anchorDate)
        : `${activeView === "week" ? "This Week" : "4 Weeks"} · ${shortDate.format(rangeStart)} – ${shortDate.format(rangeEnd)}`,
    time: `Current time: ${new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date())}`
  };
}

function PlusButton({
  label,
  onClick
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#cbd5df] bg-[#f8fafc] text-sm font-black text-[#17202a] hover:bg-white"
      onClick={onClick}
      title={label}
      type="button"
    >
      +
    </button>
  );
}

function KitchenEventCard({
  compact = false,
  event
}: {
  compact?: boolean;
  event: KitchenEvent;
}) {
  const hold = event.statusType === "hold";

  if (compact) {
    return (
      <button
        className={`block w-full truncate border px-2 py-1 text-left text-xs font-black ${
          hold
            ? "border-[#f0a326] bg-[#fff5e4] text-[#914700]"
            : "border-[#16a267] bg-[#effcf5] text-[#006d3e]"
        }`}
        type="button"
      >
        {hold ? "HOLD" : "KITCHEN"} · {event.title}
      </button>
    );
  }

  return (
    <article
      className={`border border-dashed p-3 ${
        hold ? "border-[#f0a326] bg-[#fffaf1]" : "border-[#c8d6e3] bg-[#f8fafc]"
      }`}
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-[#34465b]">
        {event.category}
      </p>

      <h3 className="mt-1 text-sm font-black text-[#07162d]">{event.title}</h3>

      <p className="mt-1 text-xs font-bold text-[#41556c]">{event.portions}</p>

      <p className="mt-1 text-xs font-bold text-[#41556c]">
        {event.packageName}
      </p>

      {event.status ? (
        <span className="mt-3 inline-flex bg-[#ff7624] px-3 py-1 text-[10px] font-black uppercase text-white">
          {event.status}
        </span>
      ) : null}
    </article>
  );
}

function KitchenHeader({
  activeView,
  anchorDate,
  onChangeView,
  onNext,
  onPrevious
}: {
  activeView: KitchenView;
  anchorDate: Date;
  onChangeView: (view: KitchenView) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const information = kitchenViewInformation(activeView, anchorDate);

  const tabs: Array<{
    label: string;
    value: KitchenView;
  }> = [
    { label: "Today", value: "today" },
    { label: "This Week", value: "week" },
    { label: "4 Weeks", value: "four-weeks" }
  ];

  const previousButton = (compact = false) => (
    <button
      aria-label="Previous date range"
      className={`flex shrink-0 items-center justify-center bg-transparent text-[#07162d] hover:text-[#1f4d73] ${
        compact ? "h-10 w-10" : "h-11 w-9"
      }`}
      onClick={onPrevious}
      type="button"
    >
      <svg
        aria-hidden="true"
        className={compact ? "h-6 w-6" : "h-8 w-8"}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="m15 4-8 8 8 8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.5"
        />
      </svg>
    </button>
  );

  const nextButton = (compact = false) => (
    <button
      aria-label="Next date range"
      className={`flex shrink-0 items-center justify-center bg-transparent text-[#07162d] hover:text-[#1f4d73] ${
        compact ? "h-10 w-10" : "h-11 w-9"
      }`}
      onClick={onNext}
      type="button"
    >
      <svg
        aria-hidden="true"
        className={compact ? "h-6 w-6" : "h-8 w-8"}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="m9 4 8 8-8 8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.5"
        />
      </svg>
    </button>
  );

  const viewTabs = (compact = false) =>
    tabs.map((tab) => {
      const active = activeView === tab.value;

      return (
        <button
          className={`h-11 whitespace-nowrap border text-sm font-black ${
            compact ? "min-w-0 px-2" : "min-w-20 px-3 2xl:min-w-24 2xl:px-4"
          } ${
            active
              ? "border-2 border-black bg-[#ffc958] shadow-[inset_0_0_0_1px_white]"
              : "border-[#d6dde5] bg-white hover:bg-[#f6f8fa]"
          }`}
          key={tab.value}
          onClick={() => onChangeView(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      );
    });

  return (
    <header className="border-b border-[#929292] bg-[#b0b0b0] px-4 py-3 xl:py-4">
      <div className="xl:hidden">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1">
          {previousButton(true)}
          <h1
            className="min-w-0 whitespace-nowrap text-center text-[clamp(0.75rem,4vw,1.125rem)] font-black leading-tight text-[#07162d]"
            title={information.heading}
          >
            {information.heading}
          </h1>
          {nextButton(true)}
        </div>

        <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
          <strong className="min-w-0 flex-1 text-center text-base font-black leading-tight text-[#ffd45c]">
            {information.time}
          </strong>
          <span className="shrink-0 whitespace-nowrap bg-[#07162d] px-3 py-2.5 text-[10px] font-black uppercase tracking-wide text-white">
            Hall Manager
          </span>
        </div>

        <nav
          aria-label="Kitchen calendar views"
          className="mt-3 grid min-w-0 grid-cols-3 gap-2"
        >
          {viewTabs(true)}
        </nav>
      </div>

      <div className="hidden w-full min-w-0 items-center gap-2 xl:flex">
        {previousButton()}
        <h1
          className="min-w-0 max-w-[24rem] shrink truncate whitespace-nowrap text-xl font-black text-[#07162d] 2xl:text-2xl"
          title={information.heading}
        >
          {information.heading}
        </h1>

        {nextButton()}

        <strong className="min-w-26 flex-1 text-center text-lg font-black text-[#ffd45c] 2xl:min-w-32 2xl:text-xl">
          {information.time}
        </strong>

        <span className="shrink-0 whitespace-nowrap bg-[#07162d] px-3 py-3 text-xs font-black uppercase tracking-wide text-white">
          Hall Manager
        </span>

        <nav
          aria-label="Kitchen calendar views"
          className="flex min-w-0 shrink-0 gap-1"
        >
          {viewTabs()}
        </nav>
      </div>
    </header>
  );
}

function KitchenToolbar({
  onAddKitchenEvent,
  workersOnly,
  onWorkersOnlyChange
}: {
  onAddKitchenEvent: () => void;
  workersOnly: boolean;
  onWorkersOnlyChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_222px]">
      <button
        className="h-12 border border-dashed border-[#c4ccd5] bg-white px-6 text-left text-sm font-black text-[#64748b] hover:border-[#007dbb]"
        onClick={onAddKitchenEvent}
        type="button"
      >
        + Add Kitchen Event
      </button>

      <label
        className="flex min-h-12 cursor-pointer items-center justify-center gap-3 border border-[#d6dde5] bg-white px-4 text-center text-xs font-black text-[#07162d]"
        htmlFor="workers-assigned-only"
      >
        <input
          className="h-4 w-4 shrink-0 accent-[#1f4d73]"
          checked={workersOnly}
          id="workers-assigned-only"
          name="workersAssignedOnly"
          onChange={(event) => onWorkersOnlyChange(event.target.checked)}
          type="checkbox"
        />

        <span className="leading-tight">Workers see assigned items only</span>
      </label>
    </div>
  );
}

function TodayView({
  day,
  onAddKitchenEvent
}: {
  day: KitchenDay;
  onAddKitchenEvent: (dateKey: string) => void;
}) {
  return (
    <section className="min-h-120 border-2 border-[#009ee8] bg-[#edf9ff] p-2">
      <header className="flex items-center justify-between border-b-2 border-[#009ee8] px-2 pb-2">
        <h2 className="text-lg font-black text-[#0077b7]">{day.today ? "Today" : day.dayName}</h2>

        <div className="flex items-center gap-2">
          <PlusButton
            label={`Add kitchen event on ${day.dateLabel}`}
            onClick={() => onAddKitchenEvent(day.dateKey)}
          />
          <strong className="text-sm text-[#536780]">{day.dateLabel}</strong>
        </div>
      </header>

      <div className="mt-3">
        {day.events?.length ? (
          day.events.map((event) => (
            <KitchenEventCard event={event} key={event.id} />
          ))
        ) : (
          <p className="text-sm font-black text-[#536780]">No events</p>
        )}
      </div>
    </section>
  );
}

function WeekDayColumn({
  day,
  onAddKitchenEvent
}: {
  day: KitchenDay;
  onAddKitchenEvent: (dateKey: string) => void;
}) {
  const outerBorderColor = day.today || day.selected
    ? "border-[#009ee8]"
    : day.shabbos
      ? "border-[#a25bff]"
      : "border-transparent";
  const headerBorderColor = day.today || day.selected
    ? "border-[#009ee8]"
    : day.shabbos
      ? "border-[#a25bff]"
      : "border-[#07162d]";

  const headingColor = day.today || day.selected
    ? "text-[#0077b7]"
    : day.shabbos
      ? "text-[#8b37f5]"
      : "text-[#07162d]";

  return (
    <article
      className={`flex min-h-120 flex-col border-2 bg-white p-2 ${outerBorderColor} ${
        day.today || day.selected ? "bg-[#edf9ff]" : ""
      }`}
    >
      <header
        className={`flex items-center justify-between border-b-2 pb-2 ${headerBorderColor}`}
      >
        <h2
          className={`font-black ${
            day.shabbos ? "text-sm" : "text-base"
          } ${headingColor}`}
        >
          {day.dayName}
        </h2>

        <div className="flex shrink-0 items-center gap-1">
          <PlusButton
            label={`Add kitchen event on ${day.dateLabel}`}
            onClick={() => onAddKitchenEvent(day.dateKey)}
          />
          <strong
            className={`whitespace-nowrap ${
              day.shabbos ? "text-xs" : "text-sm"
            } ${
              day.shabbos ? "text-[#8b37f5]" : "text-[#536780]"
            }`}
          >
            {day.dateLabel}
          </strong>
        </div>
      </header>

      <div className="mt-3">
        {day.events?.length ? (
          <div className="space-y-2">
            {day.events.map((event) => (
              <KitchenEventCard event={event} key={event.id} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm font-black text-[#536780]">No events</p>
        )}
      </div>
    </article>
  );
}

function WeekView({
  days,
  onAddKitchenEvent
}: {
  days: KitchenDay[];
  onAddKitchenEvent: (dateKey: string) => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((day) => (
        <WeekDayColumn
          day={day}
          key={day.dateKey}
          onAddKitchenEvent={onAddKitchenEvent}
        />
      ))}
    </div>
  );
}

function FourWeekDay({
  day,
  onAddKitchenEvent
}: {
  day: KitchenDay;
  onAddKitchenEvent: (dateKey: string) => void;
}) {
  const borderColor = day.today || day.selected
    ? "border-[#009ee8]"
    : day.shabbos
      ? "border-[#a25bff]"
      : "border-[#aeb6bf]";

  return (
    <article
      className={`min-h-39 border-2 bg-white ${borderColor} ${
        day.today || day.selected ? "bg-[#edf9ff]" : ""
      }`}
    >
      <header
        className={`flex items-center justify-between border-b px-2 py-1.5 ${
          day.shabbos
            ? "border-[#a25bff] bg-[#fcf8ff]"
            : "border-[#d6dde5] bg-[#f7f9fb]"
        }`}
      >
        <strong
          className={`text-sm ${
            day.shabbos ? "text-[#8b37f5]" : "text-[#07162d]"
          }`}
        >
          {day.dayName}
        </strong>

        <div className="flex shrink-0 items-center gap-1">
          <PlusButton
            label={`Add kitchen event on ${day.dateLabel}`}
            onClick={() => onAddKitchenEvent(day.dateKey)}
          />

          <strong
            className={`whitespace-nowrap text-sm ${
              day.shabbos ? "text-[#8b37f5]" : "text-[#07162d]"
            }`}
          >
            {day.dateLabel}
          </strong>
        </div>
      </header>

      <div className="space-y-1 p-2">
        {day.events?.map((event) => (
          <KitchenEventCard compact event={event} key={event.id} />
        ))}
      </div>
    </article>
  );
}

function FourWeeksView({
  days,
  onCurrent,
  onAddKitchenEvent,
  onNext,
  onPrevious
}: {
  days: KitchenDay[];
  onCurrent: () => void;
  onAddKitchenEvent: (dateKey: string) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const controls = [
    { label: "Previous", onClick: onPrevious },
    { label: "Current", onClick: onCurrent },
    { label: "Next", onClick: onNext }
  ];

  return (
    <div>
      <div className="mb-3 grid w-full grid-cols-3 gap-2">
        {controls.map((control) => (
          <button
            className="h-11 min-w-0 border border-[#d6dde5] bg-white px-2 text-sm font-black hover:border-[#9eacbb] hover:bg-[#f6f8fa]"
            key={control.label}
            onClick={control.onClick}
            type="button"
          >
            {control.label}
          </button>
        ))}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((day) => (
          <FourWeekDay
            day={day}
            key={day.dateKey}
            onAddKitchenEvent={onAddKitchenEvent}
          />
        ))}
      </div>
    </div>
  );
}

export function KitchenDashboardPage() {
  const kitchenQuery = useAuthenticatedQuery<KitchenResponse>("/api/kitchen");
  const [activeView, setActiveView] = useState<KitchenView>("today");
  const today = useMemo(() => startOfDay(new Date()), []);
  const [anchorDate, setAnchorDate] = useState(today);
  const [workersOnly, setWorkersOnly] = useState(false);
  const [isAddKitchenEventOpen, setIsAddKitchenEventOpen] = useState(false);
  const [kitchenEventDateKey, setKitchenEventDateKey] = useState(() =>
    dateKey(today)
  );
  const [createdKitchenEvents, setCreatedKitchenEvents] = useState<
    Array<KitchenEvent & { dateKey: string }>
  >([]);
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const days = useMemo<KitchenDay[]>(() => {
    const eventsByDate = new Map<string, KitchenEvent[]>();
    for (const event of kitchenQuery.data?.events ?? []) {
      const key = dateKeyFromIso(event.eventDate);
      const portions =
        event.couplesCount * 2 +
        event.menCount +
        event.ladiesCount +
        event.boysCount +
        event.girlsCount +
        event.kidsCount;
      const current = eventsByDate.get(key) ?? [];
      current.push({
        id: event.id,
        category: event.hall.name,
        title: `${event.clientName}${event.eventType ? ` ${event.eventType}` : ""}`,
        portions: `${portions} portions`,
        packageName: event.packageName ?? "No package assigned",
        status: event.eventStatus,
        statusType: event.eventStatus.toLowerCase().includes("hold")
          ? "hold"
          : undefined
      });
      eventsByDate.set(key, current);
    }

    for (const event of createdKitchenEvents) {
      const current = eventsByDate.get(event.dateKey) ?? [];
      current.push(event);
      eventsByDate.set(event.dateKey, current);
    }

    const start = activeView === "today" ? anchorDate : startOfWeek(anchorDate);
    const selectedDateKey = dateKey(anchorDate);
    const todayKey = dateKey(today);

    return Array.from({ length: 28 }, (_, index) => {
      const date = addDays(start, index);
      const key = dateKey(date);
      const isSelectedDate = key === selectedDateKey;

      return {
        dateKey: key,
        dayName: key === todayKey ? "Today" : dayNames[date.getDay()],
        dateLabel: new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric"
        }).format(date),
        dayNumber: date.getDate(),
        shabbos: date.getDay() === 6,
        selected: isSelectedDate,
        today: key === todayKey,
        events: eventsByDate.get(key)
      };
    });
  }, [activeView, anchorDate, createdKitchenEvents, kitchenQuery.data, today]);

  const navigationStep = activeView === "today" ? 1 : activeView === "week" ? 7 : 28;

  function navigate(amount: number) {
    setAnchorDate((current) => addDays(current, amount * navigationStep));
  }

  function changeView(view: KitchenView) {
    setActiveView(view);
    if (view === "today") setAnchorDate(today);
  }

  function goToCurrentRange() {
    setAnchorDate(today);
  }

  function addKitchenEvent(values: AddKitchenEventFormValues) {
    setCreatedKitchenEvents((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        dateKey: kitchenEventDateKey,
        category: "Kitchen",
        title: values.eventName,
        portions: `${values.portions} portions`,
        packageName: values.kitchenNote || "Kitchen Event",
        statusType: "kitchen"
      }
    ]);
  }

  function openAddKitchenEvent(targetDateKey: string) {
    setKitchenEventDateKey(targetDateKey);
    setIsAddKitchenEventOpen(true);
  }

  return (
    <div className="flex h-dvh min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#b0b0b0] text-[#07162d]">
      <DashboardTopbar
        title="Kitchen Dashboard"
        subtitle="Review kitchen events, production schedules, and assigned work."
        onTodayNotes={() => setIsTodayNotesOpen(true)}
        onNewBooking={() => setIsNewBookingOpen(true)}
      />

      <div className="shrink-0 overflow-x-hidden">
        <KitchenHeader
          activeView={activeView}
          anchorDate={anchorDate}
          onChangeView={changeView}
          onNext={() => navigate(1)}
          onPrevious={() => navigate(-1)}
        />
      </div>

      <main className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto p-2 sm:p-4">
        <KitchenToolbar
          onAddKitchenEvent={() => openAddKitchenEvent(dateKey(anchorDate))}
          onWorkersOnlyChange={setWorkersOnly}
          workersOnly={workersOnly}
        />

        {kitchenQuery.isLoading || kitchenQuery.error ? (
          <div className="flex min-h-80 flex-1 items-center justify-center">
            <AsyncState
              error={kitchenQuery.error}
              isLoading={kitchenQuery.isLoading}
              onRetry={kitchenQuery.refetch}
            />
          </div>
        ) : (
          <div className="mt-4">
            {activeView === "today" ? (
              <TodayView
                day={days.find((day) => day.selected) ?? days[0]}
                onAddKitchenEvent={openAddKitchenEvent}
              />
            ) : activeView === "week" ? (
              <WeekView
                days={days.slice(0, 7)}
                onAddKitchenEvent={openAddKitchenEvent}
              />
            ) : (
              <FourWeeksView
                days={days}
                onCurrent={goToCurrentRange}
                onAddKitchenEvent={openAddKitchenEvent}
                onNext={() => navigate(1)}
                onPrevious={() => navigate(-1)}
              />
            )}
          </div>
        )}
      </main>

      <AddKitchenEventDialog
        date={kitchenEventDateKey}
        onClose={() => setIsAddKitchenEventOpen(false)}
        onSave={addKitchenEvent}
        open={isAddKitchenEventOpen}
      />

      <TodayNotesDrawer
        onClose={() => setIsTodayNotesOpen(false)}
        open={isTodayNotesOpen}
      />

      <NewBookingDialog
        onClose={() => setIsNewBookingOpen(false)}
        onSubmit={() => setIsNewBookingOpen(false)}
        open={isNewBookingOpen}
      />
    </div>
  );
}
