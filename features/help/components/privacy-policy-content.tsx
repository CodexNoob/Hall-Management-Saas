"use client";

import {
  Check,
  Database,
  FileText,
  FolderLock,
  LockKeyhole,
  Server,
  Shield,
  UserRoundCheck,
  X
} from "lucide-react";
import { useState } from "react";

const privacyCards = [
  {
    accent: "blue",
    body: "Event Core stores the operational data needed for dashboard modules: bookings, events, menus, kitchen plans, dining setup, hall maps, files, billing, staff, clients, and vendors.",
    icon: Server,
    illustration: Database,
    title: "Operational data"
  },
  {
    accent: "green",
    body: "Dashboard roles and permissions should limit each staff member to the calendar, event, billing, files, settings, and operations data needed for their work.",
    icon: UserRoundCheck,
    illustration: LockKeyhole,
    title: "Access control"
  },
  {
    accent: "purple",
    body: "Client names, event schedules, payment records, uploaded files, hall layouts, vendor details, and Today Notes should be treated as private business information.",
    icon: FileText,
    illustration: FolderLock,
    title: "Responsible handling"
  }
] as const;

const accentClasses = {
  blue: {
    box: "bg-[#eef5ff] text-[#071427]",
    illustration: "bg-[#eef5ff] text-[#071427]"
  },
  green: {
    box: "bg-[#eaf8ef] text-[#071427]",
    illustration: "bg-[#eaf8ef] text-[#071427]"
  },
  purple: {
    box: "bg-[#f3ecff] text-[#071427]",
    illustration: "bg-[#f3ecff] text-[#071427]"
  }
} as const;

function PrivacyFooter({ onClose }: { onClose: () => void }) {
  const [hasAgreed, setHasAgreed] = useState(true);

  return (
    <footer className="flex flex-col gap-4 border-t border-[#d8dde5] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <label className="flex min-w-0 cursor-pointer items-center gap-3 text-xs font-medium text-[#304669] sm:text-sm">
        <input
          checked={hasAgreed}
          className="h-5 w-5 shrink-0 rounded-md accent-[#2563eb]"
          onChange={(event) => setHasAgreed(event.target.checked)}
          type="checkbox"
        />
        <span>
          I have read and agree to the{" "}
          <span className="font-bold text-[#2563eb]">Privacy Policy.</span>
        </span>
      </label>

      <div className="flex gap-3 sm:justify-end">
        <button
          className="h-10 min-w-28 rounded-lg border border-[#cbd5e1] bg-white px-4 text-xs font-black text-[#071427] shadow-sm transition hover:bg-[#f8fafc]"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
        <button
          className="h-10 min-w-28 rounded-lg bg-[#0b4eaa] px-4 text-xs font-black text-white shadow-lg shadow-[#0b4eaa]/20 transition hover:bg-[#083f89] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hasAgreed}
          onClick={onClose}
          type="button"
        >
          Agree
        </button>
      </div>
    </footer>
  );
}

export function PrivacyPolicyContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="border-b border-[#d8dde5] bg-white px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#1f4d73] to-[#0b3470] text-white shadow-lg shadow-[#1f4d73]/18">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#0b4eaa]">
              Event Core Privacy
            </p>
            <h2
              className="mt-1 text-2xl font-black tracking-tight text-[#071427] sm:text-3xl"
              id="help-dialog-title"
            >
              Privacy Policy
            </h2>
            <p className="mt-1.5 text-xs font-medium leading-5 text-[#617086] sm:text-sm">
              Understand how venue and event data should be handled.
            </p>
          </div>

          <button
            aria-label="Close Privacy Policy"
            className="flex h-10 w-10 shrink-0 items-center justify-center text-[#071427] transition hover:text-[#1f4d73]"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfcfd] p-3 sm:p-4">
        <div className="rounded-xl border border-[#a9cdfc] bg-[#f6fbff] p-3 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[48px_minmax(0,1fr)] sm:items-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl text-[#071427]">
              <Shield className="h-8 w-8" />
            </span>
            <p className="text-xs font-medium leading-5 text-[#071427] sm:text-sm">
              At Event Core, we are committed to protecting the privacy and
              security of your information. This policy explains how we collect,
              use, and safeguard your data.
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          {privacyCards.map((item, index) => {
            const Icon = item.icon;
            const Illustration = item.illustration;
            const accent = accentClasses[item.accent];

            return (
              <article
                className="grid gap-3 rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-sm sm:grid-cols-[84px_minmax(0,1fr)_1px_150px] sm:items-center"
                key={item.title}
              >
                <span
                  className={`flex h-16 w-16 items-center justify-center rounded-xl ${accent.box} max-sm:h-12 max-sm:w-12`}
                >
                  <Icon className="h-9 w-9 max-sm:h-6 max-sm:w-6" />
                </span>

                <div className="min-w-0">
                  <h3 className="text-base font-black text-[#071427] sm:text-lg">
                    {index + 1}. {item.title}
                  </h3>
                  <p className="mt-1.5 max-w-2xl text-xs font-medium leading-5 text-[#304669] sm:text-sm">
                    {item.body}
                  </p>
                </div>

                <span className="hidden h-20 w-px bg-[#e2e8f0] sm:block" />

                <div className="hidden justify-center sm:flex">
                  <div
                    className={`relative flex h-16 w-24 items-center justify-center rounded-xl ${accent.illustration}`}
                  >
                    <Illustration className="h-10 w-10 opacity-80" />
                    <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 shadow-lg">
                      <Check className="h-4 w-4 text-[#071427]" />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <PrivacyFooter onClose={onClose} />
    </div>
  );
}
