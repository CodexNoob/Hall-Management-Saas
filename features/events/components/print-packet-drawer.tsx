"use client";

import { type ReactNode, useEffect, useId } from "react";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import {
  type EventFile,
  type EventKitchenLine,
  type EventKitchenResponse
} from "@/features/events/components/event-manager-shared";
import {
  getEventReadinessSummary,
  getScopedEventReadinessItems
} from "@/features/events/components/event-readiness";
import { showBillingReadouts } from "@/lib/ui/mvp-features";

type PrintPacketDrawerProps = {
  event: EventFile;
  open: boolean;
  onClose: () => void;
};

type TimelinePacketItem = {
  id: string;
  time: string;
  cue?: string;
  text: string;
  type: "Event" | "Kitchen" | "Staff";
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

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function fieldValue(value: string | number | null | undefined) {
  if (typeof value === "number") return String(value);
  if (hasText(value)) return value;

  return "Not set";
}

function recordFrom(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function timelineRows(event: EventFile): TimelinePacketItem[] {
  const saved = event.workspaceData.timeline;

  if (!Array.isArray(saved)) return [];

  return saved.flatMap((entry, index) => {
    const row = recordFrom(entry);
    if (!row) return [];

    const text = stringFrom(row.text);
    if (!text) return [];

    const type = row.type;

    return [
      {
        id: stringFrom(row.id) || `timeline-${index}`,
        time: stringFrom(row.time),
        cue: typeof row.cue === "string" ? stringFrom(row.cue) : undefined,
        text,
        type:
          type === "Kitchen" || type === "Staff" || type === "Event"
            ? type
            : "Event"
      }
    ];
  });
}

function formatUnits(units: number) {
  if (Number.isInteger(units)) return String(units);

  return String(Math.round(units * 100) / 100);
}

function formatQuantity(line: EventKitchenLine) {
  if (line.countState === "NotCounted") return "Not cooked to a rule";
  if (line.countState === "NeedsStyle") return "Needs service style";
  if (line.countState === "NoRule") return "No counting rule set";
  if (line.countState === "Unresolved") {
    return line.unresolvedBases.length > 0
      ? `Needs ${line.unresolvedBases.join(", ")}`
      : "Needs count details";
  }

  const quantity = line.quantities
    .map((item) => {
      const shown = formatUnits(item.units);
      return `${shown} ${item.unit}${shown === "1" ? "" : "s"}`;
    })
    .join(" + ");

  if (!quantity) return "No quantity";

  return line.quantityMultiplier > 1
    ? `${line.quantityMultiplier}x ${quantity}`
    : quantity;
}

function statusLabel(status: EventKitchenLine["status"]) {
  if (status === "COMPLETE") return "Complete";
  if (status === "PENDING") return "Pending";

  return "Not started";
}

function PacketSection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white print:break-inside-avoid">
      <header className="border-b border-[#d8dde5] bg-[#fbfcfd] px-3 py-2.5">
        <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#1f4d73]">
          {title}
        </h3>
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </p>
      <p className="mt-1 wrap-break-word text-sm font-black text-[#17202a]">
        {value}
      </p>
    </div>
  );
}

