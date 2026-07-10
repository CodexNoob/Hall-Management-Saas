"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { clearCachedSyncedUser, getCachedSyncedUser, syncSignedInUser, type SyncSignedInUserResponse } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type KitchenView = "today" | "week" | "four-weeks";

type IconName =
  | "calendar"
  | "chevron"
  | "clock"
  | "drink"
  | "events"
  | "file"
  | "home"
  | "kitchen"
  | "logout"
  | "menu"
  | "plus"
  | "search"
  | "soup"
  | "trash"
  | "users";

const todayItems = [
  { title: "Chicken Soup", units: "2 units", icon: "soup" as const },
  { title: "Schnitzel Sandwich", units: "100 units", icon: "kitchen" as const },
  { title: "Cold Drinks", units: "2 units", icon: "drink" as const }
];

const kitchenDateInfo: Record<KitchenView, { range: string; time: string }> = {
  today: { range: "Thursday, July 2, 2026", time: "12:19 PM" },
  week: { range: "Jun 28 - Jul 4, 2026", time: "12:19 PM" },
  "four-weeks": { range: "Jun 28 - Jul 25, 2026", time: "12:20 PM" }
};

const weekDays = [
  { weekday: "Sun", date: "Jun 28" },
  { weekday: "Mon", date: "Jun 29" },
  { weekday: "Tue", date: "Jun 30" },
  { weekday: "Wed", date: "Jul 1" },
  { weekday: "Thu", date: "Jul 2", event: true },
  { weekday: "Fri", date: "Jul 3" },
  { weekday: "Sutarday", date: "Jul 4", shabbos: true }
];

const fourWeekDays = [
  ["Sun", "Jun 28"],
  ["Mon", "Jun 29"],
  ["Tue", "Jun 30"],
  ["Wed", "Jul 1"],
  ["Thu", "Jul 2"],
  ["Fri", "Jul 3"],
  ["Sutarday", "Jul 4"],
  ["Sun", "Jul 5"],
  ["Mon", "Jul 6"],
  ["Tue", "Jul 7"],
  ["Wed", "Jul 8"],
  ["Thu", "Jul 9"],
  ["Fri", "Jul 10"],
  ["Sutarday", "Jul 11"],
  ["Sun", "Jul 12"],
  ["Mon", "Jul 13"],
  ["Tue", "Jul 14"],
  ["Wed", "Jul 15"],
  ["Thu", "Jul 16"],
  ["Fri", "Jul 17"],
  ["Sutarday", "Jul 18"],
  ["Sun", "Jul 19"],
  ["Mon", "Jul 20"],
  ["Tue", "Jul 21"],
  ["Wed", "Jul 22"],
  ["Thu", "Jul 23"],
  ["Fri", "Jul 24"],
  ["Sutarday", "Jul 25"]
];

