"use client";

import { useMemo, useState } from "react";
import { NewBookingDialog } from "@/components/forms-and-modals/new-booking-dialog";
import { TodayNotesDrawer } from "@/components/forms-and-modals/today-notes-drawer";
import { DashboardTopbar } from "@/components/topbars/dashboard-topbar";
import { AsyncState } from "@/components/ui/async-state";
import { useAuthenticatedQuery } from "@/lib/hooks/use-authenticated-query";

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
  dayName: string;
  dateLabel: string;
  dayNumber: number;
  shabbos?: boolean;
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

const viewInformation: Record<
  KitchenView,
  {
    heading: string;
    time: string;
  }
> = {
  today: {
    heading: "Friday, July 10, 2026",
    time: "6:19 PM"
  },
  week: {
    heading: "This Week · Jul 5 – Jul 11",
    time: "6:20 PM"
  },
  "four-weeks": {
    heading: "4 Weeks · Jul 5 – Aug 1",
    time: "6:20 PM"
  }
};

function PlusButton({ label }: { label: string }) {
  return (
    <button
      aria-label={label}
      className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#cbd5df] bg-[#f8fafc] text-sm font-black text-[#17202a] hover:bg-white"
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
  onChangeView
}: {
  activeView: KitchenView;
  onChangeView: (view: KitchenView) => void;
}) {
  const information = viewInformation[activeView];

  const tabs: Array<{
    label: string;
    value: KitchenView;
  }> = [
    { label: "Today", value: "today" },
    { label: "This Week", value: "week" },
    { label: "4 Weeks", value: "four-weeks" }
  ];

  return (
    <header className="border-b border-[#929292] bg-[#b0b0b0] px-4 py-4">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-3 xl:flex-nowrap">
        <button
          aria-label="Previous date range"
          className="flex h-11 w-11 shrink-0 items-center justify-center bg-transparent text-[#07162d] hover:text-[#1f4d73]"
          type="button"
        >
          <svg
            aria-hidden="true"
            className="h-8 w-8"
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

        <h1 className="shrink-0 whitespace-nowrap text-2xl font-black text-[#07162d]">
          {information.heading}
        </h1>

        <button
          aria-label="Next date range"
          className="flex h-11 w-11 shrink-0 items-center justify-center bg-transparent text-[#07162d] hover:text-[#1f4d73]"
          type="button"
        >
          <svg
            aria-hidden="true"
            className="h-8 w-8"
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

        <button
          className="h-11 shrink-0 whitespace-nowrap border border-[#d6dde5] bg-white px-5 text-sm font-black"
          type="button"
        >
          Today
        </button>

        <strong className="min-w-32 shrink-0 whitespace-nowrap text-center text-3xl font-black text-[#ffd45c]">
          {information.time}
        </strong>

        <span className="shrink-0 whitespace-nowrap bg-[#07162d] px-4 py-3 text-xs font-black uppercase tracking-wide text-white">
          Hall Manager
        </span>

        <nav
          aria-label="Kitchen calendar views"
          className="ml-auto flex shrink-0 gap-2"
        >
          {tabs.map((tab) => {
            const active = activeView === tab.value;

            return (
              <button
                className={`h-11 min-w-24 whitespace-nowrap border px-4 text-sm font-black ${
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
          })}
        </nav>
      </div>
    </header>
  );
}

function KitchenToolbar({
  workersOnly,
  onWorkersOnlyChange
}: {
  workersOnly: boolean;
  onWorkersOnlyChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_222px]">
      <button
        className="h-12 border border-dashed border-[#c4ccd5] bg-white px-6 text-left text-sm font-black text-[#64748b] hover:border-[#007dbb]"
        type="button"
      >
        + Add Kitchen Event
      </button>

      <label
        className="flex min-h-12 cursor-pointer items-center justify-center gap-8 bg-white px-4 text-center text-xs font-black text-[#07162d]"
        htmlFor="workers-assigned-only"
      >
        <input
          checked={workersOnly}
          id="workers-assigned-only"
          name="workersAssignedOnly"
          onChange={(event) => onWorkersOnlyChange(event.target.checked)}
          type="checkbox"
        />

        <span>
          Workers see
          <br />
          assigned items only
        </span>
      </label>
    </div>
  );
}

function TodayView({ day }: { day: KitchenDay }) {
  return (
    <section className="min-h-120 border-2 border-[#009ee8] bg-[#edf9ff] p-2">
      <header className="flex items-center justify-between border-b-2 border-[#009ee8] px-2 pb-2">
        <h2 className="text-lg font-black text-[#0077b7]">Today</h2>

        <div className="flex items-center gap-2">
          <PlusButton label={`Add kitchen event on ${day.dateLabel}`} />
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

function WeekDayColumn({ day }: { day: KitchenDay }) {
  const borderColor = day.today
    ? "border-[#009ee8]"
    : day.shabbos
      ? "border-[#a25bff]"
      : "border-transparent";

  const headingColor = day.today
    ? "text-[#0077b7]"
    : day.shabbos
      ? "text-[#8b37f5]"
      : "text-[#07162d]";

  return (
    <article
      className={`flex min-h-120 flex-col border-2 bg-white p-2 ${borderColor} ${
        day.today ? "bg-[#edf9ff]" : ""
      }`}
    >
      <header
        className={`flex items-center justify-between border-b-2 pb-2 ${borderColor}`}
      >
        <h2 className={`text-base font-black ${headingColor}`}>
          {day.dayName}
        </h2>

        <div className="flex items-center gap-2">
          <PlusButton label={`Add kitchen event on ${day.dateLabel}`} />

          <strong
            className={`text-sm ${
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

function WeekView({ days }: { days: KitchenDay[] }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((day) => (
        <WeekDayColumn day={day} key={day.dateLabel} />
      ))}
    </div>
  );
}

function FourWeekDay({ day }: { day: KitchenDay }) {
  const borderColor = day.today
    ? "border-[#009ee8]"
    : day.shabbos
      ? "border-[#a25bff]"
      : "border-[#aeb6bf]";

  return (
    <article
      className={`min-h-39 border-2 bg-white ${borderColor} ${
        day.today ? "bg-[#edf9ff]" : ""
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

        <div className="flex items-center gap-2">
          <PlusButton label={`Add kitchen event on ${day.dateLabel}`} />

          <strong
            className={`text-sm ${
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

function FourWeeksView({ days }: { days: KitchenDay[] }) {
  return (
    <div>
      <div className="mb-3 flex gap-2">
        {["Previous", "Current", "Next"].map((label) => (
          <button
            className="h-11 min-w-26 border border-[#d6dde5] bg-white px-4 text-sm font-black hover:bg-[#f6f8fa]"
            key={label}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((day) => (
          <FourWeekDay day={day} key={day.dateLabel} />
        ))}
      </div>
    </div>
  );
}

export function KitchenDashboardPage() {
  const kitchenQuery = useAuthenticatedQuery<KitchenResponse>("/api/kitchen");
  const [activeView, setActiveView] = useState<KitchenView>("today");

  const [workersOnly, setWorkersOnly] = useState(false);
  const [isTodayNotesOpen, setIsTodayNotesOpen] = useState(false);
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const days = useMemo<KitchenDay[]>(() => {
    const eventsByDate = new Map<string, KitchenEvent[]>();
    for (const event of kitchenQuery.data?.events ?? []) {
      const key = event.eventDate.slice(0, 10);
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

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 28 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
      ].join("-");
      return {
        dayName: index === 0 ? "Today" : dayNames[date.getDay()],
        dateLabel: new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric"
        }).format(date),
        dayNumber: date.getDate(),
        shabbos: date.getDay() === 6,
        today: index === 0,
        events: eventsByDate.get(key)
      };
    });
  }, [kitchenQuery.data]);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#b0b0b0] text-[#07162d]">
      <DashboardTopbar
        title="Kitchen Dashboard"
        subtitle="Review kitchen events, production schedules, and assigned work."
        onTodayNotes={() => setIsTodayNotesOpen(true)}
        onNewBooking={() => setIsNewBookingOpen(true)}
      />

      <div className="shrink-0 overflow-x-hidden">
        <KitchenHeader activeView={activeView} onChangeView={setActiveView} />
      </div>

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
        {kitchenQuery.isLoading || kitchenQuery.error ? (
          <AsyncState
            error={kitchenQuery.error}
            isLoading={kitchenQuery.isLoading}
            onRetry={kitchenQuery.refetch}
          />
        ) : (
          <>
            <KitchenToolbar
              onWorkersOnlyChange={setWorkersOnly}
              workersOnly={workersOnly}
            />

            <div className="mt-4">
              {activeView === "today" ? (
                <TodayView day={days[0]} />
              ) : activeView === "week" ? (
                <WeekView days={days.slice(0, 7)} />
              ) : (
                <FourWeeksView days={days} />
              )}
            </div>
          </>
        )}
      </main>

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
