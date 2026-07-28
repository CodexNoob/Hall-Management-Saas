"use client";

import Link from "next/link";
import type { Route } from "next";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { AppInstallCard } from "@/features/help/components/app-install-card";

export type HelpPageKind =
  | "help-center"
  | "release-notes"
  | "download-apps"
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
        body: "Start with Dashboard, then move through Events, Dining Manager, Kitchen, and Billing as each event gets closer."
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
        body: "Financial and event timeline widgets now provide clearer visual summaries for filtered periods."
      },
      {
        title: "Hall room map updates",
        body: "Hall map presets now scale better across devices and support compact dropdown controls."
      },
      {
        title: "Dining manager updates",
        body: "Dining setup screens now adapt more cleanly on phone, tablet, laptop, and desktop layouts."
      }
    ]
  },
  "download-apps": {
    eyebrow: "Apps",
    title: "Download Apps",
    subtitle: "Install Event Core as a desktop app or mobile app wrapper.",
    sections: [
      {
        title: "Desktop and laptop",
        body: "For a client-ready desktop installer, build the Electron wrapper after setting EVENT_CORE_APP_URL to your deployed Event Core domain. Browser install is also available as a PWA fallback."
      },
      {
        title: "Android phones and tablets",
        body: "For Android, use the Capacitor wrapper and open the generated Android project in Android Studio. As a fallback, users can install the PWA from Chrome."
      },
      {
        title: "iPhone and iPad",
        body: "For iPhone and iPad, use the Capacitor wrapper and build from macOS with Xcode. As a fallback, users can add the PWA to the home screen from Safari."
      }
    ]
  },
  "terms-of-service": {
    eyebrow: "Legal",
    title: "Terms of Service",
    subtitle: "Review the expected use of Event Core in your organization.",
    sections: [
      {
        title: "Authorized use",
        body: "Use Event Core only for legitimate venue, booking, event, dining, billing, and operational management work."
      },
      {
        title: "Account responsibility",
        body: "Each user is responsible for activity performed under their account and should keep login access secure."
      },
      {
        title: "Data accuracy",
        body: "Your organization is responsible for entering accurate booking, client, event, and financial information."
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
        body: "Event Core stores information needed to run bookings, events, dining plans, billing, and team workflows."
      },
      {
        title: "Access control",
        body: "User roles and permissions should limit access to the information each team member needs for their work."
      },
      {
        title: "Responsible handling",
        body: "Client names, schedules, payments, and internal notes should be treated as private business information."
      }
    ]
  }
};

const relatedLinks: Array<{ href: Route; label: string }> = [
  { href: "/dashboard/help-center", label: "Help Center" },
  { href: "/dashboard/release-notes", label: "Release Notes" },
  { href: "/dashboard/download-apps", label: "Download Apps" },
  { href: "/dashboard/terms-of-service", label: "Terms of Service" },
  { href: "/dashboard/privacy-policy", label: "Privacy Policy" }
];

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
        <div className="mx-auto grid w-full max-w-6xl gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
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
              {kind === "download-apps" ? <AppInstallCard /> : null}

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

          <aside className="h-fit overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm xl:sticky xl:top-4">
            <header className="border-b border-[#d8dde5] px-4 py-3">
              <h2 className="text-sm font-black">Help pages</h2>
            </header>
            <nav className="grid gap-1 p-2" aria-label="Help pages">
              {relatedLinks.map((link) => (
                <Link
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition hover:bg-[#eef4fa] ${
                    link.href.endsWith(kind)
                      ? "bg-[#1f4d73] text-white hover:bg-[#1f4d73]"
                      : "text-[#17202a]"
                  }`}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      </main>
    </div>
  );
}