function LineIcon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  const paths: Record<IconName, React.ReactNode> = {
    calendar: <><path d="M4 6h16v14H4ZM8 3v5M16 3v5M4 11h16" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></>,
    drink: <><path d="M7 4h10l-1 15H8Z" /><path d="M9 8h6M10 12h4" /></>,
    events: <><path d="M6 3h9l3 3v15H6Z" /><path d="M15 3v4h4M9 12h6M9 16h4" /></>,
    file: <><path d="M6 3h9l3 3v15H6Z" /><path d="M15 3v4h4M9 13h6M9 17h4" /></>,
    home: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z" />,
    kitchen: <><path d="M8 4v5M12 4v5M16 4v5M7 9h10l-1 11H8Z" /><path d="M5 13H3v3h3M19 13h2v3h-3" /></>,
    logout: <><path d="M10 6H5v12h5" /><path d="M14 8l4 4-4 4M8 12h10" /></>,
    menu: <><path d="M7 3v18M11 3v7a4 4 0 0 1-8 0V3M17 3v18M17 3c2 1.5 3 4 3 7v2h-3" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    soup: <><path d="M5 12h14l-1 7H6Z" /><path d="M7 12c0-3 10-3 10 0M9 5c-1 1-1 2 0 3M13 5c-1 1-1 2 0 3" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9" /></>
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function SegmentedTabs({ activeView, setActiveView }: { activeView: KitchenView; setActiveView: (view: KitchenView) => void }) {
  const tabs: Array<{ label: string; value: KitchenView }> = [
    { label: "Today", value: "today" },
    { label: "This Week", value: "week" },
    { label: "4 Weeks", value: "four-weeks" }
  ];

  return (
    <div className="inline-flex w-full overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm shadow-[#17202a]/4 sm:w-130">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          className={`h-13 flex-1 px-5 text-base font-bold transition ${
            activeView === tab.value ? "bg-[#1f4d73] text-white shadow-inner" : "border-l border-[#d8dde5] text-[#17202a] hover:bg-[#eef4fa]"
          }`}
          type="button"
          onClick={() => setActiveView(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function DateInfoCards({ range, time }: { range: string; time: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="flex h-17 min-w-80 items-center gap-4 rounded-xl border border-[#d8dde5] bg-white px-7 text-base font-black text-[#17202a] shadow-sm shadow-[#17202a]/4">
        <LineIcon name="calendar" className="h-5 w-5 text-[#1f4d73]" />
        {range}
      </div>
      <div className="flex h-17 min-w-54 items-center gap-4 rounded-xl border border-[#d8dde5] bg-white px-7 text-base font-black text-[#9a5b00] shadow-sm shadow-[#17202a]/4">
        <LineIcon name="clock" className="h-5 w-5 text-[#1f4d73]" />
        {time}
      </div>
    </div>
  );
}

function ViewNavigationButtons() {
  return (
    <div className="flex flex-wrap gap-3">
      {["Previous", "Current", "Next"].map((label, index) => (
        <button key={label} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d8dde5] bg-white px-4 text-sm font-black text-[#17202a] shadow-sm transition hover:bg-[#eef4fa]" type="button">
          {index === 0 ? "?" : null}
          {label}
          {index === 2 ? "?" : null}
        </button>
      ))}
    </div>
  );
}

function TodayKitchenView() {
  return (
    <div className="space-y-6">
      <button className="flex h-19.5 w-full items-center gap-5 rounded-2xl border border-dashed border-[#b9c2cf] bg-white/75 px-9 text-lg font-semibold text-[#6a7483] transition hover:border-[#1f4d73] hover:bg-[#fbfcfd]" type="button">
        <LineIcon name="plus" className="h-5 w-5" />
        Add Kitchen Event
      </button>

      <section className="rounded-2xl border border-[#d8dde5] border-l-4 border-l-[#1f4d73] bg-[#fbfcfd] px-8 py-11 shadow-xl shadow-[#17202a]/7">
        <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div>
            <p className="text-base font-black uppercase tracking-[0.12em] text-[#1f4d73]">KITA TES</p>
            <h2 className="mt-4 text-[42px] font-black tracking-tight text-[#17202a]">100 portions</h2>
            <span className="mt-3 inline-flex rounded-lg border border-[#b9c2cf] bg-[#fbfcfd] px-3 py-1 text-xs font-black text-[#1f4d73]">Kitchen Add</span>
            <p className="mt-4 text-sm font-black uppercase tracking-[0.08em] text-[#6a7483]">No menu assigned</p>
            <div className="mt-4 rounded-lg border border-[#9a5b00] bg-[#fbfcfd] px-5 py-3 text-sm font-black text-[#9a5b00]">
              Needs it ready for 2:00pm
            </div>
            <button className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg border border-[#a62b24] bg-white px-4 text-sm font-black text-[#a62b24] transition hover:bg-[#fbfcfd]" type="button">
              <LineIcon name="trash" className="h-4 w-4" />
              Delete Event
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-5 lg:justify-center">
            {todayItems.map((item) => (
              <article key={item.title} className="flex min-h-50 w-35 flex-col justify-center rounded-xl border border-[#d8dde5] bg-white p-5 text-center shadow-lg shadow-[#17202a]/7">
                <LineIcon name={item.icon} className="mx-auto h-7 w-7 text-[#1f4d73]" />
                <h3 className="mt-4 text-lg font-black leading-5 text-[#17202a]">{item.title}</h3>
                <div className="mt-5 border-t border-[#d8dde5] pt-3 text-xs font-black text-[#6a7483]">{item.units}</div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyDay() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center text-[#6a7483]">
      <LineIcon name="calendar" className="h-6 w-6" />
      <p className="mt-2 text-xs font-semibold">No events</p>
    </div>
  );
}

function KitchenEventMini({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#1f4d73] shadow-sm ${compact ? "p-2 text-xs" : "p-3 text-sm"}`}>
      <p className="font-black uppercase tracking-[0.04em]">KITA TES</p>
      <p className="mt-1 font-black text-[#17202a]">100 portions</p>
      <p className="mt-1 font-semibold text-[#6a7483]">No menu</p>
    </div>
  );
}

function WeekKitchenView() {
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-270 grid-cols-7 gap-3">
          {weekDays.map((day) => (
            <article
              key={day.date}
              className={`flex min-h-108 flex-col rounded-2xl border p-4 shadow-sm shadow-[#17202a]/5 ${
                day.event ? "border-[#1f4d73] bg-[#fbfcfd]" : day.shabbos ? "border-[#b9c2cf] bg-white" : "border-[#d8dde5] bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className={`text-base font-black ${day.shabbos ? "text-[#1f4d73]" : "text-[#17202a]"}`}>{day.weekday}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#6a7483]">{day.date}</p>
                </div>
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#b9c2cf] bg-white text-[#17202a] transition hover:bg-[#eef4fa]"
                  type="button"
                  aria-label={`Add kitchen event on ${day.weekday} ${day.date}`}
                  title={`Add kitchen event on ${day.weekday} ${day.date}`}
                >
                  <LineIcon name="plus" className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-4 flex flex-1">
                {day.event ? <KitchenEventMini /> : <EmptyDay />}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function FourWeeksKitchenView() {
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-305 grid-cols-7 gap-1.5">
          {fourWeekDays.map(([weekday, date]) => {
            const isEventDay = date === "Jul 2";
            const isShabbos = weekday === "Shabbos";
            return (
              <article
                key={`${weekday}-${date}`}
                className={`min-h-39 rounded-xl border p-3 shadow-sm shadow-[#17202a]/4 ${
                  isEventDay ? "border-[#1f4d73] bg-[#fbfcfd]" : isShabbos ? "border-[#b9c2cf] bg-white" : "border-[#d8dde5] bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className={`text-sm font-black ${isShabbos ? "text-[#1f4d73]" : "text-[#17202a]"}`}>{weekday}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#6a7483]">{date}</p>
                  </div>
                  <button
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-[#b9c2cf] bg-white text-[#17202a] transition hover:bg-[#eef4fa]"
                    type="button"
                    aria-label={`Add kitchen event on ${weekday} ${date}`}
                    title={`Add kitchen event on ${weekday} ${date}`}
                  >
                    <LineIcon name="plus" className="h-3 w-3" />
                  </button>
                </div>
                <div className="mt-3">{isEventDay ? <KitchenEventMini compact /> : <div className="h-15 rounded-lg border border-[#d8dde5] bg-[#ffffff]" />}</div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function KitchenDashboardPage() {
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(null);
  const [activeView, setActiveView] = useState<KitchenView>("today");

  useEffect(() => {
    let isMounted = true;
    const cachedSyncData = getCachedSyncedUser();

    if (cachedSyncData) {
      setSyncData(cachedSyncData);
    }

    async function loadUser() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session?.access_token) {
          clearCachedSyncedUser();
          router.replace("/");
          return;
        }

        const synced = await syncSignedInUser(data.session.access_token);

        if (isMounted) {
          setSyncData(synced);
        }
      } catch {
        if (!cachedSyncData) {
          clearCachedSyncedUser();
          router.replace("/");
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!syncData) {
    return <main className="min-h-screen bg-[#f5f6f8]" aria-busy="true" />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#ffffff] text-[#17202a]">
      <DashboardTopbar title="Kitchen Dashboard" subtitle="See today's kitchen events and what needs to be prepared." />

      <div className="px-4 py-10 sm:px-8 lg:px-14 lg:py-16">
          <div className="relative pb-10">
            <svg className="pointer-events-none absolute right-0 top-0 hidden h-80 w-180 max-w-full text-[#1f4d73]/18 sm:block" viewBox="0 0 720 360" fill="none" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, index) => (
                <path key={index} d={`M0 ${90 + index * 24}c142-90 242 44 384-46 128-80 214-30 336-98`} stroke="currentColor" />
              ))}
            </svg>

            <div className="relative">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <SegmentedTabs activeView={activeView} setActiveView={setActiveView} />
                <div className="flex flex-col items-center gap-3 xl:items-end">
                  <DateInfoCards range={kitchenDateInfo[activeView].range} time={kitchenDateInfo[activeView].time} />
                  {activeView !== "today" ? (
                    <div className="flex justify-center xl:justify-end">
                      <ViewNavigationButtons />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-7">
                {activeView === "today" ? (
                  <TodayKitchenView />
                ) : activeView === "week" ? (
                  <WeekKitchenView />
                ) : (
                  <FourWeeksKitchenView />
                )}
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
