"use client";

import { useEffect, useId, useState } from "react";

export type ClientPortalPreviewEvent = {
  title: string;
  date: string;
  room: string;
  balance: string;
};

type ClientPortalPreviewDrawerProps = {
  event: ClientPortalPreviewEvent;
  open: boolean;
  onClose: () => void;
};

function PortalIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect height="14" rx="1" width="18" x="3" y="5" />
      <path d="M3 9h18M7 13h4" />
    </svg>
  );
}

export function ClientPortalPreviewDrawer({ event, open, onClose }: ClientPortalPreviewDrawerProps) {
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

  const copyPortalLink = async () => {
    const portalUrl = `${window.location.origin}/dashboard/client-portal?event=${encodeURIComponent(event.title)}`;

    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy link"), 1600);
    } catch {
      setCopyLabel("Copy failed");
      window.setTimeout(() => setCopyLabel("Copy link"), 1600);
    }
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
        className="dashboard-drawer-enter ml-auto flex h-full w-full max-w-[455px] flex-col border-l border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3">
          <div className="flex items-center gap-3">
            <PortalIcon />
            <h2 className="text-base font-black text-[#17202a]" id={titleId}>Client portal preview</h2>
          </div>
          <button
            className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
            <header className="bg-[#1f4d73] px-5 py-6 text-white">
              <h3 className="break-words text-xl font-black leading-tight sm:text-2xl">{event.title}</h3>
              <p className="mt-1 text-sm text-white/85">{event.date} · {event.room}</p>
            </header>

            <div className="space-y-3 p-4">
              <article className="rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-3">
                <h4 className="text-sm font-black text-[#17202a]">Menu</h4>
                <p className="mt-1 text-sm text-[#64748b]">Confirmed</p>
              </article>
              <article className="rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-3">
                <h4 className="text-sm font-black text-[#17202a]">Balance</h4>
                <p className="mt-1 text-sm text-[#64748b]">{event.balance}</p>
              </article>
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-[#d8dde5] bg-white px-3 py-3">
          <button
            className="h-9 min-w-20 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
            onClick={copyPortalLink}
            type="button"
          >
            {copyLabel}
          </button>
          <button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm hover:bg-[#15344f]" type="button">
            Send to client
          </button>
        </footer>
      </aside>
    </div>
  );
}
