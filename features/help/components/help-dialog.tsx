"use client";

import { useEffect } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Bug,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  Headphones,
  HelpCircle,
  Lightbulb,
  PlaySquare,
  Rocket,
  Search,
  Send,
  Shield,
  ShieldQuestion,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Utensils,
  X,
  Zap
} from "lucide-react";
import { AppInstallCard } from "@/features/help/components/app-install-card";
import {
  helpPages,
  type HelpPageKind
} from "@/features/help/components/help-page";

const NAVY = "#1f4d73";

const popularTopics = [
  { label: "Create Booking", icon: CalendarPlus },
  { label: "Manage Halls", icon: Building2 },
  { label: "Dining Manager", icon: Utensils },
  { label: "Billing & Payments", icon: CreditCard },
  { label: "Staff & Roles", icon: Users },
  { label: "Files & Documents", icon: FolderOpen }
];

const helpRows = [
  {
    title: "Getting Started",
    body: "Learn the basics and set up your account.",
    icon: Rocket
  },
  {
    title: "Event Workflow",
    body: "Step-by-step workflow from booking to event completion.",
    icon: ClipboardList
  },
  {
    title: "Hall Management",
    body: "Manage halls, availability, layouts, and rates.",
    icon: Building2
  },
  {
    title: "Dining & Kitchen",
    body: "Manage menus, kitchen orders, and dining services.",
    icon: Utensils
  },
  {
    title: "Billing & Payments",
    body: "Invoices, payments, refunds, and financial reports.",
    icon: CreditCard
  },
  {
    title: "Staff & Permissions",
    body: "Manage staff accounts and set role-based access.",
    icon: Users
  },
  {
    title: "Reports & Analytics",
    body: "View reports and insights about your events.",
    icon: BarChart3
  },
  {
    title: "Troubleshooting",
    body: "Solutions to common issues and error messages.",
    icon: ShieldQuestion
  }
];

const quickActions = [
  { label: "Watch Video Tutorials", icon: PlaySquare },
  { label: "Browse All Articles", icon: FileText },
  { label: "Contact Administrator", icon: Headphones },
  { label: "Report an Issue", icon: AlertTriangle },
  { label: "Request a Feature", icon: Lightbulb }
];

const faqs = [
  "How do I create a new booking?",
  "How do I cancel or reschedule an event?",
  "How do I send an invoice to a client?",
  "Can I duplicate an existing event?",
  "How do I archive a completed event?"
];

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f4d73] text-white shadow-lg shadow-[#1f4d73]/18">
      {children}
    </span>
  );
}

