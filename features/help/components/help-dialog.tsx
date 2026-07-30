"use client";

import { useEffect } from "react";
import { Download, HelpCircle, X } from "lucide-react";
import { DownloadAppsContent } from "@/features/help/components/download-apps-content";
import { HelpCenterContent } from "@/features/help/components/help-center-content";
import { PrivacyPolicyContent } from "@/features/help/components/privacy-policy-content";
import { ReleaseNotesContent } from "@/features/help/components/release-notes-content";
import { TermsOfServiceContent } from "@/features/help/components/terms-of-service-content";
import {
  helpPages,
  type HelpPageKind
} from "@/features/help/components/help-page";

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f4d73] text-white shadow-lg shadow-[#1f4d73]/18">
      {children}
    </span>
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
          {kind === "download-apps" ? <DownloadAppsContent /> : null}
          {kind !== "download-apps"
            ? content.sections.map((section) => (
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
              ))
            : null}
        </div>
      </div>
    </>
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
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="help-dialog-title"
        aria-modal="true"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-[#f5f6f8] text-[#17202a] shadow-2xl shadow-[#071427]/35 sm:max-h-[calc(100dvh-48px)]"
        role="dialog"
      >
        {kind === "help-center" ? (
          <HelpCenterContent onClose={onClose} />
        ) : kind === "terms-of-service" ? (
          <TermsOfServiceContent onClose={onClose} />
        ) : kind === "privacy-policy" ? (
          <PrivacyPolicyContent onClose={onClose} />
        ) : kind === "release-notes" ? (
          <ReleaseNotesContent onClose={onClose} />
        ) : (
          <SimpleHelpContent kind={kind} onClose={onClose} />
        )}
      </section>
    </div>
  );
}
