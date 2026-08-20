"use client";

import { AsyncState } from "@/components/ui/async-state";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import {
  type EventKitchenLine,
  type EventKitchenResponse
} from "@/features/events/components/event-manager-shared";
import {
  LineName,
  LineQuantity,
  LineStatus
} from "@/features/kitchen/components/kitchen-line-presentation";
import {
  formatServeTime,
  type KitchenEvent,
  type KitchenResponse
} from "@/features/kitchen/components/kitchen-shared";

/**
 * One event's production, opened from a card on the board.
 *
 * This is where the board writes: a dish's status and who is on it. It used to
 * invent its own numbers - `name.includes("challah")` decided "4 trays needed",
 * whatever the headcount - because the board's payload carried dish names and
 * nothing else. The sheet now comes from `GET /api/events/[eventId]/kitchen`,
 * the same route the event workspace's Kitchen tab reads, so the quantities are
 * the ones the counting rules actually produce.
 *
 * Menu content is not editable here. Replacing or removing a dish wrote only
 * `Event.menuItemIds`, which the sheet does not read, so those edits changed
 * what the board showed and nothing else in the product. That belongs on the
 * event's Menu tab, which owns the lines.
 */

export type KitchenItemActionInput =
  | {
      action: "status";
      eventId: string;
      menuItemId: string;
      status: "PENDING" | "COMPLETE";
    }
  | {
      action: "reset-status";
      eventId: string;
      menuItemId: string;
    }
  | {
      action: "assign-worker";
      eventId: string;
      menuItemId: string;
      assignedWorkerId: string | null;
    };

/**
 * The same actions as they read on a row, which already knows its event.
 * Threading the event id down and back out again is what the dialog does once,
 * in `saveForEvent`.
 */
type LineActionInput =
  | { action: "status"; menuItemId: string; status: "PENDING" | "COMPLETE" }
  | { action: "reset-status"; menuItemId: string }
  | {
      action: "assign-worker";
      menuItemId: string;
      assignedWorkerId: string | null;
    };

type KitchenPermissions = KitchenResponse["permissions"];

type DetailsProps = {
  event: KitchenEvent;
  isSaving: boolean;
  onClose: () => void;
  onSaveItemAction: (input: KitchenItemActionInput) => Promise<void>;
  permissions: KitchenPermissions;
  workers: KitchenResponse["workers"];
};

function nextStatus(status: EventKitchenLine["status"]) {
  if (!status) return "PENDING" as const;

  return "COMPLETE" as const;
}

function statusLabel(status: EventKitchenLine["status"]) {
  if (status === "COMPLETE") return "Complete";
  if (status === "PENDING") return "Pending";

  return "Not started";
}

