"use client";

import { useEffect, useId, useState } from "react";
import { ClientPortalPreviewContent } from "@/features/events/components/event-client-portal-content";
import { type EventFile } from "@/features/events/components/event-manager-shared";
import { getClientPortalUrl } from "@/lib/ui/client-portal-url";
import { copyText } from "@/lib/ui/copy-text";

type ClientPortalPreviewDrawerProps = {
  event: EventFile;
  open: boolean;
  onClose: () => void;
};

function PortalIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <rect height="14" rx="1" width="18" x="3" y="5" />
      <path d="M3 9h18M7 13h4" />
    </svg>
  );
}

export function ClientPortalPreviewDrawer({
  event,
  open,
  onClose
}: ClientPortalPreviewDrawerProps) {
  const titleId = useId();
  const [copyLabel, setCopyLabel] = useState("Copy link");

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const portalUrl = getClientPortalUrl(event.id, window.location.origin);

  const copyPortalLink = async () => {
    const copied = await copyText(portalUrl);
    setCopyLabel(copied ? "Copied!" : "Copy failed");
    window.setTimeout(() => setCopyLabel("Copy link"), 1600);
  };

  return (
    <div
      className="dashboard-drawer-backdrop fixed inset-0 z-100 bg-[#17202a]/30"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.currentTarget === mouseEvent.target) onClose();
      }}
    >
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="dashboard-drawer-enter ml-auto flex h-full w-full max-w-6xl flex-col border-l border-[#d8dde5] bg-[#eef4fa] shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#d8dde5] bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <PortalIcon />
            <div>
              <h2 className="text-base font-black text-[#17202a]" id={titleId}>
                Client portal preview
              </h2>
              <p className="text-xs font-semibold text-[#64748b]">
                This is the client-facing view for {event.title}.
              </p>
            </div>
          </div>
          <button
            aria-label="Close client portal preview"
            className="flex h-9 w-9 items-center justify-center rounded-full text-3xl leading-none text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ClientPortalPreviewContent event={event} />
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-[#d8dde5] bg-white px-3 py-3">
          <button
            aria-live="polite"
            className="h-9 min-w-20 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
            onClick={copyPortalLink}
            type="button"
          >
            {copyLabel}
          </button>
          <button
            className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm hover:bg-[#15344f]"
            onClick={() => {
              window.location.href = `mailto:?subject=${encodeURIComponent(
                `Event portal: ${event.title}`
              )}&body=${encodeURIComponent(portalUrl)}`;
            }}
            type="button"
          >
            Send to client
          </button>
        </footer>
      </aside>
    </div>
  );
}
