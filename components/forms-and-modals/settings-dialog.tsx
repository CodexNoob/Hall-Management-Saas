"use client";

import { useEffect, useId, useRef } from "react";
import { SettingsOverviewPage } from "@/components/dashboard/settings-page";

type SettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

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
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/40 p-2 backdrop-blur-[1px] sm:p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="h-[calc(100dvh-1rem)] w-full max-w-[96rem] overflow-hidden rounded-2xl border border-[#d8dde5] bg-[#f5f6f8] shadow-2xl sm:h-[calc(100dvh-2rem)]"
        role="dialog"
      >
        <h2 className="sr-only" id={titleId}>
          Settings
        </h2>
        <SettingsOverviewPage
          closeButtonRef={closeButtonRef}
          displayMode="modal"
          onClose={onClose}
        />
      </section>
    </div>
  );
}
