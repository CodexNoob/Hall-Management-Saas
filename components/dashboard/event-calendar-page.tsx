"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardTopbar } from "@/components/topbars/dashboard-topbar";
import { clearCachedSyncedUser, getCachedSyncedUser, syncSignedInUser, type SyncSignedInUserResponse } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type CalendarEvent = {
  title: string;
  hall?: string;
  tone: "green" | "gold" | "red";
};

function LineIcon({
  name,
  className = "h-5 w-5"
}: {
  name: "home" | "bell" | "help" | "grid" | "calendar" | "hall" | "tag" | "shield" | "chevron" | "left" | "right" | "plus";
  className?: string;
}) {
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

  const paths: Record<typeof name, ReactNode> = {
    home: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z" />,
    bell: <><path d="M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3Z" /><path d="M10 21h4" /></>,
    help: <><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="M9.8 9a2.4 2.4 0 0 1 4.4 1.3c0 1.8-2.2 2-2.2 3.7M12 17h.01" /></>,
    grid: <><path d="M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z" /></>,
    calendar: <><path d="M4 6h16v14H4ZM8 3v5M16 3v5M4 11h16" /></>,
    hall: <><path d="M4 20h16M6 20V9l6-4 6 4v11" /><path d="M9 20v-6h6v6M8 11h8" /></>,
    tag: <><path d="M20 12 12 20 4 12V4h8Z" /><path d="M8 8h.01" /></>,
    shield: <><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6Z" /><path d="m9 12 2 2 4-5" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    plus: <path d="M12 5v14M5 12h14" />
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function FilterSelect({ icon, label }: { icon: "hall" | "tag" | "shield"; label: string }) {
  return (
    <button className="flex h-13 min-w-0 items-center gap-3 rounded-xl border border-[#d8dde5] bg-[#ffffff] px-4 text-left text-sm font-bold text-[#6a7483] shadow-sm shadow-[#17202a]/4 transition hover:border-[#1f4d73]/70 hover:bg-white" type="button">
      <LineIcon name={icon} className="h-5 w-5 shrink-0 text-[#6a7483]" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <LineIcon name="chevron" className="h-4 w-4 shrink-0 text-[#6a7483]" />
    </button>
  );
}

function EventMiniCard({ event }: { event: CalendarEvent }) {
  const classes = {
    green: "border-[#146c43] bg-[#eef4fa] text-[#146c43]",
    gold: "border-[#9a5b00] bg-[#fbfcfd] text-[#9a5b00]",
    red: "border-[#a62b24] bg-[#fbfcfd] text-[#a62b24]"
  };

  return (
    <div className={`rounded-lg border px-2.5 py-2 leading-tight ${classes[event.tone]}`}>
      <p className="truncate text-xs font-black">{event.title}</p>
      {event.hall ? <p className="mt-0.5 truncate text-[11px] font-bold opacity-85">{event.hall}</p> : null}
    </div>
  );
}

function CalendarCell({ day, hebrew, events = [], highlighted = false }: { day: number; hebrew?: string; events?: CalendarEvent[]; highlighted?: boolean }) {
  return (
    <div className={`relative min-h-32 rounded-xl border bg-white p-3 shadow-sm shadow-[#17202a]/3 transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-36 ${highlighted ? "border-[#1f4d73] ring-1 ring-[#1f4d73]/20" : "border-[#d8dde5]"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-black text-[#17202a]">{day}</span>
        <span className="truncate text-right text-xs font-bold text-[#6a7483]" dir="rtl">{hebrew ?? ""}</span>
      </div>

      <div className="mt-4 space-y-2 pb-8">
        {events.map((event) => (
          <EventMiniCard key={`${day}-${event.title}`} event={event} />
        ))}
      </div>
    </div>
  );
}

const dayHeaders = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SHABBOS"];



const eventsByDay: Record<number, CalendarEvent[]> = {
  3: [{ title: "Sample Vort", hall: "Hall 1", tone: "green" }],
  7: [{ title: "Sample Wedding", hall: "Hall 1", tone: "green" }],
  14: [{ title: "Sample Sheva Brachos", hall: "Hall 2", tone: "gold" }],
  21: [
    { title: "Full Date", hall: "All Halls", tone: "green" },
    { title: "Full", tone: "red" }
  ]
};

export function EventCalendarPage() {
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(null);

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
    <div className="min-h-screen overflow-x-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Event Calendar"
        subtitle="Any organization can rename them and add more halls from Settings."
      />

      <section className="relative overflow-hidden px-4 py-8 sm:px-8 lg:px-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-[#fbfcfd]/70 to-transparent" />
          <svg className="pointer-events-none absolute right-0 top-0 hidden h-96 w-180 max-w-full text-[#1f4d73]/20 sm:block" viewBox="0 0 720 360" fill="none" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, index) => (
              <path key={index} d={`M0 ${90 + index * 22}c142-90 242 44 384-46 128-80 214-30 336-98`} stroke="currentColor" />
            ))}
          </svg>

          <section className="dashboard-gradient-card mt-8 overflow-hidden shadow-xl shadow-[#17202a]/8">
            <div className="relative z-1 space-y-7 p-5 sm:p-6 lg:p-7">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="px-2 text-2xl font-black tracking-tight text-[#17202a] sm:text-3xl">June 2026</h2>

                  <div className="flex items-center gap-3">
                    <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d8dde5] bg-white text-[#17202a] shadow-sm shadow-[#17202a]/4 transition hover:-translate-y-0.5 hover:border-[#1f4d73]" type="button" aria-label="Previous month">
                      <LineIcon name="left" className="h-6 w-6" />
                    </button>

                    <button className="inline-flex h-12 items-center justify-center gap-3 rounded-xl bg-[#1f4d73] px-5 text-sm font-black text-white shadow-lg shadow-[#1f4d73]/20 transition hover:-translate-y-0.5 hover:bg-[#9a5b00]" type="button">
                      <LineIcon name="calendar" />
                      Today
                    </button>

                    <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d8dde5] bg-white text-[#17202a] shadow-sm shadow-[#17202a]/4 transition hover:-translate-y-0.5 hover:border-[#1f4d73]" type="button" aria-label="Next month">
                      <LineIcon name="right" className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <p className="text-sm font-bold text-[#6a7483]">Availability is checked by room and operating night.</p>

                <div className="grid gap-3 sm:grid-cols-3 xl:min-w-180">
                  <FilterSelect icon="hall" label="All Halls" />
                  <FilterSelect icon="tag" label="All Event Types" />
                  <FilterSelect icon="shield" label="All Statuses" />
                </div>
              </div>

              <div className="overflow-x-auto pb-2">
                <div className="xl:min-w-180">
                  <div className="grid grid-cols-7 gap-2 px-1 pb-3">
                    {dayHeaders.map((day) => (
                      <div key={day} className="text-center text-xs font-black uppercase tracking-[0.08em] text-[#6a7483]">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 30 }).map((_, index) => {
                      const day = index + 1;

                      return (
                        <CalendarCell
                          key={day}
                          day={day}
                          events={eventsByDay[day]}
                          highlighted={day === 15}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
      </section>
    </div>
  );
}
