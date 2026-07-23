"use client";

import { useEffect, useId, useRef } from "react";
import { SettingsPage } from "@/features/settings/components/settings-page";

type SettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center overflow-hidden bg-[#17202a]/40 p-2 backdrop-blur-[1px] sm:p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="h-[calc(100dvh-16px)] max-h-[calc(100dvh-16px)] w-[calc(100vw-16px)] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border border-[#d8dde5] bg-[#f5f6f8] shadow-2xl sm:h-170 sm:max-h-[calc(100vh-48px)] sm:w-207.5 sm:max-w-[calc(100vw-32px)] sm:rounded-[20px]"
        role="dialog"
      >
        <h2 className="sr-only" id={titleId}>
          Settings
        </h2>
        <SettingsPage
          closeButtonRef={closeButtonRef}
          displayMode="modal"
          onClose={onClose}
        />
      </section>
    </div>
  );
}
