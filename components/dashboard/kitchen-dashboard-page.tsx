"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

const staffMeal: KitchenEvent = {
  id: "staff-meal",
  category: "Kitchen",
  title: "Staff Meal",
  portions: "80 portions",
  packageName: "Kitchen Event",
  statusType: "kitchen",
};

const sterlingHallEvent: KitchenEvent = {
  id: "sterling-hall",
  category: "Sterling Hall",
  title: "Tenoyim",
  portions: "200 portions",
  packageName: "Standard Tenoim Package",
  status: "On Hold",
  statusType: "hold",
};

const weekDays: KitchenDay[] = [
  { dayName: "Sun", dateLabel: "Jul 5", dayNumber: 5 },
  {
    dayName: "Mon",
    dateLabel: "Jul 6",
    dayNumber: 6,
    events: [sterlingHallEvent],
  },
  { dayName: "Tue", dateLabel: "Jul 7", dayNumber: 7 },
  { dayName: "Wed", dateLabel: "Jul 8", dayNumber: 8 },
  { dayName: "Thu", dateLabel: "Jul 9", dayNumber: 9 },
  {
    dayName: "Today",
    dateLabel: "Jul 10",
    dayNumber: 10,
    today: true,
    events: [staffMeal],
  },
  {
    dayName: "Shabbos",
    dateLabel: "Jul 11",
    dayNumber: 11,
    shabbos: true,
  },
];

const dayNames = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Shabbos",
];

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

const fourWeekDays: KitchenDay[] = Array.from(
  { length: 28 },
  (_, index) => {
    const date = new Date(Date.UTC(2026, 6, 5 + index));
    const dayNumber = date.getUTCDate();
    const dateLabel = `${monthNames[date.getUTCMonth()]} ${dayNumber}`;
    const dayName = dayNames[date.getUTCDay()];
    const isJulySix = date.getUTCMonth() === 6 && dayNumber === 6;
    const isJulyTen = date.getUTCMonth() === 6 && dayNumber === 10;

    return {
      dayName,
      dateLabel,
      dayNumber,
      shabbos: dayName === "Shabbos",
      today: isJulyTen,
      events: isJulySix
        ? [sterlingHallEvent]
        : isJulyTen
          ? [staffMeal]
          : undefined,
    };
  },
);

const viewInformation: Record<
  KitchenView,
  {
    heading: string;
    time: string;
  }
> = {
  today: {
    heading: "Friday, July 10, 2026",
    time: "6:19 PM",
  },
  week: {
    heading: "This Week · Jul 5 – Jul 11",
    time: "6:20 PM",
  },
  "four-weeks": {
    heading: "4 Weeks · Jul 5 – Aug 1",
    time: "6:20 PM",
  },
};

