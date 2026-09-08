"use client";

import { DashboardTopbar } from "@/components/layout/dashboard-topbar";

export type HelpPageKind =
  | "help-center"
  | "report-problem"
  | "release-notes"
  | "terms-of-service"
  | "privacy-policy";

export const helpPages: Record<
  HelpPageKind,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    sections: Array<{ title: string; body: string }>;
  }
> = {
  "help-center": {
    eyebrow: "Support",
    title: "Help Center",
    subtitle: "Find quick guidance for running your venue with Event Core.",
    sections: [
      {
        title: "Getting started",
        body: "Use the dashboard to review daily activity, create bookings, manage event details, and track your operating schedule."
      },
      {
        title: "Daily workflow",
        body: "Start with Calendar availability, then move through Events, Menu, Client portal, and Kitchen as each event gets closer."
      },
      {
        title: "Need support?",
        body: "Collect the event name, date, and the page where the issue happens before contacting your administrator or support team."
      }
    ]
  },
  "release-notes": {
    eyebrow: "Updates",
    title: "Release Notes",
    subtitle: "Track recent improvements and fixes added to Event Core.",
    sections: [
      {
        title: "Dashboard improvements",
        body: "Phase 1 dashboard pages now focus on booking availability, event management, menu planning, kitchen visibility, staff access, and settings."
      },
      {
        title: "Events improvements",
        body: "Event workspaces now keep the active Phase 1 tools easier to reach across desktop and mobile browsers."
      },
      {
        title: "Kitchen improvements",
        body: "Kitchen workflows now prioritize production status, assignment, and service timing without extra Phase 2 modules in the way."
      }
    ]
  },
  "report-problem": {
    eyebrow: "Support",
    title: "Report a problem",
    subtitle: "Send a trackable support request to the Event Core team.",
    sections: []
  },
  "terms-of-service": {
    eyebrow: "Legal",
    title: "Terms of Service",
    subtitle: "Review the expected use of Event Core in your organization.",
    sections: [
      {
        title: "Authorized use",
        body: "Use Event Core only for legitimate venue, booking, event, menu, kitchen, staff, and operational management work."
      },
      {
        title: "Account responsibility",
        body: "Each user is responsible for activity performed under their account and should keep login access secure."
      },
      {
        title: "Data accuracy",
        body: "Your organization is responsible for entering accurate booking, client, event, menu, kitchen, and staff information."
      }
    ]
  },
  "privacy-policy": {
    eyebrow: "Privacy",
    title: "Privacy Policy",
    subtitle: "Understand how venue and event data should be handled.",
    sections: [
      {
        title: "Operational data",
        body: "Event Core stores information needed to run bookings, events, menu planning, kitchen production, and team workflows."
      },
      {
        title: "Access control",
        body: "User roles and permissions should limit access to the information each team member needs for their work."
      },
      {
        title: "Responsible handling",
        body: "Client names, schedules, menu selections, and internal notes should be treated as private business information."
      }
    ]
  }
};

export function HelpPage({ kind }: { kind: HelpPageKind }) {
  const page = helpPages[kind];

  return (
    <div className="dashboard-readable-page flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        showSearch={false}
        subtitle={page.subtitle}
        title={page.title}
      />

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto grid w-full max-w-6xl gap-4">
          <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
            <header className="border-b border-[#d8dde5] p-4 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1f4d73]">
                {page.eyebrow}
              </p>
              <h1 className="mt-2 text-2xl font-black text-[#17202a]">
                {page.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#617086]">
                {page.subtitle}
              </p>
            </header>

            <div className="grid gap-3 p-4 sm:p-5">
              {page.sections.map((section) => (
                <article
                  className="rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-4"
                  key={section.title}
                >
                  <h2 className="text-base font-black">{section.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#59677c]">
                    {section.body}
                  </p>
                </article>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
