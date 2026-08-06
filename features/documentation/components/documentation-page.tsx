"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CirclePlay,
  CreditCard,
  FileText,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Users,
  Utensils
} from "lucide-react";

const guides = [
  {
    id: "getting-started",
    title: "Getting started",
    summary: "Sign in, create your organization, and understand the dashboard.",
    icon: LayoutDashboard,
    video: null,
    steps: [
      "Open Event Core and select Login from the top navigation.",
      "Enter the organization email and password provided by your administrator.",
      "Review the Dashboard cards, operating schedule, and sidebar sections.",
      "Open Settings to confirm your organization name, timezone, and notification preferences."
    ]
  },
  {
    id: "bookings-calendar",
    title: "Bookings and calendar",
    summary: "Create an event, check availability, and manage holds.",
    icon: CalendarDays,
    video: null,
    steps: [
      "Open Calendar and select New booking.",
      "Choose the event date, hall, start time, setup time, and cleanup time.",
      "Enter the client, event type, guest counts, package, and initial notes.",
      "Save as a tentative hold or confirmed booking.",
      "Open the saved event from Calendar or Event Manager to continue planning."
    ]
  },
  {
    id: "event-workspace",
    title: "Event workspace",
    summary:
      "Manage event details, timelines, files, vendors, and the client portal.",
    icon: FileText,
    video: null,
    steps: [
      "Open Events and select the event from the left-hand event list.",
      "Update Event details and save the client, status, guest counts, and notes.",
      "Build the event timeline, then save and confirm it.",
      "Use the Menu, Billing, Hall map, Kitchen, Vendors, and Files tabs to open connected workflows.",
      "Preview the client portal and copy its secure sharing link."
    ]
  },
  {
    id: "menu-kitchen",
    title: "Menu and kitchen",
    summary: "Build reusable menus and coordinate kitchen production.",
    icon: Utensils,
    video: null,
    steps: [
      "Open Menu and add food items to the Menu Library.",
      "Create a package and assign the appropriate library items.",
      "Open an event, select its Menu tab, and choose the required dishes.",
      "Confirm the event menu when the client selection is final.",
      "Open Kitchen to review portions, preparation status, notes, and assigned work."
    ]
  },
  {
    id: "billing",
    title: "Billing and payments",
    summary: "Create invoices, record payments, and review transactions.",
    icon: CreditCard,
    video: null,
    steps: [
      "Open Billing and select New invoice.",
      "Choose the event, add line items, set the due date, and save the draft.",
      "Send the invoice or open Stripe Checkout for online payment.",
      "Use Transactions to categorize, split, or match imported bank records.",
      "Review reports for revenue, outstanding balances, aging, and refunds."
    ]
  },
  {
    id: "staff-permissions",
    title: "Staff and permissions",
    summary: "Invite teammates and control what every role can access.",
    icon: Users,
    video: null,
    steps: [
      "Open Staff and select Add staff.",
      "Enter one or more email addresses and send the invitations.",
      "Select a staff member and choose Change role.",
      "Assign the appropriate role and review its permission preview.",
      "Use View profile to confirm contact details, status, last login, and permissions."
    ]
  },
  {
    id: "vendors-files",
    title: "Vendors and files",
    summary: "Organize suppliers and event documents.",
    icon: Store,
    video: null,
    steps: [
      "Open Vendors and create the supplier or service provider record.",
      "Add the vendor category and contact information.",
      "Open Files and create folders for contracts, layouts, menus, and billing documents.",
      "Upload files to the correct organization or event folder.",
      "Open an Event workspace to reach its connected Vendors and Files sections."
    ]
  },
  {
    id: "settings-security",
    title: "Settings and security",
    summary:
      "Configure organization preferences, integrations, and account security.",
    icon: Settings,
    video: null,
    steps: [
      "Open Settings from the dashboard sidebar or profile menu.",
      "Set the organization timezone, language, halls, and notification preferences.",
      "Configure Google Calendar, Gmail, payments, and branding when credentials are available.",
      "Review user access and remove accounts that should no longer enter the organization.",
      "Use a unique password and sign out from shared devices."
    ]
  }
] as const;

