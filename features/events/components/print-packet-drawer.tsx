"use client";

import { useEffect, useId, useState } from "react";

export type PrintPacketEvent = {
  title: string;
  date: string;
  room: string;
};

type PrintPacketDrawerProps = {
  event: PrintPacketEvent;
  open: boolean;
  onClose: () => void;
};

type ReadinessItem = {
  id: "menu" | "hall-map" | "balance";
  label: string;
};

const readinessItems: ReadinessItem[] = [
  { id: "menu", label: "Menu confirmed" },
  { id: "hall-map", label: "Hall map confirmed" },
  { id: "balance", label: "Balance under review limit" },
];

function PacketIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M7 3h10v18H7Z" />
      <path d="M10 8h4M10 12h4M10 16h3" />
    </svg>
  );
}

function ReadinessIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M5 4h10v13H5Z" />
      <path d="M8 8h4M8 11h4M14 14l2 2 4-5" />
    </svg>
  );
}

export function PrintPacketDrawer({ event, open, onClose }: PrintPacketDrawerProps) {
  const titleId = useId();
  const [checkedItems, setCheckedItems] = useState<ReadinessItem["id"][]>(["menu"]);

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

  const toggleReadinessItem = (id: ReadinessItem["id"]) => {
    setCheckedItems((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
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
            <PacketIcon />
            <h2 className="text-base font-black text-[#17202a]" id={titleId}>Print packet</h2>
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
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">Event</p>
            <h3 className="mt-1 break-words text-lg font-black leading-tight text-[#17202a] sm:text-xl">{event.title}</h3>
            <p className="mt-1 text-xs text-[#64748b]">{event.date} · {event.room}</p>
          </section>

          <section className="rounded-xl border border-[#d8dde5] bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">Included</p>
            <h3 className="mt-1 text-lg font-black leading-6 text-[#17202a] sm:text-xl">Details, menu, billing, hall map, vendors</h3>
            <p className="mt-1 text-xs text-[#64748b]">Master packet generated from selected event</p>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
            <header className="flex h-11 items-center gap-3 border-b border-[#d8dde5] px-3">
              <ReadinessIcon />
              <h3 className="text-sm font-black text-[#17202a]">Readiness before print</h3>
            </header>
            <div className="space-y-2 p-3">
              {readinessItems.map((item) => {
                const checked = checkedItems.includes(item.id);

                return (
                  <button
                    aria-pressed={checked}
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 text-left text-sm font-black text-[#17202a] hover:bg-[#fbfcfd]"
                    key={item.id}
                    onClick={() => toggleReadinessItem(item.id)}
                    type="button"
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${checked ? "border-[#17845b] bg-[#eefaf5] text-[#17845b]" : "border-[#b9c2cf] text-transparent"}`}>
                      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-[#d8dde5] bg-white px-3 py-3">
          <button className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]" onClick={onClose} type="button">
            Close
          </button>
          <button className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm hover:bg-[#15344f]" onClick={() => window.print()} type="button">
            Print packet
          </button>
        </footer>
      </aside>
    </div>
  );
}
