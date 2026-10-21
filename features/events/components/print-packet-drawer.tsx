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
import { useAppLanguage } from "@/components/providers/app-language-provider";
import type { MessageKey } from "@/lib/i18n/messages";

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

function fieldValue(
  t: (key: MessageKey) => string,
  value: string | number | null | undefined
) {
  if (typeof value === "number") return String(value);
  if (hasText(value)) return value;

  return t("common.notSet");
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

function formatQuantity(
  t: (key: MessageKey, values?: Record<string, string | number>) => string,
  line: EventKitchenLine
) {
  if (line.countState === "NotCounted") return t("events.notCookedToRule");
  if (line.countState === "NeedsStyle") return t("events.needsServiceStyleShort");
  if (line.countState === "NoRule") return t("events.noCountingRuleSet");
  if (line.countState === "Unresolved") {
    return line.unresolvedBases.length > 0
      ? t("events.needsBases", { bases: line.unresolvedBases.join(", ") })
      : t("events.needsCountDetails");
  }

  const quantity = line.quantities
    .map((item) => {
      const shown = formatUnits(item.units);
      return `${shown} ${item.unit}${shown === "1" ? "" : "s"}`;
    })
    .join(" + ");

  if (!quantity) return t("events.noQuantity");

  return line.quantityMultiplier > 1
    ? `${line.quantityMultiplier}x ${quantity}`
    : quantity;
}

function statusLabel(
  t: (key: MessageKey) => string,
  status: EventKitchenLine["status"]
) {
  if (status === "COMPLETE") return t("kitchen.complete");
  if (status === "PENDING") return t("kitchen.pending");

  return t("events.notStartedStatus");
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
  const { t } = useAppLanguage();
  const sheet = data?.kitchen ?? null;
  const dishes = sheet?.lines.filter((line) => line.kind === "Dish") ?? [];
  const addOns = sheet?.lines.filter((line) => line.kind === "AddOn") ?? [];

  if (isLoading) {
    return (
      <PacketSection title={t("events.kitchenProduction")}>
        <p className="text-sm font-semibold text-[#64748b]">
          {t("events.loadingKitchenSheetShort")}
        </p>
      </PacketSection>
    );
  }

  if (error) {
    return (
      <PacketSection title={t("events.kitchenProduction")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#8a1f1f]">{error}</p>
          <button
            className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] print:hidden"
            onClick={onRetry}
            type="button"
          >
            {t("common.retry")}
          </button>
        </div>
      </PacketSection>
    );
  }

  if (!sheet || sheet.lines.length === 0) {
    return (
      <PacketSection title={t("events.kitchenProduction")}>
        <p className="text-sm font-semibold text-[#64748b]">
          {t("events.noKitchenSheetItems")}
        </p>
      </PacketSection>
    );
  }

  return (
    <PacketSection title={t("events.kitchenProduction")}>
      <div className="grid gap-2 sm:grid-cols-4">
        <DetailField label={t("events.portions")} value={sheet.counts.totalGuests} />
        <DetailField
          label={t("events.prepared")}
          value={`${sheet.summary.complete}/${sheet.summary.dishes}`}
        />
        <DetailField label={t("events.pending")} value={sheet.summary.pending} />
        <DetailField
          label={t("events.needsAttention")}
          value={sheet.summary.needsAttention}
        />
      </div>

      {dishes.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-150 text-left text-xs">
            <thead className="bg-[#fbfcfd] text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              <tr>
                <th className="border-b border-[#d8dde5] px-3 py-2">{t("events.dish")}</th>
                <th className="border-b border-[#d8dde5] px-3 py-2">
                  {t("events.quantity")}
                </th>
                <th className="border-b border-[#d8dde5] px-3 py-2">{t("events.style")}</th>
                <th className="border-b border-[#d8dde5] px-3 py-2">
                  {t("events.assigned")}
                </th>
                <th className="border-b border-[#d8dde5] px-3 py-2">{t("common.status")}</th>
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
                    {formatQuantity(t, line)}
                  </td>
                  <td className="px-3 py-2 text-[#64748b]">
                    {line.serviceStyle ?? t("common.notSet")}
                  </td>
                  <td className="px-3 py-2 text-[#64748b]">
                    {line.assignedWorkerName ?? "Unassigned"}
                  </td>
                  <td className="px-3 py-2 text-[#64748b]">
                    {statusLabel(t, line.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-[#64748b]">
          {t("events.noDishes")}
        </p>
      )}

      {addOns.length > 0 ? (
        <div className="mt-3 border-t border-[#d8dde5] pt-3">
          <h4 className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            {t("events.addOns")}
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
  const { t } = useAppLanguage();
  const titleId = useId();
  const readinessItems = getScopedEventReadinessItems(event, "print");
  const readinessSummary = getEventReadinessSummary(event, "print");
  const kitchenQuery = useAuthenticatedQuery<EventKitchenResponse>(
    `/api/events/${event.id}/kitchen`,
    open
  );
  const timeline = timelineRows(event);
  const eventNotes = [
    { label: t("events.eventNotes"), value: event.notes.join("\n") },
    { label: t("bookings.internalNotes"), value: event.internalNotes },
    { label: t("events.diningManagerNotes"), value: event.diningManagerNotes },
    { label: t("events.daveningNote"), value: event.daveningNote },
    { label: t("events.memberShul"), value: event.memberShulName },
    { label: t("events.sideBoxes"), value: event.sideBoxes },
    { label: t("events.shabbosSetup"), value: event.shabbosSetup }
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
              {t("events.printPacket")}
            </h2>
          </div>
          <button
            aria-label={t("events.closePrintPacket")}
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
              {t("events.internalPacket")}
            </p>
            <h3 className="mt-1 wrap-break-word text-2xl font-black leading-tight text-[#17202a]">
              {event.title}
            </h3>
            <p className="mt-1 text-xs font-semibold text-[#64748b]">
              {event.date} - {event.room} - {event.packageName}
            </p>
          </section>

          <PacketSection title={t("events.eventDetails")}>
            <div className="grid gap-2 sm:grid-cols-3">
              <DetailField
                label={t("common.client")}
                value={fieldValue(t, event.clientName)}
              />
              <DetailField
                label={t("bookings.eventType")}
                value={fieldValue(t, event.eventType)}
              />
              <DetailField label={t("common.status")} value={fieldValue(t, event.status)} />
              <DetailField label={t("common.date")} value={fieldValue(t, event.date)} />
              <DetailField label={t("events.startTime")} value={fieldValue(t, event.time)} />
              <DetailField label={t("calendar.hall")} value={fieldValue(t, event.room)} />
              <DetailField label={t("bookings.guests")} value={fieldValue(t, event.guests)} />
              <DetailField
                label={t("bookings.children")}
                value={fieldValue(t, event.children)}
              />
              <DetailField
                label={t("events.waiters")}
                value={fieldValue(t, event.waitersCount)}
              />
              <DetailField
                label={t("events.coordinator")}
                value={fieldValue(t, event.coordinator)}
              />
              <DetailField label={t("common.phone")} value={fieldValue(t, event.phone)} />
              <DetailField label={t("common.email")} value={fieldValue(t, event.email)} />
            </div>
          </PacketSection>

          <PacketSection title={t("events.setupAndDining")}>
            <div className="grid gap-2 sm:grid-cols-3">
              <DetailField
                label={t("bookings.package")}
                value={fieldValue(t, event.packageName)}
              />
              <DetailField
                label={t("events.tablecloth")}
                value={fieldValue(t, event.tableclothName)}
              />
              <DetailField
                label={t("events.hallMap")}
                value={event.diningHallMapPreset?.name ?? t("events.notAttached")}
              />
              <DetailField
                label={t("events.setupTime")}
                value={fieldValue(t, event.setupTime)}
              />
              <DetailField
                label={t("events.washingTime")}
                value={fieldValue(t, event.washingTime)}
              />
              {showBillingReadouts ? (
                <DetailField
                  label={t("billing.balance")}
                  value={fieldValue(t, event.balance)}
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

          <PacketSection title={t("events.dayOfTimeline")}>
            {timeline.length > 0 ? (
              <ol className="divide-y divide-[#d8dde5] border border-[#d8dde5]">
                {timeline.map((row) => (
                  <li
                    className="grid gap-2 p-3 sm:grid-cols-[120px_1fr_90px]"
                    key={row.id}
                  >
                    <p className="text-xs font-black text-[#17202a]">
                      {row.cue ? `After ${row.cue}` : row.time || t("events.noTime")}
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
                {t("events.noTimelineInstructions")}
              </p>
            )}
          </PacketSection>

          <PacketSection title={t("bookings.internalNotes")}>
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
                {t("events.noInternalNotes")}
              </p>
            )}
          </PacketSection>

          <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white print:break-inside-avoid">
            <header className="flex min-h-11 items-center gap-3 border-b border-[#d8dde5] bg-[#fbfcfd] px-3 py-2">
              <ReadinessIcon />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-[#17202a]">
                  {t("events.readinessBeforePrint")}
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
                    <span className="block leading-4">{t(item.labelKey)}</span>
                    <span className="mt-0.5 block text-xs font-semibold leading-4 text-[#64748b]">
                      {t(item.helperKey, item.helperValues)}
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
            {t("common.close")}
          </button>
          <button
            className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!readinessSummary.ready}
            onClick={() => window.print()}
            type="button"
          >
            {t("events.printPacket")}
          </button>
        </footer>
      </aside>
    </div>
  );
}
