"use client";

import { useEffect, useId } from "react";
import { type EventFile } from "@/features/events/components/event-manager-shared";
import {
  getEventReadinessSummary,
  getScopedEventReadinessItems
} from "@/features/events/components/event-readiness";

type PrintPacketDrawerProps = {
  event: EventFile;
  open: boolean;
  onClose: () => void;
};

function PacketIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M7 3h10v18H7Z" />
      <path d="M10 8h4M10 12h4M10 16h3" />
    </svg>
  );
}

function ReadinessIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M5 4h10v13H5Z" />
      <path d="M8 8h4M8 11h4M14 14l2 2 4-5" />
    </svg>
  );
}

export function PrintPacketDrawer({
  event,
  open,
  onClose
}: PrintPacketDrawerProps) {
  const titleId = useId();
  const readinessItems = getScopedEventReadinessItems(event, "print");
  const readinessSummary = getEventReadinessSummary(event, "print");

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
            <PacketIcon />
            <h2 className="text-base font-black text-[#17202a]" id={titleId}>
              Print packet
            </h2>
          </div>
          <button
            aria-label="Close print packet"
            className="flex h-9 w-9 items-center justify-center rounded-full text-3xl leading-none text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <section className="rounded-xl border border-[#d8dde5] bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Event
            </p>
            <h3 className="mt-1 break-words text-lg font-black leading-tight text-[#17202a] sm:text-xl">
              {event.title}
            </h3>
            <p className="mt-1 text-xs text-[#64748b]">
              {event.date} · {event.room}
            </p>
          </section>

          <section className="rounded-xl border border-[#d8dde5] bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Included
            </p>
            <h3 className="mt-1 text-lg font-black leading-6 text-[#17202a] sm:text-xl">
              Details, menu, billing, hall map, vendors
            </h3>
            <p className="mt-1 text-xs text-[#64748b]">
              Master packet generated from selected event
            </p>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
            <header className="flex min-h-11 items-center gap-3 border-b border-[#d8dde5] px-3 py-2">
              <ReadinessIcon />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-[#17202a]">
                  Readiness before print
                </h3>
                <p className="text-xs font-semibold text-[#64748b]">
                  {readinessSummary.completed}/{readinessSummary.total} print
                  items ready
                </p>
              </div>
            </header>
            <div className="space-y-2 p-3">
              {readinessItems.map((item) => (
                <div
                  className="flex min-h-14 w-full items-start gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 py-2 text-left text-sm font-black text-[#17202a]"
                  key={item.id}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      item.done
                        ? "border-[#17845b] bg-[#eefaf5] text-[#17845b]"
                        : "border-[#b9c2cf] text-transparent"
                    }`}
                  >
                    {item.done ? (
                      <svg
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block leading-4">{item.label}</span>
                    <span className="mt-0.5 block text-xs font-semibold leading-4 text-[#64748b]">
                      {item.helper}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-[#d8dde5] bg-white px-3 py-3">
          <button
            className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
          <button
            className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!readinessSummary.ready}
            onClick={() => window.print()}
            type="button"
          >
            Print packet
          </button>
        </footer>
      </aside>
    </div>
  );
}
