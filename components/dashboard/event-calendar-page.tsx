"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { clearCachedSyncedUser, getCachedSyncedUser, syncSignedInUser, type SyncSignedInUserResponse } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type CalendarEvent = {
  title: string;
  hall?: string;
  tone: "green" | "gold" | "red";
};

function formatRole(role: string) {
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

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
    <button className="flex h-13 min-w-0 items-center gap-3 rounded-xl border border-[#E5E0D6] bg-[#FFFEFB] px-4 text-left text-sm font-bold text-[#475569] shadow-sm shadow-[#0F172A]/4 transition hover:border-[#B9974D]/70 hover:bg-white" type="button">
      <LineIcon name={icon} className="h-5 w-5 shrink-0 text-[#64748B]" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <LineIcon name="chevron" className="h-4 w-4 shrink-0 text-[#64748B]" />
    </button>
  );
}

function EventMiniCard({ event }: { event: CalendarEvent }) {
  const classes = {
    green: "border-[#A7F3D0] bg-[#ECFDF5] text-[#027A48]",
    gold: "border-[#EBD6A7] bg-[#FFF8E8] text-[#B07A12]",
    red: "border-[#FDA4A4] bg-[#FEF2F2] text-[#DC2626]"
  };

  return (
    <div className={`rounded-lg border px-2.5 py-2 leading-tight ${classes[event.tone]}`}>
      <p className="truncate text-xs font-black">{event.title}</p>
      {event.hall ? <p className="mt-0.5 truncate text-[11px] font-bold opacity-85">{event.hall}</p> : null}
    </div>
  );
}

function CalendarCell({ day, hebrew, events = [], highlighted = false }: { day: number; hebrew: string; events?: CalendarEvent[]; highlighted?: boolean }) {
  return (
    <div className={`relative min-h-32 rounded-xl border bg-white p-3 shadow-sm shadow-[#0F172A]/3 transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-36 ${highlighted ? "border-[#B9974D] ring-1 ring-[#B9974D]/20" : "border-[#E5E0D6]"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-black text-[#0F172A]">{day}</span>
        <span className="truncate text-right text-xs font-bold text-[#475569]" dir="rtl">{hebrew}</span>
      </div>

      <div className="mt-4 space-y-2 pb-8">
        {events.map((event) => (
          <EventMiniCard key={`${day}-${event.title}`} event={event} />
        ))}
      </div>

      <button className="absolute bottom-3 left-3 flex h-7 w-7 items-center justify-center rounded-lg bg-[#B9974D] text-white shadow-md shadow-[#B9974D]/25 transition hover:-translate-y-0.5 hover:bg-[#A98537]" type="button" aria-label={`Add event on June ${day}`}>
        <LineIcon name="plus" className="h-4 w-4" />
      </button>
    </div>
  );
}

const dayHeaders = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SHABBOS"];

const hebrewDates = [
  "ט״ו סיון", "ט״ז סיון", "י״ז סיון", "י״ח סיון", "י״ט סיון", "כ׳ סיון", "כ״א סיון",
  "כ״ב סיון", "כ״ג סיון", "כ״ד סיון", "כ״ה סיון", "כ״ו סיון", "כ״ז סיון", "כ״ח סיון",
  "א׳ תמוז", "ב׳ תמוז", "ג׳ תמוז", "ד׳ תמוז", "ה׳ תמוז", "ו׳ תמוז", "ז׳ תמוז",
  "ח׳ תמוז", "ט׳ תמוז", "י׳ תמוז", "י״א תמוז", "י״ב תמוז", "י״ג תמוז", "י״ד תמוז",
  "ט״ו תמוז", "ט״ז תמוז"
];

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
    return <main className="min-h-screen bg-[#F7F4ED]" aria-busy="true" />;
  }

  const user = syncData.user;
  const roleLabel = formatRole(user.role);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F7F4ED] text-[#0F172A]">
      <DashboardSidebar user={user} roleLabel={roleLabel} activeLabel="Calendar" />

      <section className="dashboard-shell-main min-h-screen lg:pl-70">
        <DashboardTopbar
          title="Event Calendar"
          subtitle="Any organization can rename them and add more halls from Settings."
        />

        <section className="relative overflow-hidden px-4 py-8 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-[#E7E3DA]/70 to-transparent" />
        <svg className="pointer-events-none absolute right-0 top-0 hidden h-96 w-180 max-w-full text-[#B9974D]/20 sm:block" viewBox="0 0 720 360" fill="none" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <path key={index} d={`M0 ${90 + index * 22}c142-90 242 44 384-46 128-80 214-30 336-98`} stroke="currentColor" />
          ))}
        </svg>

          <section className="dashboard-gradient-card mt-8 overflow-hidden shadow-xl shadow-[#0F172A]/8">
            <div className="relative z-1 space-y-7 p-5 sm:p-6 lg:p-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E0D6] bg-white text-[#0F172A] shadow-sm shadow-[#0F172A]/4 transition hover:-translate-y-0.5 hover:border-[#B9974D]" type="button" aria-label="Previous month">
                    <LineIcon name="left" className="h-6 w-6" />
                  </button>
                  <h2 className="px-2 text-2xl font-black tracking-tight text-[#0F172A] sm:text-3xl">June 2026</h2>
                  <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E0D6] bg-white text-[#0F172A] shadow-sm shadow-[#0F172A]/4 transition hover:-translate-y-0.5 hover:border-[#B9974D]" type="button" aria-label="Next month">
                    <LineIcon name="right" className="h-6 w-6" />
                  </button>
                  <button className="inline-flex h-12 items-center justify-center gap-3 rounded-xl bg-[#B9974D] px-5 text-sm font-black text-white shadow-lg shadow-[#B9974D]/20 transition hover:-translate-y-0.5 hover:bg-[#A98537]" type="button">
                    <LineIcon name="calendar" />
                    Today
                  </button>
                </div>

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
                      <div key={day} className="text-center text-xs font-black uppercase tracking-[0.08em] text-[#475569]">
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
                          hebrew={hebrewDates[index]}
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
      </section>
    </main>
  );
}
