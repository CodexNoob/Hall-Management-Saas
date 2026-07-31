"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarPlus,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  FolderOpen,
  Headphones,
  HelpCircle,
  Lightbulb,
  Rocket,
  Search,
  Send,
  Settings,
  ShieldQuestion,
  Users,
  Utensils,
  X,
  Zap
} from "lucide-react";

const popularTopics = [
  { label: "New Booking", icon: CalendarPlus },
  { label: "Calendar", icon: CalendarDays },
  { label: "Events", icon: ClipboardList },
  { label: "Kitchen", icon: Utensils },
  { label: "Billing", icon: CreditCard },
  { label: "Hall Maps", icon: Building2 }
];

const helpRows = [
  {
    title: "Dashboard Overview",
    body: "Read total events, booked events, income timeline, operating schedule, and urgent action items.",
    details: [
      "Use Total Events for the whole-year event count.",
      "Use Booked Events to compare confirmed and on-hold bookings.",
      "Use Operating Schedule for the next active work items."
    ],
    icon: Rocket
  },
  {
    title: "Bookings & Calendar",
    body: "Create bookings, review room availability, select date ranges, and open Today Notes.",
    details: [
      "Click New booking from the top bar to start a booking.",
      "Use Month Calendar to review event dates and room activity.",
      "Use Availability and Settings to manage date ranges and closed dates."
    ],
    icon: CalendarDays
  },
  {
    title: "Event Manager",
    body: "Manage event details, menus, billing, client portal sharing, files, vendors, timeline, and kitchen views.",
    details: [
      "Select an event from the event list first.",
      "Open sections like Event details, Menu, Billing, Client portal, Kitchen, Files, Vendors, and Timeline.",
      "On mobile, expand the selected event to view its sections cleanly."
    ],
    icon: ClipboardList
  },
  {
    title: "Menu & Kitchen",
    body: "Build menu libraries, packages, buffet/plated items, and track kitchen production by day, week, or four weeks.",
    details: [
      "Use Menu Library, Packages, Buffet Menu, Plated Menu, and Add-ons to build reusable menu items.",
      "Use Kitchen Dashboard to view production by Today, This Week, or 4 Weeks.",
      "Click a kitchen event to open full production details."
    ],
    icon: Utensils
  },
  {
    title: "Dining Manager",
    body: "Select an event, check seating, add required tables, and prepare dining setup work.",
    details: [
      "Choose an organization event from the Events panel.",
      "Use Check seating before finalizing required tables.",
      "Add required tables for the selected event workspace."
    ],
    icon: BarChart3
  },
  {
    title: "Halls & Room Maps",
    body: "Create halls, assign map presets, place shapes, and keep phone users in view-only mode.",
    details: [
      "Create a hall before assigning a room map preset.",
      "Use the shape library to add tables and objects to the map.",
      "Phone-sized screens are view-only to prevent accidental layout edits."
    ],
    icon: Building2
  },
  {
    title: "Files, Clients & Vendors",
    body: "Organize Event Core Files, client records, vendor records, and documents for each organization.",
    details: [
      "New folders and files go inside Event Core Files by default.",
      "Use Clients for contact and event relationship records.",
      "Use Vendors for outside services connected to events."
    ],
    icon: FolderOpen
  },
  {
    title: "Billing & Invoices",
    body: "Review transactions, create invoices, record payments, print statements, and track open balances.",
    details: [
      "Use Dashboard for financial summary and timeline.",
      "Use Transactions to review imported or manually recorded payments.",
      "Use Invoices and Event Billing to create invoices, record payments, and print statements."
    ],
    icon: CreditCard
  },
  {
    title: "Staff & Permissions",
    body: "Add staff, assign roles, manage access, and keep dashboard permissions aligned with each team member.",
    details: [
      "Add staff from the Staff page.",
      "Assign roles based on the pages each staff member should access.",
      "Review role templates before giving billing, settings, or file permissions."
    ],
    icon: Users
  },
  {
    title: "Settings & Integrations",
    body: "Configure language, halls, Google Calendar, Payments & Gmail, PDF branding, and activity logs.",
    details: [
      "Use Halls to manage the rooms shown in booking forms.",
      "Use Payments & Gmail and Google Calendar to check integration status.",
      "Use PDF & Branding to control exported document identity."
    ],
    icon: Settings
  },
  {
    title: "Troubleshooting",
    body: "Fix login/session errors, missing deployment updates, Supabase access issues, and desktop app startup problems.",
    details: [
      "If the desktop app shows old UI, deploy the web app first and reopen the app.",
      "If a section says invalid session, sign out and sign back in.",
      "If Vercel production does not update, confirm the production domain is assigned to the newest deployment."
    ],
    icon: ShieldQuestion
  }
];

const quickActions = [
  {
    label: "Create a Booking Guide",
    detail: "Open New booking, enter the client/event details, choose hall/date, then save or create proposal.",
    icon: CalendarPlus
  },
  {
    label: "Event Manager Checklist",
    detail: "Confirm event details, menu, billing, client portal sharing, hall map, vendors, files, and timeline.",
    icon: ClipboardList
  },
  {
    label: "Billing & Invoice Help",
    detail: "Use Event Billing to create invoices, record payments, and print statements for the selected event.",
    icon: CreditCard
  },
  {
    label: "Desktop App Install Guide",
    detail: "Download the Windows installer, install Event Core, then log in with your organization account.",
    icon: FileText
  },
  {
    label: "Contact Administrator",
    detail: "Ask your organization admin for permission changes, staff access, or integration setup help.",
    icon: Headphones
  },
  {
    label: "Report an Issue",
    detail: "Include the page name, event name, screenshot, and the steps that caused the issue.",
    icon: AlertTriangle
  }
];