function HelpCenterHub({ onClose }: { onClose: () => void }) {
  return (
    <>
      <header className="border-b border-[#d8dde5] bg-white px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <IconTile>
            <HelpCircle className="h-5 w-5" />
          </IconTile>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#1f4d73]">
              Event Core Support
            </p>
            <h2
              className="mt-1 text-2xl font-black tracking-tight text-[#071427] sm:text-3xl"
              id="help-dialog-title"
            >
              Help Center
            </h2>
            <p className="mt-1.5 max-w-3xl text-xs leading-5 text-[#617086] sm:text-sm">
              Find answers and guides to help you manage your halls and events
              with Event Core.
            </p>
          </div>

          <button
            aria-label="Close Help Center"
            className="flex h-10 w-10 shrink-0 items-center justify-center text-[#071427] transition hover:text-[#1f4d73]"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f6f8] p-3 sm:p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0 space-y-3">
            <div className="flex min-h-11 items-center gap-2.5 rounded-xl border border-[#d8dde5] bg-white px-3 shadow-sm">
              <Search className="h-5 w-5 text-[#1f4d73]" />
              <input
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#071427] outline-none placeholder:text-[#7a879a] sm:text-sm"
                placeholder="Search help articles... (e.g. how to create a booking, cancel event, print invoice)"
                type="search"
              />
              <span className="hidden rounded-lg bg-[#f1f4f8] px-3 py-1.5 text-xs font-black text-[#7a879a] sm:inline">
                Ctrl + K
              </span>
            </div>

            <section className="rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm">
              <h3 className="text-sm font-black text-[#071427]">
                Popular Topics
              </h3>
              <div className="mt-2.5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                {popularTopics.map((topic) => {
                  const Icon = topic.icon;

                  return (
                    <button
                      className="group flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-2.5 text-center transition hover:border-[#1f4d73] hover:bg-[#eef4fa]"
                      key={topic.label}
                      type="button"
                    >
                      <Icon className="h-6 w-6 text-[#1f4d73]" />
                      <span className="text-[11px] font-bold leading-4 text-[#334155]">
                        {topic.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-2">
              {helpRows.map((row) => {
                const Icon = row.icon;

                return (
                  <button
                    className="grid min-h-11 grid-cols-[auto_minmax(0,180px)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-[#1f4d73] hover:bg-[#fbfcfd]"
                    key={row.title}
                    type="button"
                  >
                    <Icon className="h-5 w-5 text-[#1f4d73]" />
                    <span className="text-xs font-black text-[#071427] sm:text-sm">
                      {row.title}
                    </span>
                    <span className="hidden min-w-0 text-xs font-medium text-[#617086] md:block">
                      {row.body}
                    </span>
                    <ChevronDown className="h-4 w-4 text-[#1f4d73]" />
                  </button>
                );
              })}
            </section>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d8dde5] bg-[#eef4ff] px-3 py-2.5 text-xs text-[#1f4d73]">
              <div className="flex min-w-0 items-center gap-2">
                <Lightbulb className="h-4 w-4 shrink-0" />
                <p className="min-w-0 font-bold">
                  Tip: Press Ctrl + K anytime to search for articles quickly.
                </p>
              </div>
              <button
                className="hidden shrink-0 font-bold text-[#617086] sm:inline"
                type="button"
              >
                Don&apos;t show tips again
              </button>
              <X className="h-4 w-4 shrink-0" />
            </div>
          </main>

          <aside className="grid h-fit gap-3">
            <section className="rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#1f4d73]" />
                <h3 className="text-sm font-black text-[#071427]">Quick Actions</h3>
              </div>
              <div className="grid gap-1">
                {quickActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <button
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-[#eef4fa]"
                      key={action.label}
                      type="button"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#eef4fa]">
                        <Icon className="h-4 w-4 text-[#1f4d73]" />
                      </span>
                      <span className="min-w-0 flex-1 text-xs font-bold text-[#334155]">
                        {action.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-[#1f4d73]" />
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-[#1f4d73]" />
                <h3 className="text-sm font-black text-[#071427]">
                  Frequently Asked Questions
                </h3>
              </div>
              <div className="grid gap-1">
                {faqs.map((faq) => (
                  <button
                    className="flex items-center gap-2 rounded-lg py-1.5 text-left transition hover:bg-[#eef4fa]"
                    key={faq}
                    type="button"
                  >
                    <span className="min-w-0 flex-1 text-xs font-bold text-[#334155]">
                      {faq}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[#1f4d73]" />
                  </button>
                ))}
              </div>
              <button
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-[#1f4d73]"
                type="button"
              >
                View all FAQs
                <ChevronRight className="h-4 w-4" />
              </button>
            </section>

            <section className="rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm">
              <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#eef4ff]">
                  <Headphones className="h-8 w-8 text-[#1f4d73]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-[#071427]">
                    Need more help?
                  </h3>
                  <p className="mt-1.5 text-xs leading-5 text-[#617086]">
                    Our team is here to help you. Contact your administrator for
                    personalized support.
                  </p>
                </div>
              </div>
              <button
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-lg shadow-[#1f4d73]/18 transition hover:bg-[#15344f]"
                type="button"
              >
                Contact Administrator
                <Send className="h-4 w-4" />
              </button>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

function SimpleHelpContent({
  kind,
  onClose
}: {
  kind: HelpPageKind;
  onClose: () => void;
}) {
  const content = helpPages[kind];

  return (
    <>
      <header className="border-b border-[#d8dde5] bg-white px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <IconTile>
            {kind === "download-apps" ? (
              <Download className="h-5 w-5" />
            ) : (
              <HelpCircle className="h-5 w-5" />
            )}
          </IconTile>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1f4d73]">
              Event Core {content.eyebrow}
            </p>
            <h2
              className="mt-1 text-2xl font-black tracking-tight text-[#071427] sm:text-3xl"
              id="help-dialog-title"
            >
              {content.title}
            </h2>
            <p className="mt-1.5 max-w-3xl text-xs leading-5 text-[#617086] sm:text-sm">
              {content.subtitle}
            </p>
          </div>
          <button
            aria-label={`Close ${content.title}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-[#071427] transition hover:text-[#1f4d73]"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f6f8] p-3 sm:p-4">
        <div className="grid gap-3">
          {kind === "download-apps" ? <AppInstallCard /> : null}
          {kind !== "download-apps" ? content.sections.map((section) => (
            <article
              className="rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm"
              key={section.title}
            >
              <h3 className="text-sm font-black text-[#071427]">
                {section.title}
              </h3>
              <p className="mt-1.5 text-xs leading-5 text-[#617086] sm:text-sm sm:leading-6">
                {section.body}
              </p>
            </article>
          )) : null}
        </div>
      </div>
    </>
  );
}

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

const releaseNoteItems: Array<{
  assigned?: boolean;
  chef?: string;
  name: string;
  quantity: string;
  ratio: string;
  urgent?: boolean;
}> = [];

function LegacyReleaseNotesContent({ onClose }: { onClose: () => void }) {
  return (
    <>
      <header className="flex items-start gap-3 border-b border-[#d8dde5] bg-white px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#617086]">
            Kitchen production details
          </p>
          <h2
            className="mt-1 truncate text-xl font-black text-[#07162d]"
            id="help-dialog-title"
          >
            Graph Demo Event 16 Wedding
          </h2>
        </div>

        <button
          aria-label="Close Release Notes"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-[#17202a] transition hover:bg-[#eef4fa]"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f6f8] p-4 sm:p-5">
        <div className="mb-3 flex min-h-10 items-center justify-center rounded-lg bg-[#1f4d73] px-4 text-center text-sm font-black uppercase tracking-wide text-white">
          Confirmed
        </div>

        <div className="grid gap-4 rounded-xl border border-[#d8dde5] bg-white p-4 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="border-l-4 border-[#1f4d73] bg-[#f8fafc] p-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-[#617086]">
              Hall 1
            </p>
            <h3 className="mt-4 text-3xl font-black leading-tight text-[#07162d]">
              Graph Demo Event 16 Wedding
            </h3>
            <p className="mt-5 text-2xl font-black text-[#07162d]">
              138 portions
            </p>
            <p className="mt-7 text-sm font-black uppercase tracking-wide text-[#617086]">
              No package assigned
            </p>
          </aside>

          <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {releaseNoteItems.map((item) => (
              <article
                className={`flex min-h-33 flex-col justify-start border bg-white p-3 text-center shadow-sm ${
                  item.assigned
                    ? "border-[#17a967] bg-[#f4fff8]"
                    : item.urgent
                      ? "border-[#f0a326]"
                      : "border-[#d8dde5]"
                }`}
                key={item.name}
              >
                {item.chef ? (
                  <p
                    className={`mb-2 rounded px-2 py-1 text-[10px] font-black text-white ${
                      item.assigned ? "bg-[#0e6b3f]" : "bg-[#07162d]"
                    }`}
                  >
                    {item.chef}
                  </p>
                ) : null}
                <h4 className="text-base font-black leading-tight text-[#07162d]">
                  {item.name}
                </h4>
                <p className="mt-2 text-[11px] font-black leading-tight text-[#617086]">
                  {item.ratio}
                </p>
                <p className="mt-auto bg-[#eef4fa] px-2 py-1.5 text-xs font-black text-[#07162d]">
                  {item.quantity}
                </p>
                {item.urgent ? (
                  <p className="mt-1 rounded bg-[#d88a00] px-2 py-1.5 text-[10px] font-black text-white">
                    Chef approval needed
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ReleaseNotesContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="grid min-h-0 flex-1 overflow-hidden bg-white lg:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="hidden border-r border-[#d8dde5] bg-linear-to-b from-white to-[#f7fbff] p-6 lg:block">
        <div className="flex items-start gap-4">
          <IconTile>
            <HelpCircle className="h-5 w-5" />
          </IconTile>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#1f4d73]">
              Event Core Updates
            </p>
            <h2
              className="mt-2 text-3xl font-black tracking-tight text-[#071427]"
              id="help-dialog-title"
            >
              Release Notes
            </h2>
            <p className="mt-4 text-sm font-medium leading-7 text-[#4d5f78]">
              Track the latest improvements, fixes, and updates in EventCore
              version 2.1.0.
            </p>
          </div>
        </div>

        <div className="mt-12 space-y-6">
          <article className="rounded-xl border border-[#d8dde5] bg-white/80 p-5 shadow-sm">
            <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-lg shadow-[#2563eb]/20">
                <Check className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-black text-[#071427]">
                  You&apos;re using
                </p>
                <p className="mt-1 text-xl font-black text-[#071427]">
                  Version 2.1.0
                </p>
                <p className="mt-4 text-sm leading-6 text-[#4d5f78]">
                  Thank you for keeping EventCore up to date!
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-[#d8dde5] bg-white/80 p-5 shadow-sm">
            <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef4ff] text-[#2563eb]">
                <CalendarDays className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-black text-[#071427]">
                  Last updated
                </p>
                <p className="mt-1 text-xl font-black text-[#071427]">
                  July 29, 2026
                </p>
                <p className="mt-4 text-sm leading-6 text-[#4d5f78]">
                  We update regularly to make EventCore better for you.
                </p>
              </div>
            </div>
          </article>
        </div>

        <div className="mt-24 rounded-2xl bg-[#eef4ff] p-5 text-center">
          <div className="mx-auto flex h-20 w-32 items-center justify-center rounded-xl bg-white text-[#2563eb] shadow-lg shadow-[#1f4d73]/10">
            <Sparkles className="h-10 w-10" />
          </div>
          <p className="mt-4 text-sm font-black text-[#071427]">
            Fresh improvements are ready.
          </p>
        </div>
      </aside>

      <main className="flex min-h-0 flex-col">
        <header className="flex items-start gap-4 border-b border-[#d8dde5] bg-white px-5 py-5 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#1f4d73] lg:hidden">
              Event Core Updates
            </p>
            <h2 className="text-2xl font-black tracking-tight text-[#071427] sm:text-3xl lg:text-4xl">
              What&apos;s new in EventCore 2.1.0
            </h2>
            <p className="mt-2 text-sm font-medium text-[#4d5f78] sm:text-base">
              Here&apos;s everything we added and improved in this version.
            </p>
          </div>

          <button
            aria-label="Close Release Notes"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d8dde5] bg-white text-[#071427] shadow-sm transition hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfcfd] p-4 sm:p-5">
          <div className="space-y-3">
            {releaseGroups.map((group) => {
              const Icon = group.icon;
              const color = releaseColorClasses[group.color];

              return (
                <article
                  className="rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm sm:p-5"
                  key={group.title}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-lg ${color.icon}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className={`text-xl font-black ${color.title}`}>
                          {group.title}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black uppercase ${color.badge}`}
                          >
                            {group.status}
                          </span>
                          <ChevronDown className="h-5 w-5 text-[#1f4d73]" />
                        </div>
                      </div>

                      <ul className="mt-3 space-y-2 text-sm font-medium leading-6 text-[#071427]">
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

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d8dde5] bg-white px-5 py-3 sm:px-6">
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

export function HelpDialog({
  kind,
  onClose,
  open
}: {
  kind: HelpPageKind;
  onClose: () => void;
  open: boolean;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-[#071427]/70 p-3 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="help-dialog-title"
        aria-modal="true"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-[#f5f6f8] text-[#17202a] shadow-2xl shadow-[#071427]/35 sm:max-h-[calc(100dvh-48px)]"
        role="dialog"
      >
        {kind === "help-center" ? (
          <HelpCenterHub onClose={onClose} />
        ) : kind === "release-notes" ? (
          <ReleaseNotesContent onClose={onClose} />
        ) : (
          <SimpleHelpContent kind={kind} onClose={onClose} />
        )}
      </section>
    </div>
  );
}
