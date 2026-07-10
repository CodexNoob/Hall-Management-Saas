"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { clearCachedSyncedUser, getCachedSyncedUser, syncSignedInUser, type SyncSignedInUserResponse } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type BadgeTone = "green" | "blue" | "gold" | "gray";
type ButtonTone = "outline" | "gold" | "navy" | "danger";

type EventRow = {
  title: string;
  details: string;
  badges: Array<{ label: string; tone: BadgeTone; icon: IconName }>;
  actions: Array<{ label: string; tone: ButtonTone; icon: IconName }>;
};

type IconName =
  | "home"
  | "bell"
  | "help"
  | "grid"
  | "calendar"
  | "search"
  | "hall"
  | "list"
  | "card"
  | "sliders"
  | "eye"
  | "printer"
  | "trash"
  | "plus"
  | "chevron"
  | "check"
  | "pause"
  | "menu";

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

  const paths: Record<IconName, ReactNode> = {
    home: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z" />,
    bell: <><path d="M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3Z" /><path d="M10 21h4" /></>,
    help: <><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="M9.8 9a2.4 2.4 0 0 1 4.4 1.3c0 1.8-2.2 2-2.2 3.7M12 17h.01" /></>,
    grid: <><path d="M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z" /></>,
    calendar: <><path d="M4 6h16v14H4ZM8 3v5M16 3v5M4 11h16" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    hall: <><path d="M4 20h16M6 20V9l6-4 6 4v11" /><path d="M9 20v-6h6v6M8 11h8" /></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    card: <><path d="M3 6h18v12H3Z" /><path d="M3 10h18M7 15h4" /></>,
    sliders: <><path d="M4 7h7M15 7h5M4 17h5M13 17h7M11 4v6M13 14v6" /><path d="M11 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM13 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    printer: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5h20v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6Z" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
    pause: <><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></>,
    menu: <><path d="M7 3v18M11 3v7a4 4 0 0 1-8 0V3M17 3v18M17 3c2 1.5 3 4 3 7v2h-3" /></>
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function SearchField() {
  return (
    <div className="flex h-14 min-w-0 items-center gap-3 rounded-xl border border-[#d8dde5] bg-[#ffffff] px-5 text-sm font-semibold text-[#6a7483] shadow-sm shadow-[#17202a]/4">
      <LineIcon name="search" className="h-6 w-6 shrink-0 text-[#17202a]" />
      <span className="truncate">Search client name or phone...</span>
    </div>
  );
}

function FilterSelect({ icon, label }: { icon: "hall" | "list" | "card"; label: string }) {
  return (
    <button className="flex h-14 min-w-0 items-center gap-3 rounded-xl border border-[#d8dde5] bg-[#ffffff] px-4 text-left text-sm font-bold text-[#6a7483] shadow-sm shadow-[#17202a]/4 transition hover:border-[#1f4d73]/70 hover:bg-white" type="button">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f6f8] text-[#6a7483]">
        <LineIcon name={icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <LineIcon name="chevron" className="h-4 w-4 shrink-0 text-[#17202a]" />
    </button>
  );
}

function StatusBadge({ label, tone, icon }: { label: string; tone: BadgeTone; icon: IconName }) {
  const classes = {
    green: "border-[#146c43] bg-[#eef4fa] text-[#146c43]",
    blue: "border-[#b9c2cf] bg-[#eef4fa] text-[#1f4d73]",
    gold: "border-[#9a5b00] bg-[#fbfcfd] text-[#9a5b00]",
    gray: "border-[#d8dde5] bg-[#fbfcfd] text-[#6a7483]"
  };

  return (
    <span className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-black ${classes[tone]}`}>
      <LineIcon name={icon} className="h-4 w-4" />
      {label}
    </span>
  );
}

function ActionButton({ label, tone, icon }: { label: string; tone: ButtonTone; icon: IconName }) {
  const classes = {
    outline: "border-[#b9c2cf] bg-white text-[#17202a] hover:bg-[#eef4fa]",
    gold: "border-[#1f4d73] bg-[#1f4d73] text-white shadow-lg shadow-[#1f4d73]/18 hover:bg-[#9a5b00]",
    navy: "border-[#1f4d73] bg-[#1f4d73] text-white shadow-lg shadow-[#1f4d73]/14 hover:bg-[#15344f]",
    danger: "border-[#a62b24] bg-white text-[#a62b24] hover:bg-[#fbfcfd]"
  };

  return (
    <button className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition hover:-translate-y-0.5 ${classes[tone]}`} type="button">
      <LineIcon name={icon} className="h-5 w-5" />
      {label}
    </button>
  );
}

function EventRowCard({ event }: { event: EventRow }) {
  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-[#d8dde5] bg-white p-5 shadow-lg shadow-[#17202a]/5 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-5 sm:items-center">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#d8dde5] bg-[#f5f6f8] text-[#1f4d73]">
          <LineIcon name="calendar" className="h-8 w-8" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-black tracking-tight text-[#17202a]">{event.title}</h2>
          <p className="mt-2 text-sm font-semibold text-[#6a7483]">{event.details}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 xl:min-w-90 xl:justify-start">
        {event.badges.map((badge) => (
          <StatusBadge key={badge.label} {...badge} />
        ))}
      </div>

      <div className="flex flex-wrap gap-3 xl:justify-end">
        {event.actions.map((action) => (
          <ActionButton key={action.label} {...action} />
        ))}
      </div>
    </article>
  );
}

const eventRows: EventRow[] = [
  {
    title: "Sample Wedding",
    details: "718-555-0199  •  Hall 1",
    badges: [
      { label: "Confirmed", tone: "green", icon: "check" },
      { label: "Deposit Paid", tone: "blue", icon: "card" }
    ],
    actions: [
      { label: "View", tone: "outline", icon: "eye" },
      { label: "Customize", tone: "outline", icon: "sliders" },
      { label: "Payment", tone: "gold", icon: "card" },
      { label: "Print PDF", tone: "navy", icon: "printer" },
      { label: "Delete", tone: "danger", icon: "trash" }
    ]
  },
  {
    title: "Sample Sheva Brachos",
    details: "917-555-0144  •  Hall 2",
    badges: [
      { label: "On Hold", tone: "gold", icon: "pause" },
      { label: "No Payment", tone: "gray", icon: "card" }
    ],
    actions: [
      { label: "View", tone: "outline", icon: "eye" },
      { label: "Customize", tone: "outline", icon: "sliders" },
      { label: "Menu", tone: "navy", icon: "menu" },
      { label: "Delete", tone: "danger", icon: "trash" }
    ]
  }
];

export function EventManagerPage() {
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
    <div className="min-h-screen bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Event Manager"
        onNewBooking={() => router.push("/dashboard/events")}
      />

      <div className="px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="rounded-[28px] border border-[#d8dde5] bg-white p-5 shadow-sm shadow-[#17202a]/4 sm:p-6 lg:p-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-[0.28em] text-[#1f4d73]">Route / Events</p>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-[#6a7483] sm:text-base">
                  Manage bookings, statuses, payments, and hall visibility from one place. <br />
                  Buttons and event visibility are controlled by user type permissions and hall access.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button className="inline-flex h-12 items-center justify-center gap-3 rounded-xl bg-[#1f4d73] px-5 text-sm font-black text-white shadow-lg shadow-[#1f4d73]/20 transition hover:-translate-y-0.5 hover:bg-[#9a5b00]" type="button">
                  <LineIcon name="plus" />
                  Add Event
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#d8dde5] bg-[#ffffff] p-5 shadow-sm shadow-[#17202a]/4">
              <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.8fr)_auto] xl:items-start">
                <SearchField />
                <button className="inline-flex h-12 items-center justify-center gap-3 rounded-xl border border-[#b9c2cf] bg-white px-5 text-sm font-black text-[#17202a] shadow-sm shadow-[#17202a]/4 transition hover:-translate-y-0.5 hover:bg-[#eef4fa]" type="button">
                  <LineIcon name="sliders" />
                  Clear Filters
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <FilterSelect icon="hall" label="All Halls" />
                <FilterSelect icon="list" label="All Statuses" />
                <FilterSelect icon="card" label="All Payments" />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {eventRows.map((event) => (
                <EventRowCard key={event.title} event={event} />
              ))}
            </div>
          </div>
      </div>
    </div>
  );
}