function KitchenPacket({
  data,
  error,
  isLoading,
  onRetry
}: {
  data: EventKitchenResponse | null;
  error: string | null;
  isLoading: boolean;
  onRetry: () => void;
}) {
  const sheet = data?.kitchen ?? null;
  const dishes = sheet?.lines.filter((line) => line.kind === "Dish") ?? [];
  const addOns = sheet?.lines.filter((line) => line.kind === "AddOn") ?? [];

  if (isLoading) {
    return (
      <PacketSection title="Kitchen production">
        <p className="text-sm font-semibold text-[#64748b]">
          Loading kitchen sheet...
        </p>
      </PacketSection>
    );
  }

  if (error) {
    return (
      <PacketSection title="Kitchen production">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#8a1f1f]">{error}</p>
          <button
            className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] print:hidden"
            onClick={onRetry}
            type="button"
          >
            Retry
          </button>
        </div>
      </PacketSection>
    );
  }

  if (!sheet || sheet.lines.length === 0) {
    return (
      <PacketSection title="Kitchen production">
        <p className="text-sm font-semibold text-[#64748b]">
          No selected menu items are ready for the kitchen sheet yet.
        </p>
      </PacketSection>
    );
  }

  return (
    <PacketSection title="Kitchen production">
      <div className="grid gap-2 sm:grid-cols-4">
        <DetailField label="Portions" value={sheet.counts.totalGuests} />
        <DetailField
          label="Prepared"
          value={`${sheet.summary.complete}/${sheet.summary.dishes}`}
        />
        <DetailField label="Pending" value={sheet.summary.pending} />
        <DetailField
          label="Needs attention"
          value={sheet.summary.needsAttention}
        />
      </div>

      {dishes.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-150 text-left text-xs">
            <thead className="bg-[#fbfcfd] text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              <tr>
                <th className="border-b border-[#d8dde5] px-3 py-2">Dish</th>
                <th className="border-b border-[#d8dde5] px-3 py-2">
                  Quantity
                </th>
                <th className="border-b border-[#d8dde5] px-3 py-2">Style</th>
                <th className="border-b border-[#d8dde5] px-3 py-2">
                  Assigned
                </th>
                <th className="border-b border-[#d8dde5] px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((line) => (
                <tr
                  className="border-b border-[#d8dde5] last:border-b-0"
                  key={line.id}
                >
                  <td className="px-3 py-2 font-black text-[#17202a]">
                    <span className="block wrap-break-word">{line.name}</span>
                    {line.notes ? (
                      <span className="mt-0.5 block text-[11px] font-semibold text-[#64748b]">
                        {line.notes}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-semibold text-[#17202a]">
                    {formatQuantity(line)}
                  </td>
                  <td className="px-3 py-2 text-[#64748b]">
                    {line.serviceStyle ?? "Not set"}
                  </td>
                  <td className="px-3 py-2 text-[#64748b]">
                    {line.assignedWorkerName ?? "Unassigned"}
                  </td>
                  <td className="px-3 py-2 text-[#64748b]">
                    {statusLabel(line.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-[#64748b]">
          No dishes on this menu yet.
        </p>
      )}

      {addOns.length > 0 ? (
        <div className="mt-3 border-t border-[#d8dde5] pt-3">
          <h4 className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Add-ons
          </h4>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {addOns.map((line) => (
              <li
                className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 py-2 text-sm font-black text-[#17202a]"
                key={line.id}
              >
                {line.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </PacketSection>
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
  const kitchenQuery = useAuthenticatedQuery<EventKitchenResponse>(
    `/api/events/${event.id}/kitchen`,
    open
  );
  const timeline = timelineRows(event);
  const eventNotes = [
    { label: "Event notes", value: event.notes.join("\n") },
    { label: "Internal notes", value: event.internalNotes },
    { label: "Dining manager notes", value: event.diningManagerNotes },
    { label: "Davening note", value: event.daveningNote },
    { label: "Member shul", value: event.memberShulName },
    { label: "Side boxes", value: event.sideBoxes },
    { label: "Shabbos setup", value: event.shabbosSetup }
  ].filter((item) => hasText(item.value));

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
      className="print-packet-sheet dashboard-drawer-backdrop fixed inset-0 z-100 bg-[#17202a]/30 print:static print:bg-white"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.currentTarget === mouseEvent.target) onClose();
      }}
    >
      {/*
        Printing in place keeps the app's styles and hides the dashboard behind
        this drawer, so the packet itself is what lands on paper or PDF.
      */}
      <style>{`
        @media print {
          @page { margin: 0.5in; }
          body * { visibility: hidden; }
          .print-packet-sheet, .print-packet-sheet * { visibility: visible; }
          .print-packet-sheet { position: absolute; inset: 0; }
        }
      `}</style>

      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="dashboard-drawer-enter ml-auto flex h-full w-full max-w-190 flex-col border-l border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20 print:ml-0 print:h-auto print:max-w-none print:border-0 print:shadow-none"
        role="dialog"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-3 print:hidden">
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
            <span aria-hidden="true">&times;</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 print:block print:min-h-0 print:overflow-visible print:p-0">
          <section className="rounded-xl border border-[#d8dde5] bg-white p-4 print:break-inside-avoid">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Internal event packet
            </p>
            <h3 className="mt-1 wrap-break-word text-2xl font-black leading-tight text-[#17202a]">
              {event.title}
            </h3>
            <p className="mt-1 text-xs font-semibold text-[#64748b]">
              {event.date} - {event.room} - {event.packageName}
            </p>
          </section>

          <PacketSection title="Event details">
            <div className="grid gap-2 sm:grid-cols-3">
              <DetailField
                label="Client"
                value={fieldValue(event.clientName)}
              />
              <DetailField
                label="Event type"
                value={fieldValue(event.eventType)}
              />
              <DetailField label="Status" value={fieldValue(event.status)} />
              <DetailField label="Date" value={fieldValue(event.date)} />
              <DetailField label="Start time" value={fieldValue(event.time)} />
              <DetailField label="Hall" value={fieldValue(event.room)} />
              <DetailField label="Guests" value={fieldValue(event.guests)} />
              <DetailField
                label="Children"
                value={fieldValue(event.children)}
              />
              <DetailField
                label="Waiters"
                value={fieldValue(event.waitersCount)}
              />
              <DetailField
                label="Coordinator"
                value={fieldValue(event.coordinator)}
              />
              <DetailField label="Phone" value={fieldValue(event.phone)} />
              <DetailField label="Email" value={fieldValue(event.email)} />
            </div>
          </PacketSection>

          <PacketSection title="Setup and dining">
            <div className="grid gap-2 sm:grid-cols-3">
              <DetailField
                label="Package"
                value={fieldValue(event.packageName)}
              />
              <DetailField
                label="Tablecloth"
                value={fieldValue(event.tableclothName)}
              />
              <DetailField
                label="Hall map"
                value={event.diningHallMapPreset?.name ?? "Not attached"}
              />
              <DetailField
                label="Setup time"
                value={fieldValue(event.setupTime)}
              />
              <DetailField
                label="Washing time"
                value={fieldValue(event.washingTime)}
              />
              {showBillingReadouts ? (
                <DetailField
                  label="Balance"
                  value={fieldValue(event.balance)}
                />
              ) : null}
            </div>
          </PacketSection>

          <KitchenPacket
            data={kitchenQuery.data}
            error={kitchenQuery.error}
            isLoading={kitchenQuery.isLoading}
            onRetry={() => void kitchenQuery.refetch()}
          />

          <PacketSection title="Day-of timeline">
            {timeline.length > 0 ? (
              <ol className="divide-y divide-[#d8dde5] border border-[#d8dde5]">
                {timeline.map((row) => (
                  <li
                    className="grid gap-2 p-3 sm:grid-cols-[120px_1fr_90px]"
                    key={row.id}
                  >
                    <p className="text-xs font-black text-[#17202a]">
                      {row.cue ? `After ${row.cue}` : row.time || "No time"}
                    </p>
                    <p className="wrap-break-word text-sm font-semibold text-[#17202a]">
                      {row.text}
                    </p>
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[#64748b]">
                      {row.type}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm font-semibold text-[#64748b]">
                No timeline instructions saved yet.
              </p>
            )}
          </PacketSection>

          <PacketSection title="Internal notes">
            {eventNotes.length > 0 ? (
              <div className="space-y-2">
                {eventNotes.map((item) => (
                  <div
                    className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 py-2"
                    key={item.label}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                      {item.label}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm font-semibold text-[#17202a]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-[#64748b]">
                No internal notes saved yet.
              </p>
            )}
          </PacketSection>

          <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white print:break-inside-avoid">
            <header className="flex min-h-11 items-center gap-3 border-b border-[#d8dde5] bg-[#fbfcfd] px-3 py-2">
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
            <div className="grid gap-2 p-3 sm:grid-cols-2">
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

        <footer className="flex shrink-0 justify-end gap-2 border-t border-[#d8dde5] bg-white px-3 py-3 print:hidden">
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