export function DocumentationPage() {
  const [selectedGuideId, setSelectedGuideId] = useState<string>(guides[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const visibleGuides = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return guides.filter((guide) =>
      `${guide.title} ${guide.summary} ${guide.steps.join(" ")}`
        .toLowerCase()
        .includes(query)
    );
  }, [searchQuery]);
  const selectedGuide =
    visibleGuides.find((guide) => guide.id === selectedGuideId) ??
    visibleGuides[0] ??
    null;

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-16 pt-20 text-[#17202a]">
      <section className="border-b border-[#d8dde5] bg-[#061126] px-5 py-12 text-white sm:px-8 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-[#f5c542]">
            <BookOpen className="h-5 w-5" /> Event Core learning center
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
            Step-by-step system documentation
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-lg">
            Learn each Event Core workflow with concise instructions and short
            tutorial videos.
          </p>
          <label className="mt-7 flex h-12 max-w-xl items-center gap-3 rounded-xl bg-white px-4 text-[#17202a] shadow-xl">
            <Search className="h-5 w-5 text-[#1f4d73]" />
            <span className="sr-only">Search documentation</span>
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search bookings, billing, staff…"
              type="search"
              value={searchQuery}
            />
          </label>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-3 py-6 sm:px-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="h-fit overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm">
          <header className="border-b border-[#d8dde5] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#6a7483]">
            Documentation topics
          </header>
          <nav className="p-2" aria-label="Documentation topics">
            {visibleGuides.map((guide) => {
              const Icon = guide.icon;
              const active = selectedGuide?.id === guide.id;
              return (
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${active ? "bg-[#1f4d73] text-white" : "hover:bg-[#eef4fa]"}`}
                  key={guide.id}
                  onClick={() => setSelectedGuideId(guide.id)}
                  type="button"
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1">{guide.title}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              );
            })}
            {!visibleGuides.length ? (
              <p className="p-4 text-sm text-[#6a7483]">
                No guides match your search.
              </p>
            ) : null}
          </nav>
        </aside>

        {selectedGuide ? (
          <article className="overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-sm">
            <header className="border-b border-[#d8dde5] p-5 sm:p-7">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eef4fa] text-[#1f4d73]">
                  <selectedGuide.icon className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-2xl font-black">{selectedGuide.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#6a7483]">
                    {selectedGuide.summary}
                  </p>
                </div>
              </div>
            </header>

            <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section>
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-[#1f4d73]">
                  <CheckCircle2 className="h-5 w-5" /> Instructions
                </h3>
                <ol className="mt-4 space-y-3">
                  {selectedGuide.steps.map((step, index) => (
                    <li
                      className="flex gap-3 rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-4 text-sm leading-6"
                      key={step}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1f4d73] text-xs font-black text-white">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <aside className="h-fit overflow-hidden rounded-2xl border border-[#d8dde5] bg-[#061126] text-white">
                <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_center,#1f4d73_0%,#061126_70%)]">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/10">
                    <CirclePlay className="h-9 w-9" />
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-black">Video tutorial</h3>
                  <p className="mt-2 text-xs leading-5 text-white/65">
                    The video slot is ready. Add the recorded tutorial for this
                    module to the documentation video library.
                  </p>
                </div>
              </aside>
            </div>
          </article>
        ) : null}
      </div>

      <section className="mx-auto max-w-7xl px-3 sm:px-8">
        <div className="flex items-start gap-3 rounded-2xl border border-[#b8d7c8] bg-[#effaf5] p-5 text-sm text-[#146c43]">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <p>
            <strong>Need more help?</strong> Open Help Center from the dashboard
            profile menu or contact your organization administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
