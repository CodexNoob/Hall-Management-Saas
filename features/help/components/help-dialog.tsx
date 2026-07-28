"use client";

import { useEffect } from "react";
import { AppInstallCard } from "@/features/help/components/app-install-card";
import {
  helpPages,
  type HelpPageKind
} from "@/features/help/components/help-page";

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 18h.01M9.4 9a2.8 2.8 0 1 1 4.7 2.05c-.9.75-1.65 1.35-1.65 2.7v.25M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

const supportCards = [
  {
    label: "Response",
    value: "Business hours",
    helper: "For admin and staff support"
  },
  {
    label: "Before asking",
    value: "Send page + event",
    helper: "Helps support reproduce the issue"
  },
  {
    label: "Security",
    value: "Role-based access",
    helper: "Access depends on permissions"
  }
];

export function HelpDialog({
  kind,
  onClose,
  open
}: {
  kind: HelpPageKind;
  onClose: () => void;
  open: boolean;
}) {
  const content = helpPages[kind];

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
      className="fixed inset-0 z-9999 flex items-center justify-center bg-[#071427]/55 p-3 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="help-dialog-title"
        aria-modal="true"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-[#f5f6f8] text-[#17202a] shadow-2xl shadow-[#071427]/30 sm:max-h-[calc(100dvh-48px)]"
        role="dialog"
      >
        <header className="relative overflow-hidden border-b border-[#d8dde5] bg-white">
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#1f4d73]/12 blur-2xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-36 w-56 rounded-full bg-[#e7e3da]/70 blur-2xl" />

          <div className="relative flex items-start gap-4 px-5 py-5 sm:px-6">
            <div className="hidden h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-[#1f4d73] text-white shadow-lg shadow-[#1f4d73]/20 sm:flex">
              <HelpIcon />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1f4d73]">
                Event Core {content.eyebrow}
              </p>
              <h2
                className="mt-1 text-2xl font-black tracking-tight text-[#0f172a] sm:text-3xl"
                id="help-dialog-title"
              >
                {content.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#617086]">
                {content.subtitle}
              </p>
            </div>

            <button
              aria-label={`Close ${content.title}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#c7d0dc] bg-white text-[#17202a] shadow-sm transition hover:bg-[#eef4fa]"
              onClick={onClose}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <main className="grid min-w-0 gap-4">
              {kind === "download-apps" ? <AppInstallCard /> : null}

              <div className="grid gap-3">
                {content.sections.map((section, index) => (
                  <article
                    className="group rounded-2xl border border-[#d8dde5] bg-white p-4 shadow-sm transition hover:border-[#b8c6d5] hover:shadow-md"
                    key={section.title}
                  >
                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#eef4fa] text-xs font-black text-[#1f4d73]">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-[#0f172a]">
                          {section.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[#59677c]">
                          {section.body}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </main>

            <aside className="grid h-fit gap-3 rounded-2xl border border-[#d8dde5] bg-white p-4 shadow-sm">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6a7483]">
                  Support checklist
                </p>
                <h3 className="mt-1 text-lg font-black text-[#0f172a]">
                  Faster help
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#617086]">
                  Share the page name, event name, and a screenshot when
                  reporting an issue.
                </p>
              </div>

              <div className="grid gap-2">
                {supportCards.map((card) => (
                  <div
                    className="rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-3"
                    key={card.label}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6a7483]">
                      {card.label}
                    </p>
                    <p className="mt-1 text-sm font-black text-[#0f172a]">
                      {card.value}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#617086]">
                      {card.helper}
                    </p>
                  </div>
                ))}
              </div>

              <button
                className="h-11 rounded-xl bg-[#1f4d73] px-4 text-sm font-black text-white shadow-lg shadow-[#1f4d73]/18 transition hover:bg-[#15344f]"
                type="button"
              >
                Contact administrator
              </button>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
