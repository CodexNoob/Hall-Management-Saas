"use client";

import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  FolderOpen,
  Headphones,
  HelpCircle,
  Lightbulb,
  PlaySquare,
  Rocket,
  Search,
  Send,
  ShieldQuestion,
  Users,
  Utensils,
  X,
  Zap
} from "lucide-react";

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

export function HelpCenterContent({ onClose }: { onClose: () => void }) {
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
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-[#1f4d73] hover:bg-[#fbfcfd] md:grid md:grid-cols-[auto_minmax(0,180px)_minmax(0,1fr)_auto]"
                    key={row.title}
                    type="button"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-[#1f4d73]" />
                    <span className="min-w-0 flex-1 text-xs font-black text-[#071427] sm:text-sm md:flex-none">
                      {row.title}
                    </span>
                    <span className="hidden min-w-0 text-xs font-medium text-[#617086] md:block">
                      {row.body}
                    </span>
                    <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[#1f4d73] md:ml-0" />
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
                <h3 className="text-sm font-black text-[#071427]">
                  Quick Actions
                </h3>
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
