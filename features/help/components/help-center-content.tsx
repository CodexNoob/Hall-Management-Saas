"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Headphones,
  HelpCircle,
  Lightbulb,
  Search,
  Settings,
  ShieldQuestion,
  Users,
  Utensils,
  X,
  Zap
} from "lucide-react";
import { SupportCenterPanel } from "@/features/support/components/support-center-panel";

const popularTopics = [
  { label: "New Booking", icon: CalendarPlus },
  { label: "Calendar", icon: CalendarDays },
  { label: "Events", icon: ClipboardList },
  { label: "Menu", icon: FileText },
  { label: "Kitchen", icon: Utensils },
  { label: "Staff", icon: Users },
  { label: "Settings", icon: Settings }
];

const helpRows = [
  {
    title: "Bookings & Calendar",
    body: "Check availability quickly, create holds or bookings, and manage event dates without leaving the calendar flow.",
    details: [
      "Use the calendar to scan open dates, closed dates, and room activity.",
      "Create a booking with basic contact details, hall/date, and expected guest counts.",
      "Use Settings to manage halls and calendar availability rules."
    ],
    icon: CalendarDays
  },
  {
    title: "Event Manager",
    body: "Manage event details, guest counts, timelines, menu selections, client portal sharing, and kitchen visibility.",
    details: [
      "Select an event from the event list first.",
      "Use Event details for contact information, guest breakdowns, dietary notes, and timeline milestones.",
      "Use Client portal when the host needs to submit final menu selections from their phone.",
      "On mobile, expand the selected event to view its sections cleanly."
    ],
    icon: ClipboardList
  },
  {
    title: "Menu & Client Portal",
    body: "Build menu libraries, packages, buffet/plated items, add-ons, photos, and client-facing selection options.",
    details: [
      "Use Menu Library, Packages, Buffet Menu, Plated Menu, and Add-ons to build reusable menu items.",
      "Attach clear food photos so clients can choose from the portal on mobile.",
      "Review submitted selections from the event workspace before sending them to the kitchen."
    ],
    icon: FileText
  },
  {
    title: "Kitchen Dashboard",
    body: "Track the dishes that need prep, who owns each item, and what is ready for service.",
    details: [
      "Use Today, This Week, or 4 Weeks to match the kitchen's working view.",
      "Mark dishes Pending, In Prep, Complete, or Ready as production moves forward.",
      "Assign workers to menu items so ownership is clear during service."
    ],
    icon: Utensils
  },
  {
    title: "Staff & Permissions",
    body: "Add staff, assign roles, manage access, and keep dashboard permissions aligned with each team member.",
    details: [
      "Add staff from the Staff page.",
      "Assign roles based on the pages each staff member should access.",
      "Review role templates before giving kitchen, events, menu, staff, or settings permissions."
    ],
    icon: Users
  },
  {
    title: "Settings & Integrations",
    body: "Configure language, halls, Google Calendar, Gmail, PDF branding, and activity logs.",
    details: [
      "Use Halls to manage the rooms shown in booking forms.",
      "Use Gmail and Google Calendar to check integration status.",
      "Use PDF & Branding to control exported document identity."
    ],
    icon: Settings
  },
  {
    title: "Troubleshooting",
    body: "Fix login/session errors, missing deployment updates, permission issues, and browser refresh problems.",
    details: [
      "If a section says invalid session, sign out and sign back in.",
      "If a user cannot open a page, confirm their staff role includes that page.",
      "If production does not update, confirm the production domain is assigned to the newest deployment."
    ],
    icon: ShieldQuestion
  }
];