function StatTile({
  label,
  note,
  value
}: {
  label: string;
  note: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[#d8dde5] bg-white p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
        {label}
      </p>
      <p className="mt-2 truncate text-base font-black text-[#17202a] sm:text-xl">
        {value}
      </p>
      <p className="mt-2 text-xs leading-4 text-[#6a7483]">{note}</p>
    </div>
  );
}

/**
 * The controls on one dish row.
 *
 * Inline rather than behind a second modal. The old dialog opened a sub-dialog
 * to choose between "assign", "status" and two menu edits, which meant three
 * clicks and a lost place in the list to tick off one dish - in a room where
 * the thing being held is usually a tray.
 */
function LineActions({
  isSaving,
  line,
  onSaveItemAction,
  permissions,
  workers
}: {
  isSaving: boolean;
  line: EventKitchenLine;
  onSaveItemAction: (input: LineActionInput) => Promise<void>;
  permissions: KitchenPermissions;
  workers: KitchenResponse["workers"];
}) {
  // An add-on line has no menu item id, and `KitchenItemStatus` is keyed by
  // one, so there is nowhere to record its progress.
  if (!line.menuItemId) return null;

  const menuItemId = line.menuItemId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {permissions.canUpdateKitchenStatus ? (
        <>
          <button
            className="h-9 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white transition hover:bg-[#17405f] disabled:opacity-50"
            disabled={isSaving || line.status === "COMPLETE"}
            onClick={() =>
              void onSaveItemAction({
                action: "status",
                menuItemId,
                status: nextStatus(line.status)
              })
            }
            type="button"
          >
            Mark {statusLabel(nextStatus(line.status)).toLowerCase()}
          </button>

          {line.status ? (
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] transition hover:bg-[#eef4fa] disabled:opacity-50"
              disabled={isSaving}
              onClick={() =>
                void onSaveItemAction({ action: "reset-status", menuItemId })
              }
              type="button"
            >
              Reset
            </button>
          ) : null}
        </>
      ) : null}

      {permissions.canAssignWorkers ? (
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Assign a worker to {line.name}</span>
          <select
            className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-2 text-xs font-black text-[#17202a] disabled:opacity-50"
            disabled={isSaving}
            onChange={(changeEvent) =>
              void onSaveItemAction({
                action: "assign-worker",
                menuItemId,
                assignedWorkerId: changeEvent.target.value || null
              })
            }
            value={
              workers.find((worker) => worker.name === line.assignedWorkerName)
                ?.id ?? ""
            }
          >
            <option value="">Unassigned</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

function KitchenEventDetails({
  event,
  isSaving,
  onClose,
  onSaveItemAction,
  permissions,
  workers
}: DetailsProps) {
  // A hand-added kitchen event has no booking behind it, so there is no sheet
  // to ask for. Fetching would 404 on an id that exists only in this browser.
  const hasSheet = event.summary !== null;
  const kitchenQuery = useAuthenticatedQuery<EventKitchenResponse>(
    `/api/events/${event.id}/kitchen`,
    hasSheet
  );
  const sheet = kitchenQuery.data?.kitchen ?? null;
  const hold = event.statusType === "hold";
  const dishes = sheet?.lines.filter((line) => line.kind === "Dish") ?? [];
  const addOns = sheet?.lines.filter((line) => line.kind === "AddOn") ?? [];
  // The board already carries this event's summary, from the same builder the
  // sheet runs - so the tiles are right on the first frame. Reading them off
  // the sheet instead made an event with three dishes announce "No menu behind
  // this event" for as long as its own request was in flight.
  const summary = event.summary;

  /** The board's PATCH wants the event id on every action; the rows do not. */
  async function saveForEvent(input: LineActionInput) {
    await onSaveItemAction({ ...input, eventId: event.id });
  }

  return (
    <div className="dashboard-drawer-backdrop fixed inset-0 z-100 flex items-center justify-center bg-[#07162d]/45 p-3 backdrop-blur-sm">
      <section
        aria-labelledby="kitchen-event-details-title"
        aria-modal="true"
        className="max-h-[calc(100dvh-24px)] w-full max-w-5xl overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#07162d]/25"
        role="dialog"
      >
        <header className="flex items-start gap-3 border-b border-[#d8dde5] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wide text-[#617086]">
              {event.category}
            </p>
            <h2
              className="mt-1 truncate text-xl font-black text-[#07162d]"
              id="kitchen-event-details-title"
            >
              {event.title}
            </h2>
          </div>

          <button
            aria-label="Close kitchen event details"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-[#17202a] transition hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="max-h-[calc(100dvh-104px)] overflow-y-auto bg-[#f5f6f8] p-4 sm:p-5">
          <div
            className={`mb-3 flex min-h-10 items-center justify-center rounded-lg px-4 text-center text-sm font-black uppercase tracking-wide text-white ${
              hold ? "bg-[#d88a00]" : "bg-[#1f4d73]"
            }`}
          >
            {event.status ?? (hold ? "On hold - not confirmed" : "Kitchen")}
          </div>

          <div className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
            <div className="grid grid-cols-2 gap-2 border-b border-[#d8dde5] bg-[#fbfcfd] p-3 sm:gap-3 sm:px-4 lg:grid-cols-4">
              <StatTile
                label="Serves"
                note={event.startsAt ? "Event start time" : "No start time set"}
                value={formatServeTime(event.startsAt)}
              />
              <StatTile
                label="Portions"
                note={
                  sheet && sheet.counts.waiters > 0
                    ? `${sheet.counts.waiters} waiters not counted`
                    : "Guests, waiters excluded"
                }
                value={event.totalGuests}
              />
              <StatTile
                label="Prepared"
                note={
                  summary
                    ? `${summary.pending} pending · ${summary.notStarted} not started`
                    : "No menu behind this event"
                }
                value={summary ? `${summary.complete}/${summary.dishes}` : "—"}
              />
              <StatTile
                label="Needs attention"
                note={
                  !summary
                    ? "Nothing to count"
                    : summary.needsAttention === 0
                      ? "Every dish has a quantity"
                      : "Dishes with no quantity to cook to"
                }
                value={summary ? summary.needsAttention : "—"}
              />
            </div>

            {summary && summary.needsAttention > 0 ? (
              <p
                className="border-b border-[#f0d9a8] bg-[#fdf8ec] px-3 py-2.5 text-xs leading-5 text-[#8a6414] sm:px-4"
                role="status"
              >
                {summary.needsAttention} dish
                {summary.needsAttention === 1 ? "" : "es"} cannot be counted
                yet.
                {summary.unresolvedBases.includes("Tables")
                  ? " Draw the dining plan so per-table rules have a table count."
                  : " Set a service style on the Menu tab, or a counting rule in the menu library."}
              </p>
            ) : null}

            {!hasSheet ? (
              <div className="p-4">
                <AsyncState
                  emptyMessage="Kitchen events added by hand have no menu behind them, so there is nothing to count."
                  emptyTitle="No production sheet"
                  isEmpty
                />
              </div>
            ) : kitchenQuery.isLoading || kitchenQuery.error ? (
              <div className="p-4">
                <AsyncState
                  error={kitchenQuery.error}
                  isLoading={kitchenQuery.isLoading}
                  onRetry={() => void kitchenQuery.refetch()}
                />
              </div>
            ) : dishes.length === 0 ? (
              <div className="p-4">
                <AsyncState
                  emptyMessage="Add dishes on the event's Menu tab and this sheet fills in with what to cook."
                  emptyTitle="No dishes on this menu yet"
                  isEmpty
                />
              </div>
            ) : (
              <ul className="divide-y divide-[#d8dde5]">
                {dishes.map((line) => (
                  <li
                    className="flex flex-wrap items-start justify-between gap-3 p-3 sm:px-4"
                    key={line.id}
                  >
                    <div className="min-w-50 flex-1">
                      <LineName line={line} />
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <LineQuantity line={line} />
                        <span className="text-xs text-[#6a7483]">
                          {line.serviceStyle ?? "No style"}
                        </span>
                        <span className="text-xs text-[#6a7483]">
                          {line.assignedWorkerName ?? "Unassigned"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <LineStatus status={line.status} />
                      <LineActions
                        isSaving={isSaving}
                        line={line}
                        onSaveItemAction={saveForEvent}
                        permissions={permissions}
                        workers={workers}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {addOns.length > 0 ? (
              <section className="border-t border-[#d8dde5] px-3 py-3 sm:px-4">
                <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
                  Add-ons
                </h3>
                {/* Statusless on purpose: KitchenItemStatus is keyed by menu
                    item, so an add-on line has nowhere to record one. */}
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {addOns.map((line) => (
                    <li
                      className="flex min-w-0 items-center gap-2.5 rounded-lg border border-[#d8dde5] bg-white px-3 py-2"
                      key={line.id}
                    >
                      <LineName line={line} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <footer className="border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-2.5 text-xs text-[#6a7483] sm:px-4">
              Dishes and quantities are set on the event&rsquo;s Menu tab. This
              board records who is cooking what, and how far along it is.
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
}

export function KitchenEventDetailsDialog({
  event,
  ...rest
}: Omit<DetailsProps, "event"> & { event: KitchenEvent | null }) {
  if (!event) return null;

  // Keyed so that opening a different card starts from that event's own state
  // rather than inheriting the last one's query record.
  return <KitchenEventDetails event={event} key={event.id} {...rest} />;
}