function PlusButton({
  label,
}: {
  label: string;
}) {
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
  event,
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
        hold
          ? "border-[#f0a326] bg-[#fffaf1]"
          : "border-[#c8d6e3] bg-[#f8fafc]"
      }`}
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-[#34465b]">
        {event.category}
      </p>

      <h3 className="mt-1 text-sm font-black text-[#07162d]">
        {event.title}
      </h3>

      <p className="mt-1 text-xs font-bold text-[#41556c]">
        {event.portions}
      </p>

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
  onChangeView,
}: {
  activeView: KitchenView;
  onChangeView: (view: KitchenView) => void;
}) {
  const router = useRouter();
  const information = viewInformation[activeView];

  const tabs: Array<{
    label: string;
    value: KitchenView;
  }> = [
    { label: "Today", value: "today" },
    { label: "This Week", value: "week" },
    { label: "4 Weeks", value: "four-weeks" },
  ];

  return (
    <header className="border-b border-[#929292] bg-[#b0b0b0] px-4 py-4">
      <div className="flex min-w-270 items-center gap-3">
        <button
          className="h-11 border border-[#d6dde5] bg-white px-5 text-sm font-black hover:bg-[#f6f8fa]"
          onClick={() => router.push("/dashboard")}
          type="button"
        >
          ← Main Menu
        </button>

        <button
          className="relative h-11 border border-[#e99841] bg-white px-3 text-sm font-black"
          type="button"
        >
          Bell
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center bg-[#d91d28] px-1 text-[10px] font-black text-white">
            2
          </span>
        </button>

        <button
          aria-label="Previous date range"
          className="h-11 w-11 border border-[#d6dde5] bg-white font-black"
          type="button"
        >
          ‹
        </button>

        <h1 className="min-w-0 max-w-105 flex-1 truncate text-2xl font-black text-[#07162d]">
          {information.heading}
        </h1>

        <button
          aria-label="Next date range"
          className="h-11 w-11 border border-[#d6dde5] bg-white font-black"
          type="button"
        >
          ›
        </button>

        <button
          className="h-11 border border-[#d6dde5] bg-white px-5 text-sm font-black"
          type="button"
        >
          Today
        </button>

        <strong className="min-w-32 text-center text-3xl font-black text-[#ffd45c]">
          {information.time}
        </strong>

        <span className="bg-[#07162d] px-4 py-3 text-xs font-black uppercase tracking-wide text-white">
          Hall Manager
        </span>

        <nav
          aria-label="Kitchen calendar views"
          className="ml-auto flex gap-2"
        >
          {tabs.map((tab) => {
            const active = activeView === tab.value;

            return (
              <button
                className={`h-11 min-w-24 border px-4 text-sm font-black ${
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
  onWorkersOnlyChange,
}: {
  workersOnly: boolean;
  onWorkersOnlyChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid min-w-225 gap-3 lg:grid-cols-[minmax(0,1fr)_222px]">
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
          onChange={(event) =>
            onWorkersOnlyChange(event.target.checked)
          }
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

function TodayView() {
  return (
    <section className="min-h-120 border-2 border-[#009ee8] bg-[#edf9ff] p-2">
      <header className="flex items-center justify-between border-b-2 border-[#009ee8] px-2 pb-2">
        <h2 className="text-lg font-black text-[#0077b7]">Today</h2>

        <div className="flex items-center gap-2">
          <PlusButton label="Add kitchen event on July 10" />
          <strong className="text-sm text-[#536780]">Jul 10</strong>
        </div>
      </header>

      <div className="mt-3">
        <KitchenEventCard event={staffMeal} />
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
          <PlusButton
            label={`Add kitchen event on ${day.dateLabel}`}
          />

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
          <p className="mt-2 text-sm font-black text-[#536780]">
            No events
          </p>
        )}
      </div>
    </article>
  );
}

function WeekView() {
  return (
    <div className="grid min-w-287.5 grid-cols-7 gap-2">
      {weekDays.map((day) => (
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
          <PlusButton
            label={`Add kitchen event on ${day.dateLabel}`}
          />

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
          <KitchenEventCard
            compact
            event={event}
            key={event.id}
          />
        ))}
      </div>
    </article>
  );
}

function FourWeeksView() {
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

      <div className="grid min-w-287.5 grid-cols-7 gap-1.5">
        {fourWeekDays.map((day) => (
          <FourWeekDay day={day} key={day.dateLabel} />
        ))}
      </div>
    </div>
  );
}

export function KitchenDashboardPage() {
  const [activeView, setActiveView] =
    useState<KitchenView>("today");

  const [workersOnly, setWorkersOnly] = useState(false);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#b0b0b0] text-[#07162d]">
      <div className="shrink-0 overflow-x-auto">
        <KitchenHeader
          activeView={activeView}
          onChangeView={setActiveView}
        />
      </div>

      <main className="min-h-0 flex-1 overflow-auto p-4">
        <KitchenToolbar
          onWorkersOnlyChange={setWorkersOnly}
          workersOnly={workersOnly}
        />

        <div className="mt-4">
          {activeView === "today" ? (
            <TodayView />
          ) : activeView === "week" ? (
            <WeekView />
          ) : (
            <FourWeeksView />
          )}
        </div>
      </main>
    </div>
  );
}