const quickActions = [
  {
    label: "Create a Booking Guide",
    detail:
      "Open New booking, enter the client/event details, choose hall/date, then save or create proposal.",
    icon: CalendarPlus
  },
  {
    label: "Event Manager Checklist",
    detail:
      "Confirm event details, guest counts, dietary notes, menu, client portal sharing, timeline, and kitchen status.",
    icon: ClipboardList
  },
  {
    label: "Client Portal Guide",
    detail:
      "Send the portal link, let the host review menu photos, then confirm their submitted choices in Events.",
    icon: FileText
  },
  {
    label: "Kitchen Handoff Guide",
    detail:
      "Open the kitchen view for the event, assign workers, and update each dish as prep moves forward.",
    icon: Utensils
  },
  {
    label: "Contact Administrator",
    detail:
      "Ask your organization admin for permission changes, staff access, or integration setup help.",
    icon: Headphones
  },
  {
    label: "Report an Issue",
    detail:
      "Include the page name, event name, screenshot, and the steps that caused the issue.",
    icon: AlertTriangle
  }
];

const faqs = [
  {
    question: "How do I check if a date is open for a new event?",
    answer:
      "Open Calendar, scan the target date or date range, and check the hall activity before creating a hold or booking."
  },
  {
    question: "How do I add another hall to the Hall / Room dropdown?",
    answer:
      "Create the hall in Settings. Once saved, it becomes available in booking hall/room dropdowns."
  },
  {
    question: "How do clients submit final menu selections?",
    answer:
      "Open the event workspace, use Client portal, send the portal link, and review the submitted choices from the event."
  },
  {
    question:
      "How do I know if a dish can still be changed?",
    answer:
      "Check the event's Kitchen section or the Kitchen Dashboard. If the dish is already In Prep or Ready, coordinate with the kitchen before changing it."
  },
  {
    question: "How do I report a problem?",
    answer:
      "Open Help, choose Report a problem, and include the page name, event name, screenshot, and steps that caused the issue."
  }
];

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f4d73] text-white shadow-lg shadow-[#1f4d73]/18">
      {children}
    </span>
  );
}

export function HelpCenterContent({
  initialSupportFormOpen = false,
  onClose
}: {
  initialSupportFormOpen?: boolean;
  onClose: () => void;
}) {
  const [openGuide, setOpenGuide] = useState("");
  const [openAction, setOpenAction] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSupportFormOpen, setIsSupportFormOpen] = useState(
    initialSupportFormOpen
  );
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleHelpRows = helpRows.filter((row) =>
    `${row.title} ${row.body} ${row.details.join(" ")}`
      .toLowerCase()
      .includes(normalizedSearch)
  );

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
              Find dashboard-specific guides for bookings, events, menu
              selections, kitchen production, staff, and settings.
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
                placeholder="Search help articles... (e.g. create booking, client portal, kitchen)"
                onChange={(event) => setSearchQuery(event.target.value)}
                type="search"
                value={searchQuery}
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
                      onClick={() => {
                        setSearchQuery(topic.label);
                        const match = helpRows.find((row) =>
                          `${row.title} ${row.body}`
                            .toLowerCase()
                            .includes(topic.label.toLowerCase())
                        );
                        setOpenGuide(match?.title ?? "");
                      }}
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
              {visibleHelpRows.map((row) => {
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
                      onClick={() => setOpenGuide(isOpen ? "" : row.title)}
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
                onClick={(event) =>
                  event.currentTarget.closest("div")?.remove()
                }
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
                        onClick={() => {
                          if (action.label === "Report an Issue") {
                            setIsSupportFormOpen(true);
                            return;
                          }
                          setOpenAction(isOpen ? null : action.label);
                        }}
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
                    <div
                      className="rounded-lg transition hover:bg-[#eef4fa]"
                      key={faq.question}
                    >
                      <button
                        aria-expanded={isOpen}
                        className="flex w-full items-center gap-2 py-1.5 text-left"
                        onClick={() =>
                          setOpenFaq(
                            openFaq === faq.question ? null : faq.question
                          )
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

            <SupportCenterPanel
              formOpen={isSupportFormOpen}
              onFormClose={() => setIsSupportFormOpen(false)}
              onFormOpen={() => setIsSupportFormOpen(true)}
            />
          </aside>
        </div>
      </div>
    </>
  );
}
