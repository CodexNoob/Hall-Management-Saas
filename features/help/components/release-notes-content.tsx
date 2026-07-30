"use client";

import {
  Bug,
  CalendarDays,
  Check,
  ChevronDown,
  HelpCircle,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  X
} from "lucide-react";

const releaseGroups = [
  {
    color: "green",
    icon: Sparkles,
    items: [
      "Added Download Apps page for easy access to the desktop application.",
      "Added Today Notes to quickly capture important reminders."
    ],
    status: "New",
    title: "New Features"
  },
  {
    color: "blue",
    icon: TrendingUp,
    items: [
      "Dashboard financial and event timeline widgets now provide clearer visual summaries for filtered periods.",
      "Hall room map presets now scale better across devices and support compact dropdown controls.",
      "Dining manager setup screens now adapt more cleanly on phone, tablet, laptop, and desktop layouts.",
      "Improved performance when loading large events and bookings.",
      "Enhanced filtering and sorting in events, bookings, and billing.",
      "UI and responsiveness improvements across the application."
    ],
    status: "Improved",
    title: "Improvements"
  },
  {
    color: "orange",
    icon: Bug,
    items: [
      "Fixed duplicate booking issue in certain conditions.",
      "Fixed hall room map alignment on smaller screens.",
      "Fixed dining manager save error on slow connections.",
      "Fixed incorrect total in billing summary after discounts.",
      "Fixed calendar not showing updated events immediately."
    ],
    status: "Fixed",
    title: "Bug Fixes"
  },
  {
    color: "purple",
    icon: Shield,
    items: ["Enhanced session security and token refresh handling."],
    status: "Security",
    title: "Security"
  }
] as const;

const releaseColorClasses = {
  blue: {
    badge: "bg-[#e5efff] text-[#2563eb]",
    icon: "bg-[#2563eb] text-white shadow-[#2563eb]/20",
    title: "text-[#2563eb]"
  },
  green: {
    badge: "bg-[#dff7e9] text-[#0f8a55]",
    icon: "bg-[#0f9f63] text-white shadow-[#0f9f63]/20",
    title: "text-[#0f8a55]"
  },
  orange: {
    badge: "bg-[#ffead5] text-[#ea580c]",
    icon: "bg-[#f97316] text-white shadow-[#f97316]/20",
    title: "text-[#ea580c]"
  },
  purple: {
    badge: "bg-[#ede9fe] text-[#5b3fd4]",
    icon: "bg-[#6d4ce8] text-white shadow-[#6d4ce8]/20",
    title: "text-[#5b3fd4]"
  }
} as const;

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f4d73] text-white shadow-lg shadow-[#1f4d73]/18">
      {children}
    </span>
  );
}

export function ReleaseNotesContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="grid min-h-0 flex-1 overflow-hidden bg-white lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="hidden border-r border-[#d8dde5] bg-linear-to-b from-white to-[#f7fbff] p-4 lg:block">
        <div className="flex items-start gap-3">
          <IconTile>
            <HelpCircle className="h-5 w-5" />
          </IconTile>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#1f4d73]">
              Event Core Updates
            </p>
            <h2
              className="mt-1 text-2xl font-black tracking-tight text-[#071427]"
              id="help-dialog-title"
            >
              Release Notes
            </h2>
            <p className="mt-2 text-xs font-medium leading-5 text-[#4d5f78]">
              Track the latest improvements, fixes, and updates in EventCore
              version 2.1.0.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <article className="rounded-xl border border-[#d8dde5] bg-white/80 p-3 shadow-sm">
            <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-lg shadow-[#2563eb]/20">
                <Check className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-black text-[#071427]">
                  You&apos;re using
                </p>
                <p className="mt-0.5 text-base font-black text-[#071427]">
                  Version 2.1.0
                </p>
                <p className="mt-2 text-xs leading-5 text-[#4d5f78]">
                  Thank you for keeping EventCore up to date!
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-[#d8dde5] bg-white/80 p-3 shadow-sm">
            <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef4ff] text-[#2563eb]">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-black text-[#071427]">
                  Last updated
                </p>
                <p className="mt-0.5 text-base font-black text-[#071427]">
                  July 29, 2026
                </p>
                <p className="mt-2 text-xs leading-5 text-[#4d5f78]">
                  We update regularly to make EventCore better for you.
                </p>
              </div>
            </div>
          </article>
        </div>

        <div className="mt-8 rounded-xl bg-[#eef4ff] p-3 text-center">
          <div className="mx-auto flex h-14 w-24 items-center justify-center rounded-lg bg-white text-[#2563eb] shadow-lg shadow-[#1f4d73]/10">
            <Sparkles className="h-7 w-7" />
          </div>
          <p className="mt-3 text-xs font-black text-[#071427]">
            Fresh improvements are ready.
          </p>
        </div>
      </aside>

      <main className="flex min-h-0 flex-col">
        <header className="flex items-start gap-3 border-b border-[#d8dde5] bg-white px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#1f4d73] lg:hidden">
              Event Core Updates
            </p>
            <h2 className="text-2xl font-black tracking-tight text-[#071427] sm:text-3xl">
              What&apos;s new in EventCore 2.1.0
            </h2>
            <p className="mt-1.5 text-xs font-medium text-[#4d5f78] sm:text-sm">
              Here&apos;s everything we added and improved in this version.
            </p>
          </div>

          <button
            aria-label="Close Release Notes"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d8dde5] bg-white text-[#071427] shadow-sm transition hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfcfd] p-3 sm:p-4">
          <div className="space-y-3">
            {releaseGroups.map((group) => {
              const Icon = group.icon;
              const color = releaseColorClasses[group.color];

              return (
                <article
                  className="rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm"
                  key={group.title}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-lg ${color.icon}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className={`text-base font-black ${color.title}`}>
                          {group.title}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${color.badge}`}
                          >
                            {group.status}
                          </span>
                          <ChevronDown className="h-4 w-4 text-[#1f4d73]" />
                        </div>
                      </div>

                      <ul className="mt-2 space-y-1.5 text-xs font-medium leading-5 text-[#071427] sm:text-sm">
                        {group.items.map((item) => (
                          <li
                            className="grid grid-cols-[14px_minmax(0,1fr)_120px] gap-2 max-md:grid-cols-[14px_minmax(0,1fr)]"
                            key={item}
                          >
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#071427]" />
                            <span>{item}</span>
                            <span className="inline-flex items-center justify-end gap-2 text-xs font-bold text-[#617086] max-md:hidden">
                              <CalendarDays className="h-4 w-4" />
                              Jul 29, 2026
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d8dde5] bg-white px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[#1f4d73]">
              <HelpCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-[#071427]">
                Thank you for using EventCore!
              </p>
              <p className="text-xs font-medium text-[#4d5f78]">
                We&apos;re constantly working to make your experience better.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[#4d5f78]">
              Was this helpful?
            </span>
            <button
              className="flex h-10 items-center gap-2 rounded-lg border border-[#d8dde5] bg-[#f8fafc] px-4 text-sm font-black text-[#071427] transition hover:bg-[#eef4fa]"
              type="button"
            >
              <ThumbsUp className="h-5 w-5 text-[#1f4d73]" />
              Yes
            </button>
            <button
              className="flex h-10 items-center gap-2 rounded-lg border border-[#d8dde5] bg-[#f8fafc] px-4 text-sm font-black text-[#071427] transition hover:bg-[#eef4fa]"
              type="button"
            >
              <ThumbsDown className="h-5 w-5 text-[#1f4d73]" />
              No
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