const faqs = [
  {
    question: "Why does the dashboard show different Total Events and Booked Events?",
    answer:
      "Total Events counts the selected year. Booked Events focuses on confirmed and on-hold bookings for the active dashboard period."
  },
  {
    question: "How do I add another hall to the Hall / Room dropdown?",
    answer:
      "Create the hall in Settings or Hall Room Map hall controls. Once saved, it becomes available in booking hall/room dropdowns."
  },
  {
    question: "How do I assign a hall room map preset to a hall?",
    answer:
      "Open Hall Room Map, select a map preset, choose a hall in Assign to Hall, then save the map assignment."
  },
  {
    question: "Why can phone users only view the hall map instead of editing it?",
    answer:
      "Phone screens are view-only to prevent accidental drag, resize, or delete actions while reviewing layouts."
  },
  {
    question: "How do I create an invoice or record a payment for an event?",
    answer:
      "Open Billing or Event Manager > Billing, choose the event, then use Create invoice or Record payment."
  }
];

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f4d73] text-white shadow-lg shadow-[#1f4d73]/18">
      {children}
    </span>
  );
}

export function HelpCenterContent({ onClose }: { onClose: () => void }) {
  const [openGuide, setOpenGuide] = useState("");
  const [openAction, setOpenAction] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [showAllFaqs, setShowAllFaqs] = useState(false);

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
              Find dashboard-specific guides for bookings, kitchen production,
              dining, hall maps, files, billing, staff, vendors, and settings.
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
                placeholder="Search help articles... (e.g. create booking, assign hall map, record payment)"
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
                const isOpen = openGuide === row.title;

                return (
                  <article
                    className="overflow-hidden rounded-lg border border-[#d8dde5] bg-white shadow-sm transition hover:border-[#1f4d73]"
                    key={row.title}
                  >
                    <button
                      aria-expanded={isOpen}
                      className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[#fbfcfd] md:grid md:grid-cols-[auto_minmax(0,180px)_minmax(0,1fr)_auto]"
                      onClick={() =>
                        setOpenGuide(isOpen ? "" : row.title)
                      }
                      type="button"
                    >
                      <Icon className="h-5 w-5 shrink-0 text-[#1f4d73]" />
                      <span className="min-w-0 flex-1 text-xs font-black text-[#071427] sm:text-sm md:flex-none">
                        {row.title}
                      </span>
                      <span className="hidden min-w-0 text-xs font-medium text-[#617086] md:block">
                        {row.body}
                      </span>
                      <ChevronDown
                        className={`ml-auto h-4 w-4 shrink-0 text-[#1f4d73] transition-transform md:ml-0 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {isOpen ? (
                      <div className="border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-3">
                        <p className="text-xs font-semibold leading-5 text-[#617086] md:hidden">
                          {row.body}
                        </p>
                        <ul className="mt-2 grid gap-1.5 text-xs font-medium leading-5 text-[#334155] md:mt-0">
                          {row.details.map((detail) => (
                            <li
                              className="grid grid-cols-[8px_minmax(0,1fr)] gap-2"
                              key={detail}
                            >
                              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#1f4d73]" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
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
                <h3 className="text-sm font-black text-[#071427]">
                  Quick Actions
                </h3>
              </div>
              <div className="grid gap-1">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  const isOpen = openAction === action.label;

                  return (
                    <div
                      className="rounded-lg transition hover:bg-[#eef4fa]"
                      key={action.label}
                    >
                      <button
                        aria-expanded={isOpen}
                        className="flex w-full items-center gap-2.5 px-2 py-2 text-left"
                        onClick={() =>
                          setOpenAction(isOpen ? null : action.label)
                        }
                        type="button"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#eef4fa]">
                          <Icon className="h-4 w-4 text-[#1f4d73]" />
                        </span>
                        <span className="min-w-0 flex-1 text-xs font-bold text-[#334155]">
                          {action.label}
                        </span>
                        <ChevronRight
                          className={`h-4 w-4 text-[#1f4d73] transition-transform ${
                            isOpen ? "rotate-90" : ""
                          }`}
                        />
                      </button>
                      {isOpen ? (
                        <p className="px-2 pb-2 pl-11 text-xs font-medium leading-5 text-[#617086]">
                          {action.detail}
                        </p>
                      ) : null}
                    </div>
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
                {faqs.map((faq) => {
                  const isOpen = showAllFaqs || openFaq === faq.question;

                  return (
                    <div className="rounded-lg transition hover:bg-[#eef4fa]" key={faq.question}>
                      <button
                        aria-expanded={isOpen}
                        className="flex w-full items-center gap-2 py-1.5 text-left"
                        onClick={() =>
                          setOpenFaq(openFaq === faq.question ? null : faq.question)
                        }
                        type="button"
                      >
                        <span className="min-w-0 flex-1 text-xs font-bold text-[#334155]">
                          {faq.question}
                        </span>
                        <ChevronRight
                          className={`h-4 w-4 text-[#1f4d73] transition-transform ${
                            isOpen ? "rotate-90" : ""
                          }`}
                        />
                      </button>
                      {isOpen ? (
                        <p className="pb-2 pr-2 text-xs font-medium leading-5 text-[#617086]">
                          {faq.answer}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <button
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-[#1f4d73]"
                onClick={() => {
                  setShowAllFaqs((current) => !current);
                  setOpenFaq(null);
                }}
                type="button"
              >
                {showAllFaqs ? "Collapse FAQs" : "View all FAQs"}
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${
                    showAllFaqs ? "rotate-90" : ""
                  }`}
                />
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
                    Need help with a booking, invoice, hall map, or staff
                    permission? Contact your administrator for support.
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
