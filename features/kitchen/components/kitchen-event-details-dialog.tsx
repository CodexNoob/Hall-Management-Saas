"use client";

import { useEffect, useRef, useState } from "react";
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
import { KitchenReplaceDishDrawer } from "@/features/kitchen/components/kitchen-replace-dish-drawer";
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
 * One dish can be swapped for another here, and that is the only menu content
 * this dialog writes. It used to offer replace and remove against
 * `Event.menuItemIds`, which the sheet does not read, so those edits changed
 * what the board showed and nothing else in the product; the swap now goes
 * through `EventMenuLine`, the same rows the event's Menu tab owns. Removing a
 * dish is still not offered: a dish nobody cooks is a promise to the client that
 * somebody has to unmake, which is a conversation, not a button on a board.
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
    }
  | {
      action: "replace-menu-item";
      eventId: string;
      menuItemId: string;
      replacementMenuItemId: string;
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
    }
  | {
      action: "replace-menu-item";
      menuItemId: string;
      replacementMenuItemId: string;
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

/** How long to wait for a second click before treating the first as a single. */
const DOUBLE_CLICK_GRACE_MS = 220;

const CARD_TONE: Record<"COMPLETE" | "PENDING" | "NONE", string> = {
  COMPLETE: "border-[#a5d5bd] bg-[#f2fbf6]",
  PENDING: "border-[#e5c894] bg-[#fffaf1]",
  NONE: "border-[#d8dde5] bg-white"
};

/**
 * One dish, as a card the kitchen taps.
 *
 * The card *is* the control: a click moves the dish on - nothing, then pending,
 * then complete - and a double-click puts it back to nothing. That is the
 * interaction the kitchen was specified to have, and it is the right one for the
 * room: the person using this is usually holding a tray, and asking them to find
 * a named button on the correct row is asking for the wrong row.
 *
 * A double-click delivers two `click` events before its `dblclick`, so a single
 * click is held for `DOUBLE_CLICK_GRACE_MS` and cancelled if the second arrives.
 * Without that, a reset would first fire two status writes and land wherever the
 * race left it.
 *
 * Assignment stays a `<select>`, beneath the card body rather than inside it: a
 * control nested in a button is both invalid markup and a second meaning for the
 * same click.
 */
function DishCard({
  isSaving,
  line,
  onReplace,
  onSaveItemAction,
  permissions,
  workers
}: {
  isSaving: boolean;
  line: EventKitchenLine;
  onReplace: (line: EventKitchenLine) => void;
  onSaveItemAction: (input: LineActionInput) => Promise<void>;
  permissions: KitchenPermissions;
  workers: KitchenResponse["workers"];
}) {
  const pendingClick = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pendingClick.current) clearTimeout(pendingClick.current);
    },
    []
  );

  // An add-on line has no menu item id, and `KitchenItemStatus` is keyed by
  // one, so there is nowhere to record its progress.
  const menuItemId = line.menuItemId;
  const canTick = permissions.canUpdateKitchenStatus && Boolean(menuItemId);
  const tone =
    line.status === "COMPLETE"
      ? CARD_TONE.COMPLETE
      : line.status === "PENDING"
        ? CARD_TONE.PENDING
        : CARD_TONE.NONE;

  function advance() {
    if (!menuItemId || line.status === "COMPLETE") return;

    void onSaveItemAction({
      action: "status",
      menuItemId,
      status: nextStatus(line.status)
    });
  }

  function reset() {
    if (!menuItemId || !line.status) return;

    void onSaveItemAction({ action: "reset-status", menuItemId });
  }

  function handleClick() {
    // Already waiting on the first click of this pair - the dblclick handler
    // will clear it.
    if (pendingClick.current) return;

    pendingClick.current = setTimeout(() => {
      pendingClick.current = null;
      advance();
    }, DOUBLE_CLICK_GRACE_MS);
  }

  function handleDoubleClick() {
    if (pendingClick.current) {
      clearTimeout(pendingClick.current);
      pendingClick.current = null;
    }

    reset();
  }

  const body = (
    <>
      {line.assignedWorkerName ? (
        <span className="mb-2 inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-[#0f5132] px-2.5 py-1 text-[10px] font-black text-white">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/70"
          />
          <span className="truncate">{line.assignedWorkerName}</span>
        </span>
      ) : null}

      <span className="block text-sm font-black leading-tight text-[#17202a]">
        {line.name}
      </span>

      <span className="mt-2 block">
        <LineQuantity line={line} />
      </span>

      <span className="mt-auto block pt-3">
        <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">
          {line.serviceStyle ?? "No style"}
        </span>
        <span className="mt-1 block">
          <LineStatus status={line.status} />
        </span>
      </span>
    </>
  );

  return (
    <article className="flex min-w-0 flex-col">
      {canTick ? (
        <button
          aria-label={`${line.name} — ${statusLabel(line.status)}. Click to move on, double-click to reset.`}
          className={`flex min-h-34 flex-1 flex-col rounded-xl border p-3 text-left shadow-sm transition hover:border-[#1f4d73] hover:bg-[#eef4fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4d73] disabled:cursor-not-allowed disabled:opacity-60 ${tone}`}
          disabled={isSaving}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          // Double-click has no keyboard equivalent, and reset would otherwise
          // be reachable by mouse only.
          onKeyDown={(keyEvent) => {
            if (keyEvent.key === "Delete" || keyEvent.key === "Backspace") {
              keyEvent.preventDefault();
              reset();
            }
          }}
          type="button"
        >
          {body}
        </button>
      ) : (
        <div
          className={`flex min-h-34 flex-1 flex-col rounded-xl border p-3 ${tone}`}
        >
          {body}
        </div>
      )}

      {/* Both controls sit under the card rather than in it: the card body is
          itself the status button, and a control nested in a button is both
          invalid markup and a second meaning for the same click. Stacked rather
          than side by side because these cards are two to a row on a phone. */}
      {menuItemId &&
      (permissions.canAssignWorkers || permissions.canUpdateKitchenStatus) ? (
        <div className="mt-1 flex flex-col gap-1">
          {permissions.canAssignWorkers ? (
            <label className="block">
              <span className="sr-only">Assign a worker to {line.name}</span>
              <select
                className="h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 text-xs font-black text-[#17202a] transition hover:border-[#1f4d73] disabled:opacity-50"
                disabled={isSaving}
                onChange={(changeEvent) =>
                  void onSaveItemAction({
                    action: "assign-worker",
                    menuItemId,
                    assignedWorkerId: changeEvent.target.value || null
                  })
                }
                value={line.assignedWorkerId ?? ""}
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

          {permissions.canUpdateKitchenStatus ? (
            <button
              aria-label={`Replace ${line.name}`}
              className="h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 text-xs font-black text-[#17202a] transition hover:border-[#1f4d73] hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
              onClick={() => onReplace(line)}
              type="button"
            >
              Replace
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
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
  // The dish the replace drawer was opened from, held by id so the drawer keeps
  // reading the refreshed sheet rather than the row as it was when it opened.
  const [replaceLineId, setReplaceLineId] = useState<string | null>(null);
  const replaceLine = dishes.find((line) => line.id === replaceLineId) ?? null;
  // A dish appears once per menu, so the ones already here cannot go on again.
  const usedMenuItemIds = new Set(
    (sheet?.lines ?? [])
      .map((line) => line.menuItemId)
      .filter((value): value is string => Boolean(value))
  );
  // The board already carries this event's summary, from the same builder the
  // sheet runs - so the tiles are right on the first frame. Reading them off
  // the sheet instead made an event with three dishes announce "No menu behind
  // this event" for as long as its own request was in flight.
  const summary = event.summary;

  /** The board's PATCH wants the event id on every action; the rows do not. */
  async function saveForEvent(input: LineActionInput) {
    await onSaveItemAction({ ...input, eventId: event.id });
  }

  /**
   * Rejects rather than swallowing: the drawer prints the server's reason, and
   * the reasons a swap is refused - the dish is already on this menu, somebody
   * else has since saved it - are the ones the person needs to read.
   */
  async function replaceDish(replacementMenuItemId: string) {
    const menuItemId = replaceLine?.menuItemId;

    if (!menuItemId) return;

    await saveForEvent({
      action: "replace-menu-item",
      menuItemId,
      replacementMenuItemId
    });
  }

  return (
    <>
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
                className="mt-1 truncate text-xl font-black text-[#17202a]"
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
                  note={
                    event.startsAt ? "Event start time" : "No start time set"
                  }
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
                  value={
                    summary ? `${summary.complete}/${summary.dishes}` : "—"
                  }
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
                <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:px-4 xl:grid-cols-4">
                  {dishes.map((line) => (
                    <DishCard
                      isSaving={isSaving}
                      key={line.id}
                      line={line}
                      onReplace={(replacing) => setReplaceLineId(replacing.id)}
                      onSaveItemAction={saveForEvent}
                      permissions={permissions}
                      workers={workers}
                    />
                  ))}
                </div>
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
                {permissions.canUpdateKitchenStatus ? (
                  <p>
                    Click a dish to move it on — not started, then pending, then
                    complete. Double-click to put it back to not started.
                  </p>
                ) : null}
                <p className={permissions.canUpdateKitchenStatus ? "mt-1" : ""}>
                  Quantities come from the counting rules on the event&rsquo;s
                  Menu tab.
                  {permissions.canUpdateKitchenStatus
                    ? " Replace swaps one dish for another on that same menu, so the change reaches everyone reading it. Adding and removing dishes is still done there."
                    : " That tab is also where dishes are added and removed."}
                </p>
              </footer>
            </div>
          </div>
        </section>
      </div>

      {replaceLine ? (
        <KitchenReplaceDishDrawer
          isSaving={isSaving}
          line={replaceLine}
          menuStatus={sheet?.menuStatus ?? event.menuStatus}
          onClose={() => setReplaceLineId(null)}
          onReplace={replaceDish}
          usedMenuItemIds={usedMenuItemIds}
        />
      ) : null}
    </>
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
