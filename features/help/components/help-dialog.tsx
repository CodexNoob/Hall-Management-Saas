"use client";

import { useEffect } from "react";
import { HelpCenterContent } from "@/features/help/components/help-center-content";
import { PrivacyPolicyContent } from "@/features/help/components/privacy-policy-content";
import { ReleaseNotesContent } from "@/features/help/components/release-notes-content";
import { TermsOfServiceContent } from "@/features/help/components/terms-of-service-content";
import type { HelpPageKind } from "@/features/help/components/help-page";

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
        {kind === "help-center" || kind === "report-problem" ? (
          <HelpCenterContent
            initialSupportFormOpen={kind === "report-problem"}
            onClose={onClose}
          />
        ) : kind === "terms-of-service" ? (
          <TermsOfServiceContent onClose={onClose} />
        ) : kind === "privacy-policy" ? (
          <PrivacyPolicyContent onClose={onClose} />
        ) : kind === "release-notes" ? (
          <ReleaseNotesContent onClose={onClose} />
        ) : (
          <HelpCenterContent onClose={onClose} />
        )}
      </section>
    </div>
  );
}
