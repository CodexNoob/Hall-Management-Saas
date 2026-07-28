"use client";

import { useEffect } from "react";
import { AppInstallCard } from "@/features/help/components/app-install-card";
import {
  helpPages,
  type HelpPageKind
} from "@/features/help/components/help-page";

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
      className="fixed inset-0 z-9999 flex items-center justify-center bg-[#17202a]/45 p-3 backdrop-blur-[1px] sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="help-dialog-title"
        aria-modal="true"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#d8dde5] bg-white text-[#17202a] shadow-2xl sm:max-h-[calc(100dvh-48px)]"
        role="dialog"
      >
        <header className="flex items-start gap-3 border-b border-[#d8dde5] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1f4d73]">
              {content.eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-black" id="help-dialog-title">
              {content.title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#617086]">
              {content.subtitle}
            </p>
          </div>

          <button
            aria-label={`Close ${content.title}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#c7d0dc] bg-white text-xl leading-none text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-3">
            {kind === "download-apps" ? <AppInstallCard /> : null}

            {content.sections.map((section) => (
              <article
                className="rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-4"
                key={section.title}
              >
                <h3 className="text-base font-black">{section.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#59677c]">
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
