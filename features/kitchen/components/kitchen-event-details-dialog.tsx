"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AsyncState } from "@/components/ui/async-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import {
  type EventKitchenLine,
  type EventKitchenResponse
} from "@/features/events/components/event-manager-shared";
import { LineQuantity } from "@/features/kitchen/components/kitchen-line-presentation";
import { KitchenReplaceDishDrawer } from "@/features/kitchen/components/kitchen-replace-dish-drawer";
import { isDrinkKind } from "@/features/menu/lib/service-style";
import {
  formatOtherMeals,
  formatServeTime,
  mealLabel,
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
    }
  | {
      action: "replace-add-on";
      eventId: string;
      addOnId: string;
      replacementAddOnId: string;
    }
  | {
      action: "standalone-status";
      kitchenEventId: string;
      menuItemId: string;
      status: "PENDING" | "COMPLETE";
    }
  | {
      action: "standalone-reset-status";
      kitchenEventId: string;
      menuItemId: string;
    }
  | {
      action: "standalone-assign-worker";
      kitchenEventId: string;
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
    }
  | {
      action: "replace-menu-item";
      menuItemId: string;
      replacementMenuItemId: string;
    }
  | {
      action: "replace-add-on";
      addOnId: string;
      replacementAddOnId: string;
    };

type KitchenPermissions = KitchenResponse["permissions"];
type AssignmentFilter = "all" | "mine" | "unassigned";

type DetailsProps = {
  event: KitchenEvent;
  isSaving: boolean;
  onClose: () => void;
  onSaveItemAction: (input: KitchenItemActionInput) => Promise<void>;
  /**
   * Takes this event off the board. Absent when the caller does not offer it -
   * without the permission, or on an event it cannot act on.
   *
   * What that means depends on what the event is, and the confirmation says so:
   * a booking is cancelled, keeping its menu, counts, invoices and activity,
   * because those are owed to a client and to the books; a standalone kitchen
   * job is deleted outright, because nothing is owed - it is a note to the
   * kitchen with no client, no invoice and no place on the calendar.
   */
  onRemoveEvent?: () => Promise<void>;
  /**
   * Draws the panel in place rather than over the page.
   *
   * The board uses it: the day's production is the point of that screen, so it
   * is on the screen rather than behind a card somebody has to click to find
   * out what is being cooked.
   */
  inline?: boolean;
  /** A fixed-size, clipped week-column preview. */
  preview?: boolean;
  /** Week-view popup styled as the blue production sheet reference. */
  chromeless?: boolean;
  permissions: KitchenPermissions;
  currentWorkerId?: string | null;
  workersOnly?: boolean;
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

/**
 * What a dish card looks like at each step of the cook's loop.
 *
 * A card is the button that advances the dish, so where it has got to has to be
 * legible without tapping it: the surface carries the answer at arm's length
 * across a whole grid, and the label under the rule says it in words for anyone
 * who cannot rely on the colour alone.
 */
const CARD_STATUS_TONE = {
  COMPLETE: "border-[#b9ddcf] bg-[#effbf6]",
  PENDING: "border-[#efcf98] bg-[#fff8ec]",
  NONE: "border-[#cfd5dc] bg-[#f8f9fb]"
} as const;

const CARD_STATUS_TEXT = {
  COMPLETE: "text-[#087047]",
  PENDING: "text-[#995700]",
  NONE: "text-[#6a7483]"
} as const;

function statusKey(status: EventKitchenLine["status"]) {
  return status === "COMPLETE" || status === "PENDING" ? status : "NONE";
}

function StatTile({
  label,
  note,
  tone = "default",
  value
}: {
  label: string;
  note: string;
  tone?: "default" | "blue" | "gold" | "green" | "red";
  value: string | number;
}) {
  const toneClass = {
    default: "border-[#d8dde5] bg-white",
    blue: "border-[#c7d8e8] bg-[#f3f8fc]",
    gold: "border-[#eed39a] bg-[#fff9eb]",
    green: "border-[#b9dfca] bg-[#f3fbf6]",
    red: "border-[#f3b7b7] bg-[#fff5f5]"
  }[tone];

  return (
    <div className={`min-w-0 border p-3 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </p>
      <p className="mt-3 truncate text-xl font-black text-[#111827] sm:text-2xl">
        {value}
      </p>
      <p className="mt-3 text-xs leading-4 text-[#64748b]">{note}</p>
    </div>
  );
}

function WorkflowStep({
  label,
  tone,
  value
}: {
  label: string;
  tone: "none" | "pending" | "complete";
  value: number;
}) {
  const toneClass = {
    none: "border-[#d8dde5] bg-white text-[#475569]",
    pending: "border-[#e5c894] bg-[#fffaf1] text-[#8a5a00]",
    complete: "border-[#a5d5bd] bg-[#f2fbf6] text-[#0f5132]"
  }[tone];

  return (
    <div
      className={`flex min-w-0 items-center justify-between border px-3 py-2 ${toneClass}`}
    >
      <span className="truncate text-xs font-black">{label}</span>
      <span className="ml-3 text-sm font-black">{value}</span>
    </div>
  );
}

/** Wait briefly so the clicks preceding a double-click do not advance status. */
const DOUBLE_CLICK_GRACE_MS = 220;
const WORKER_TONES = [
  "bg-[#7657df]",
  "bg-[#e12b2b]",
  "bg-[#2474dc]",
  "bg-[#3f4e61]",
  "bg-[#178151]"
];

function workerTone(name: string) {
  const index = [...name].reduce(
    (sum, letter) => sum + letter.charCodeAt(0),
    0
  );
  return WORKER_TONES[index % WORKER_TONES.length];
}

/**
 * One dish, as a card the kitchen taps.
 *
 * The card *is* the forward control: a click moves the dish from nothing, to
 * pending, to complete. A double-click requests a reset, but never writes it
 * until the worker confirms. The named reset action provides the same flow for
 * touch and keyboard users.
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
  canReplace = true,
  compact = false,
  preview = false,
  workers
}: {
  isSaving: boolean;
  line: EventKitchenLine;
  onReplace: (line: EventKitchenLine) => void;
  onSaveItemAction: (input: LineActionInput) => Promise<void>;
  permissions: KitchenPermissions;
  canReplace?: boolean;
  /**
   * Shorter cards, for the board where every event is on screen at once.
   *
   * A dialog shows one event and can spend the height; the day view stacks
   * them, so a card tall enough to be comfortable on its own turns three
   * events into a page of scrolling. Same content either way - this only
   * takes out the slack.
   */
  compact?: boolean;
  /** Extra-short fixed-width card inside a cropped week preview. */
  preview?: boolean;
  workers: KitchenResponse["workers"];
}) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [showingNotStartedNotice, setShowingNotStartedNotice] = useState(false);
  const [resetStatus, setResetStatus] = useState<"PENDING" | "COMPLETE" | null>(
    null
  );
  const [visibleStatus, setVisibleStatus] = useState(line.status);
  const optimisticStatus = useRef<"PENDING" | "COMPLETE" | null>(null);
  const pendingClick = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingClickStartStatus = useRef<EventKitchenLine["status"]>(null);

  useEffect(() => {
    // A revalidation started by the previous write can arrive while the next
    // click is being saved. Ignore that older snapshot until the server returns
    // the exact state this card is currently showing.
    if (
      optimisticStatus.current !== null &&
      line.status !== optimisticStatus.current
    ) {
      return;
    }

    optimisticStatus.current = null;
    setVisibleStatus(line.status);
  }, [line.status]);

  useEffect(
    () => () => {
      if (pendingClick.current) clearTimeout(pendingClick.current);
    },
    []
  );

  // An add-on line has no menu item id, and `KitchenItemStatus` is keyed by
  // one, so there is nowhere to record its progress.
  const menuItemId = line.menuItemId;
  const replaceableId = line.menuItemId ?? line.addOnId;
  const canTick = permissions.canUpdateKitchenStatus && Boolean(menuItemId);

  async function reset() {
    if (!menuItemId) return;
    await onSaveItemAction({ action: "reset-status", menuItemId });
  }

  function requestReset() {
    if (!visibleStatus) return;
    setResetStatus(visibleStatus);
    setConfirmingReset(true);
  }

  function closeResetConfirmation() {
    setConfirmingReset(false);
    setResetStatus(null);
  }

  function handleClick() {
    if (pendingClick.current || !menuItemId || visibleStatus === "COMPLETE") {
      return;
    }

    const previousStatus = visibleStatus;
    const status = nextStatus(previousStatus);

    pendingClickStartStatus.current = previousStatus;

    // Hold the paint through the double-click window. Browsers deliver the
    // first ordinary click before they identify a double-click; changing the
    // status here would make either reset path flash through the next state.

    pendingClick.current = setTimeout(() => {
      pendingClick.current = null;
      pendingClickStartStatus.current = null;
      optimisticStatus.current = status;
      setVisibleStatus(status);
      void onSaveItemAction({ action: "status", menuItemId, status }).catch(
        () => {
          optimisticStatus.current = null;
          setVisibleStatus(previousStatus);
        }
      );
    }, DOUBLE_CLICK_GRACE_MS);
  }

  function handleDoubleClick() {
    if (!menuItemId) return;

    if (pendingClick.current) {
      const statusBeforeClicks = pendingClickStartStatus.current;
      clearTimeout(pendingClick.current);
      pendingClick.current = null;
      pendingClickStartStatus.current = null;

      if (statusBeforeClicks === null) {
        optimisticStatus.current = null;
        setVisibleStatus(line.status);
        setShowingNotStartedNotice(true);
        return;
      }

      optimisticStatus.current = null;
    }

    requestReset();
  }

  // The card's own padding, so the worker ribbon can bleed back out to the
  // card's edge by exactly as much as the card pulls it in.
  const cardPadding = preview ? "p-1.5" : compact ? "p-2.5" : "p-3";
  const cardHeight = preview ? "min-h-16" : compact ? "min-h-32" : "min-h-41";

  const body = (
    <>
      {line.assignedWorkerName ? (
        <span
          className={`${preview ? "-mx-1.5 -mt-1.5 mb-1" : compact ? "-mx-2.5 -mt-2.5 mb-2" : "-mx-3 -mt-3 mb-3"} block truncate px-2 py-0.5 text-center text-[9px] font-black text-white ${workerTone(line.assignedWorkerName)}`}
        >
          {line.assignedWorkerName}
        </span>
      ) : null}

      <span
        className={`block font-black leading-tight ${preview ? "text-xs" : "text-base"}`}
      >
        <LineQuantity line={line} />
      </span>

      <span
        className={`block font-black leading-tight text-[#17202a] ${preview ? "mt-0.5 text-xs" : compact ? "mt-1 text-sm" : "mt-2 text-sm"}`}
      >
        {line.name}
      </span>

      <span
        className={`mt-auto block border-t border-[#cfd5dc] ${compact ? "pt-2" : "pt-4"}`}
      >
        {/*
          The kitchen note, and only when there is one. This used to fall back
          to the dish name, which printed it twice on every card that had no
          note - saying nothing, and leaving anything looking the card up by
          name with two matches instead of one.
        */}
        {line.notes ? (
          <span className="block text-center text-[11px] font-bold leading-tight text-[#6a7483]">
            {line.notes}
          </span>
        ) : null}

        {/*
          In words as well as in colour. The card is the control that advances
          the dish, so a cook has to be able to read where it has got to without
          tapping it to find out - and a wash of colour alone is not something
          everyone can tell apart.
        */}
        <span
          className={`block text-center text-[10px] font-black uppercase tracking-[0.08em] ${line.notes ? "mt-2" : ""} ${CARD_STATUS_TEXT[statusKey(visibleStatus)]}`}
        >
          {statusLabel(visibleStatus)}
        </span>
      </span>
    </>
  );

  return (
    <article
      className={`flex min-w-0 flex-col ${preview ? "w-20 shrink-0" : ""}`}
    >
      {canTick ? (
        <button
          aria-label={`${line.name} — ${statusLabel(visibleStatus)}. Click to move on, double-click to request a reset.`}
          className={`flex flex-1 flex-col border text-left transition hover:border-[#1f4d73] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4d73] disabled:cursor-not-allowed disabled:opacity-60 ${cardHeight} ${cardPadding} ${CARD_STATUS_TONE[statusKey(visibleStatus)]}`}
          disabled={isSaving}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          type="button"
        >
          {body}
        </button>
      ) : (
        <div
          className={`flex flex-1 flex-col border ${cardHeight} ${cardPadding} ${CARD_STATUS_TONE[statusKey(line.status)]}`}
        >
          {body}
        </div>
      )}

      {/* These controls sit under the card rather than in it: the card body is
          itself the status button, and a control nested in a button is both
          invalid markup and a second meaning for the same click. Status reset
          deliberately has no visible control here; double-clicking the card
          opens its confirmation. */}
      {replaceableId &&
      (permissions.canAssignWorkers ||
        (permissions.canUpdateKitchenStatus && canReplace)) ? (
        <div className="mt-1 flex flex-col gap-1">
          {permissions.canAssignWorkers && menuItemId ? (
            <label className="block">
              <span className="sr-only">Assign a worker to {line.name}</span>
              <select
                className={`w-full rounded-lg border border-[#b9c2cf] bg-white px-2 font-black text-[#17202a] transition hover:border-[#1f4d73] disabled:opacity-50 ${preview ? "h-5 text-[9px]" : compact ? "h-8 text-xs" : "h-9 text-xs"}`}
                disabled={isSaving}
                name={`assignedWorker-${menuItemId}`}
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

          {permissions.canUpdateKitchenStatus && canReplace ? (
            <button
              aria-label={`Replace ${line.name}`}
              className={`w-full rounded-lg border border-[#b9c2cf] bg-white px-2 font-black text-[#17202a] transition hover:border-[#1f4d73] hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50 ${preview ? "h-5 text-[9px]" : compact ? "h-8 text-xs" : "h-9 text-xs"}`}
              disabled={isSaving}
              onClick={() => onReplace(line)}
              type="button"
            >
              Replace
            </button>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        confirmLabel="Reset dish status"
        description={`Reset “${line.name}” from ${statusLabel(resetStatus ?? visibleStatus)} to Not started? This removes its recorded progress.`}
        fallbackErrorMessage="The dish status could not be reset. Please try again."
        onClose={closeResetConfirmation}
        onConfirm={async () => {
          await reset();
          optimisticStatus.current = null;
          setVisibleStatus(null);
          closeResetConfirmation();
        }}
        open={confirmingReset}
        pendingLabel="Resetting…"
        title="Reset dish status?"
      />
      <ConfirmDialog
        confirmLabel="Close"
        description={`“${line.name}” is still Not started, so there is no recorded progress to reset. Click the dish once to mark it Pending.`}
        mode="notice"
        onClose={() => setShowingNotStartedNotice(false)}
        open={showingNotStartedNotice}
        title="Dish not started yet"
      />
    </article>
  );
}

function KitchenEventDetails({
  event,
  isSaving,
  inline = false,
  preview = false,
  chromeless = false,
  onClose,
  onRemoveEvent,
  onSaveItemAction,
  permissions,
  currentWorkerId,
  workersOnly,
  workers
}: DetailsProps) {
  const titleId = useId();
  const asideTitleId = useId();
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const isStandalone = event.source === "standalone";
  const embedded = inline || preview;
  const hasSheet = Boolean(event.sheet) || event.summary !== null;
  const kitchenQuery = useAuthenticatedQuery<EventKitchenResponse>(
    `/api/events/${event.id}/kitchen`,
    hasSheet && !event.sheet
  );
  const sheet = event.sheet ?? kitchenQuery.data?.kitchen ?? null;
  const hold = event.statusType === "hold";
  const addOns = sheet?.lines.filter((line) => line.kind === "AddOn") ?? [];
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>(
    workersOnly ? "mine" : "all"
  );
  const allDishes = sheet?.lines.filter((line) => line.kind === "Dish") ?? [];
  const assignedToMeCount = currentWorkerId
    ? allDishes.filter((line) => line.assignedWorkerId === currentWorkerId)
        .length
    : 0;
  const unassignedCount = allDishes.filter(
    (line) => !line.assignedWorkerId
  ).length;
  const visibleDishes = allDishes.filter((line) => {
    if (assignmentFilter === "mine") {
      return currentWorkerId
        ? line.assignedWorkerId === currentWorkerId
        : Boolean(line.assignedWorkerId);
    }
    if (assignmentFilter === "unassigned") return !line.assignedWorkerId;

    return true;
  });
  // Drinks come out first, whichever style they carry. A bottle counted "two
  // per table" is stored as Plated and would otherwise be filed among the
  // plates - which is not what anyone pouring it is looking for.
  const visibleDrinks = visibleDishes.filter((line) =>
    isDrinkKind(line.itemKind ?? "")
  );
  const visibleFood = visibleDishes.filter(
    (line) => !isDrinkKind(line.itemKind ?? "")
  );
  const dishSections = [
    {
      id: "plated",
      label: "Plated items",
      dishes: visibleFood.filter((line) => line.serviceStyle === "Plated")
    },
    {
      id: "buffet",
      label: "Buffet items",
      dishes: visibleFood.filter((line) => line.serviceStyle === "Buffet")
    },
    {
      id: "drinks",
      label: "Drinks",
      dishes: visibleDrinks
    },
    {
      id: "other",
      label: "Other items",
      dishes: visibleFood.filter(
        (line) =>
          line.serviceStyle !== "Plated" && line.serviceStyle !== "Buffet"
      )
    }
  ].filter((section) => section.dishes.length > 0);
  // The dish the replace drawer was opened from, held by id so the drawer keeps
  // reading the refreshed sheet rather than the row as it was when it opened.
  const [replaceLineId, setReplaceLineId] = useState<string | null>(null);
  const replaceLine =
    (sheet?.lines ?? []).find((line) => line.id === replaceLineId) ?? null;
  // A dish appears once per menu, so the ones already here cannot go on again.
  const usedMenuItemIds = new Set(
    (sheet?.lines ?? [])
      .map((line) => line.menuItemId ?? line.addOnId)
      .filter((value): value is string => Boolean(value))
  );
  // The board already carries this event's summary, from the same builder the
  // sheet runs - so the tiles are right on the first frame. Reading them off
  // the sheet instead made an event with three dishes announce "No menu behind
  // this event" for as long as its own request was in flight.
  const summary = event.summary;
  // Same reason as `summary`: the board's payload already answers this, so the
  // notice is on the first frame rather than appearing once the sheet lands.
  const otherMeals = sheet?.otherMeals ?? event.otherMeals;

  useEffect(() => {
    if (embedded) return;

    function closeOnEscape(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [embedded, onClose]);

  /** The board's PATCH wants the event id on every action; the rows do not. */
  async function saveForEvent(input: LineActionInput) {
    if (isStandalone) {
      if (input.action === "status") {
        await onSaveItemAction({
          action: "standalone-status",
          kitchenEventId: event.id,
          menuItemId: input.menuItemId,
          status: input.status
        });
        return;
      }

      if (input.action === "reset-status") {
        await onSaveItemAction({
          action: "standalone-reset-status",
          kitchenEventId: event.id,
          menuItemId: input.menuItemId
        });
        return;
      }

      if (input.action === "assign-worker") {
        await onSaveItemAction({
          action: "standalone-assign-worker",
          kitchenEventId: event.id,
          menuItemId: input.menuItemId,
          assignedWorkerId: input.assignedWorkerId
        });
      }

      return;
    }

    await onSaveItemAction({ ...input, eventId: event.id });
  }

  /**
   * Rejects rather than swallowing: the drawer prints the server's reason, and
   * the reasons a swap is refused - the dish is already on this menu, somebody
   * else has since saved it - are the ones the person needs to read.
   */
  async function replaceDish(replacementMenuItemId: string) {
    if (!replaceLine) return;

    if (replaceLine.kind === "AddOn" && replaceLine.addOnId) {
      await saveForEvent({
        action: "replace-add-on",
        addOnId: replaceLine.addOnId,
        replacementAddOnId: replacementMenuItemId
      });
      return;
    }

    if (!replaceLine.menuItemId) return;

    await saveForEvent({
      action: "replace-menu-item",
      menuItemId: replaceLine.menuItemId,
      replacementMenuItemId
    });
  }

  /*
   * The same body, in one of two shells.
   *
   * Inline is how the board draws an event now: the production for the day is
   * the point of the screen, so it is on the screen - not behind a card that
   * has to be clicked to find out what is being cooked. The dialog shell is
   * kept for the places that still open one event over the top of something
   * else, and both share every piece of state below, so the two cannot drift
   * into behaving differently.
   */
  const shellClass = embedded
    ? "flex w-full flex-col overflow-hidden border border-[#d8dde5] bg-white"
    : chromeless
      ? "flex max-h-[calc(100dvh-32px)] w-full max-w-5xl flex-col overflow-hidden border-4 border-white bg-[#dceaff] shadow-2xl shadow-[#07162d]/25"
      : "flex max-h-[calc(100dvh-32px)] w-full max-w-7xl flex-col overflow-hidden border border-[#d8dde5] bg-white shadow-2xl shadow-[#07162d]/25";

  const body = (
    <>
      <section
        // Inline, the blue column's own client name is the heading: the title
        // bar is gone with the dialog it belonged to, but the section still
        // has to be announced as something.
        aria-labelledby={embedded || chromeless ? asideTitleId : titleId}
        aria-modal={embedded ? undefined : "true"}
        className={shellClass}
        role={embedded ? undefined : "dialog"}
      >
        {/*
          A bar naming the event, above a column already naming the event, is
          one title too many once the panel is the page rather than something
          opened over it.
        */}
        {embedded || chromeless ? null : (
        <header className="flex shrink-0 items-center gap-3 border-b border-[#d8dde5] bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="hidden text-[11px] font-black uppercase tracking-wide text-[#617086]">
              {event.category}
            </p>
            <h2
              className="truncate text-lg font-black text-[#111827]"
              id={titleId}
            >
              {event.eventType ?? event.title} · Full Details
            </h2>
            <p className="hidden mt-2 flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-[#64748b]">
              <span>{event.totalGuests} portions</span>
              <span aria-hidden="true">•</span>
              <span>Serves {formatServeTime(event.startsAt)}</span>
              <span aria-hidden="true">•</span>
              <span>{mealLabel(sheet?.meal ?? "Main")} meal</span>
            </p>
          </div>

          <button
            aria-label="Close kitchen event details"
            className="flex h-9 shrink-0 items-center justify-center border border-[#d8dde5] px-3 text-sm font-bold text-[#111827] transition hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            × Close
          </button>
        </header>
        )}

          <div
            className={`min-h-0 flex-1 overflow-y-auto ${chromeless ? "bg-[#dceaff]" : "bg-white"} ${embedded || chromeless ? "" : "p-4 sm:p-5"}`}
          >
            {/*
              The row is in here rather than being the scroller itself.
              A flex row, not a float: the aside used to be floated with
              `min-h-132` on it and on the dish panel, which set both to 33rem
              however little was on the sheet, and let the panel outgrow the
              aside on a long one - so the blue column stopped short of the
              dishes beside it.
              Stretching only works against the height of the line, so the row
              has to be the element that grows with the dishes. When the
              scrolling element was itself the row, the aside stretched to the
              height of the *window onto* the content instead: scroll past a
              long sheet and the blue column ran out, leaving white beside the
              add-ons. This wrapper has no height of its own, so the line is as
              tall as the dishes and the aside follows it down.
            */}
            <div className={preview ? "flex items-stretch" : "lg:flex lg:items-stretch"}>
              {/*
                The blue column is the panel's floor: it is taller than a short
                dish list, so its padding sets how much room one event takes on
                a board showing all of them. Roomy in the dialog, close-cropped
                inline.
              */}
              <aside
                className={`border-l-8 border-[#2f80ed] bg-[#dceaff] lg:mb-0 lg:shrink-0 ${
                  preview
                    ? "relative mb-0 w-24 min-w-0 shrink-0 overflow-hidden border-r border-[#c8daf2] px-2 py-2 pb-8"
                    : embedded
                    ? // A share of the panel rather than a fixed 15rem: the
                      // same panel is the width of the board in the day view
                      // and a seventh of it in a week column, and 15rem does
                      // not fit in a seventh. The cap keeps it from sprawling
                      // when there is room.
                      "mb-3 px-4 py-4 lg:w-1/3 lg:max-w-60"
                    : "mb-4 px-5 py-10 lg:w-72"
                }`}
              >
                <p className={`${preview ? "truncate text-[9px]" : "text-xs"} font-black uppercase tracking-[0.08em] text-[#516071]`}>
                  {event.category}
                </p>
                <h3
                  className={`font-black leading-tight text-[#17202a] ${preview ? "mt-1 line-clamp-4 text-[9px] wrap-break-word" : embedded ? "mt-1 text-xl" : "mt-5 text-3xl"}`}
                  id={asideTitleId}
                >
                  {event.clientName ?? event.title}
                </h3>
                <p
                  className={`font-black text-[#17202a] ${preview ? "mt-1 text-[10px]" : embedded ? "mt-1 text-sm" : "mt-3 text-lg"}`}
                >
                  {sheet?.counts.couples
                    ? `${sheet.counts.couples} couples`
                    : `${event.totalGuests} portions`}
                </p>
                <p
                  className={`${preview ? "truncate text-[9px]" : "text-xs"} font-black uppercase tracking-[0.08em] text-[#6a7483] ${embedded ? "mt-2" : "mt-6"}`}
                >
                  {event.eventType ??
                    `${mealLabel(sheet?.meal ?? "Main")} meal`}
                </p>
                <p className="hidden mt-2 text-xs font-bold text-[#6a7483]">
                  Serves {formatServeTime(event.startsAt)}
                </p>

                {/*
                Cancel, not delete. The booking leaves the board and the
                calendar and everything it carries stays - menu, counts,
                invoices, activity - which is what makes it safe to offer on an
                event that has already happened and may already be invoiced.
                The wording on the button is the client's; the dialog behind it
                is where the distinction is spelled out.
              */}
                {onRemoveEvent ? (
                  <button
                    className={`rounded-lg border border-[#efb5ad] bg-white font-black text-[#c3291b] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-45 ${preview ? "absolute inset-x-2 bottom-2 h-5 truncate px-1 text-[8px]" : embedded ? "mt-3 h-8 px-4 text-xs" : "mt-8 h-9 px-4 text-xs"}`}
                    disabled={isSaving}
                    onClick={() => setIsConfirmingCancel(true)}
                    type="button"
                  >
                    Delete Event
                  </button>
                ) : null}
              </aside>

              {/*
                The other half of the row: everything that is not the aside.

                A container, so the dish grid counts columns against the space
                it actually has instead of against the window. The same panel
                is drawn at the full width of the board and at a seventh of it
                in a week column - a viewport breakpoint says "wide screen" in
                both, and would put five columns of dishes in 7rem.
              */}
              <div className="@container min-w-0 lg:flex-1">
                <div
                  className={`hidden mb-3 min-h-10 flex-wrap items-center justify-center gap-2 px-4 text-center text-sm font-black uppercase tracking-wide text-white ${
                    hold ? "bg-[#d88a00]" : "bg-[#1f4d73]"
                  }`}
                >
                  {event.past ? <span>Past event</span> : null}
                  {event.past ? (
                    <span className="text-white/70" aria-hidden="true">
                      •
                    </span>
                  ) : null}
                  <span>
                    {event.status ??
                      (hold ? "On hold - not confirmed" : "Kitchen")}
                  </span>
                  <span className="text-white/70" aria-hidden="true">
                    •
                  </span>
                  <span>{event.menuStatus}</span>
                </div>

                {/*
              `min-h-full`, not `h-full`. The panel sits in a row stretched to
              the aside's height, and `overflow-hidden` is here to keep the
              border square around its contents - so pinning it to exactly the
              row height clipped whatever sat past it. On an event whose dish
              list is shorter than the aside that meant the Add-ons section and
              the footer were cut off the bottom. A minimum fills the row when
              there is little to show and gets out of the way when there is more.
            */}
                <div className="min-h-full overflow-hidden border border-[#c8daf2] bg-[#dceaff]">
                  <div className="hidden grid-cols-1 gap-3 border-b border-[#d8dde5] bg-white p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4">
                    <StatTile
                      label="Serves"
                      note={
                        event.startsAt
                          ? "Event start time"
                          : "No start time set"
                      }
                      tone="blue"
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

                  {summary ? (
                    <div className="hidden border-b border-[#d8dde5] bg-[#fbfcfd] p-3 sm:p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                          Dish workflow
                        </h3>
                        <p className="text-xs font-semibold text-[#64748b]">
                          Tap a dish card to move it forward
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <WorkflowStep
                          label="Not started"
                          tone="none"
                          value={summary.notStarted}
                        />
                        <WorkflowStep
                          label="Pending / In prep"
                          tone="pending"
                          value={summary.pending}
                        />
                        <WorkflowStep
                          label="Complete / Ready"
                          tone="complete"
                          value={summary.complete}
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* Before the counting problems, because this one is about work
                  that is not on this sheet at all: every number above is the
                  Main meal, and the tiles give no hint that there is more. */}
                  {otherMeals.length > 0 ? (
                    <p
                      className="hidden border-b border-[#f0d9a8] bg-[#fdf8ec] px-3 py-2.5 text-xs leading-5 text-[#8a6414] sm:px-4"
                      role="status"
                    >
                      {formatOtherMeals(otherMeals)}{" "}
                      {otherMeals.length === 1 ? "is" : "are"} not shown here.
                      This sheet is the {mealLabel(sheet?.meal ?? "Main")} meal
                      only.
                    </p>
                  ) : null}

                  {summary && summary.needsAttention > 0 ? (
                    <p
                      className="hidden border-b border-[#f0d9a8] bg-[#fdf8ec] px-3 py-2.5 text-xs leading-5 text-[#8a6414] sm:px-4"
                      role="status"
                    >
                      {summary.needsAttention} dish
                      {summary.needsAttention === 1 ? "" : "es"} cannot be
                      counted yet.
                      {summary.unresolvedBases.includes("Tables")
                        ? " Draw the dining plan so per-table rules have a table count."
                        : " Set a service style on the Menu tab, or a counting rule in the menu library."}
                    </p>
                  ) : null}

                  {!hasSheet ? (
                    <div className="p-4">
                      <AsyncState
                        emptyMessage="This kitchen event does not have any dishes to track yet."
                        emptyTitle="No production sheet"
                        isEmpty
                      />
                    </div>
                  ) : !sheet &&
                    (kitchenQuery.isLoading || kitchenQuery.error) ? (
                    <div className="p-4">
                      <AsyncState
                        error={kitchenQuery.error}
                        isLoading={kitchenQuery.isLoading}
                        onRetry={() => void kitchenQuery.refetch()}
                      />
                    </div>
                  ) : allDishes.length === 0 ? (
                    <div className="p-4">
                      <div className="border border-dashed border-[#cbd5e1] bg-[#fbfcfd] px-4 py-9 text-center">
                        <p className="text-sm font-black text-[#111827]">
                          {workersOnly
                            ? "No assigned dishes on this menu yet"
                            : "No dishes on this menu yet"}
                        </p>
                        <p className="mt-3 text-xs text-[#64748b]">
                          {workersOnly
                            ? "Assign a worker to a dish to make it appear in this filtered view."
                            : "Add dishes on the event’s Menu tab and this sheet fills in with what to cook."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="hidden border-b border-[#d8dde5] bg-[#fbfcfd] px-3 py-3 sm:px-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                              Worker ownership
                            </h3>
                            <p className="mt-1 text-xs text-[#64748b]">
                              {assignedToMeCount} assigned to me ·{" "}
                              {unassignedCount} unassigned · {allDishes.length}{" "}
                              total dishes
                            </p>
                          </div>
                          <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-3 lg:flex lg:flex-wrap">
                            {[
                              { id: "all", label: "All dishes" },
                              {
                                id: "mine",
                                label: currentWorkerId
                                  ? "My assigned"
                                  : "Assigned dishes"
                              },
                              { id: "unassigned", label: "Unassigned" }
                            ].map((item) => (
                              <button
                                className={`h-9 border px-3 text-xs font-black transition ${
                                  assignmentFilter === item.id
                                    ? "border-[#1f4d73] bg-[#1f4d73] text-white"
                                    : "border-[#b9c2cf] bg-white text-[#17202a] hover:bg-[#eef4fa]"
                                }`}
                                key={item.id}
                                onClick={() =>
                                  setAssignmentFilter(
                                    item.id as AssignmentFilter
                                  )
                                }
                                type="button"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {visibleDishes.length === 0 ? (
                        <div className="p-4">
                          <div className="border border-dashed border-[#cbd5e1] bg-[#fbfcfd] px-4 py-9 text-center">
                            <p className="text-sm font-black text-[#111827]">
                              No dishes in this filter
                            </p>
                            <p className="mt-3 text-xs text-[#64748b]">
                              Choose another ownership filter or assign workers
                              to the dish cards below.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`bg-[#dceaff] ${embedded ? "space-y-3 p-3" : "space-y-5 p-3 sm:p-4"}`}
                        >
                          {/*
                        Plated first, then buffet, then anything with no style -
                        the order `dishSections` is built in. The headings are
                        shown rather than screen-reader-only because the two are
                        cooked and served differently, and a single unbroken
                        grid left a cook to work out which half was which.
                      */}
                          {dishSections.map((section) => (
                            <section
                              aria-labelledby={`kitchen-${event.id}-${section.id}`}
                              key={section.id}
                            >
                              <h3
                                className={`border-b border-[#c8daf2] font-black uppercase tracking-[0.08em] text-[#516071] ${preview ? "mb-1 pb-1 text-[9px]" : embedded ? "mb-2 pb-1.5 text-[11px]" : "mb-2.5 pb-2 text-[11px]"}`}
                                id={`kitchen-${event.id}-${section.id}`}
                              >
                                {section.label}
                              </h3>
                              <div className={preview ? "flex w-max gap-2.5" : "grid grid-cols-1 gap-2.5 @xs:grid-cols-2 @lg:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5"}>
                                {section.dishes.map((line) => (
                                  <DishCard
                                    canReplace={!isStandalone}
                                    compact={embedded}
                                    isSaving={isSaving}
                                    key={line.id}
                                    line={line}
                                    onReplace={(replacing) =>
                                      setReplaceLineId(replacing.id)
                                    }
                                    onSaveItemAction={saveForEvent}
                                    permissions={permissions}
                                    preview={preview}
                                    workers={workers}
                                  />
                                ))}
                              </div>
                            </section>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {addOns.length > 0 ? (
                    <section className="border-t border-[#c8daf2] bg-[#dceaff] px-3 py-3 sm:px-4">
                      <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
                        Add-ons
                      </h3>
                      {/* Statusless on purpose: KitchenItemStatus is keyed by menu
                    item, so an add-on line has nowhere to record one. */}
                      <ul className={preview ? "mt-2 flex w-max gap-2.5" : "mt-2 grid grid-cols-1 gap-2.5 @xs:grid-cols-2 @lg:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5"}>
                        {addOns.map((line) => (
                          <li className="min-w-0" key={line.id}>
                            <DishCard
                              canReplace={!isStandalone}
                              compact={embedded}
                              isSaving={isSaving}
                              line={line}
                              onReplace={(replacing) =>
                                setReplaceLineId(replacing.id)
                              }
                              onSaveItemAction={saveForEvent}
                              permissions={permissions}
                              preview={preview}
                              workers={workers}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <footer className="hidden border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3 text-xs leading-5 text-[#64748b]">
                    {permissions.canUpdateKitchenStatus ? (
                      <p>
                        Click a dish to move it on — not started, then pending,
                        then complete. Double-click to put it back to not
                        started.
                      </p>
                    ) : null}
                    <p
                      className={
                        permissions.canUpdateKitchenStatus ? "mt-1" : ""
                      }
                    >
                      Quantities come from the counting rules on the
                      event&rsquo;s Menu tab.
                      {permissions.canUpdateKitchenStatus
                        ? " Replace swaps one dish for another on that same menu, so the change reaches everyone reading it. Adding and removing dishes is still done there."
                        : " That tab is also where dishes are added and removed."}
                    </p>
                  </footer>
                </div>
              </div>
            </div>
          </div>
      </section>

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

      {/*
        Says what actually happens, because the button says "Delete". Somebody
        reading it has to be able to tell that the records survive - and that
        the cancellation itself does not come back.
      */}
      <ConfirmDialog
        confirmLabel={
          isStandalone ? "Delete this kitchen event" : "Cancel this event"
        }
        description={
          isStandalone
            ? `Delete “${event.title}”? A kitchen event belongs to no booking, so this removes it outright, along with any progress recorded against its dishes. It cannot be undone.`
            : `Cancel “${event.clientName ?? event.title}”? It leaves the kitchen board and the calendar, and everything it holds stays in the system - menu, guest counts, invoices and history. Cancelling cannot be undone from here.`
        }
        fallbackErrorMessage={
          isStandalone
            ? "The kitchen event could not be deleted. Please try again."
            : "The event could not be cancelled. Please try again."
        }
        onClose={() => setIsConfirmingCancel(false)}
        onConfirm={async () => {
          await onRemoveEvent?.();
          setIsConfirmingCancel(false);
          onClose();
        }}
        open={isConfirmingCancel}
        pendingLabel={isStandalone ? "Deleting…" : "Cancelling…"}
        title={
          isStandalone ? "Delete this kitchen event?" : "Cancel this event?"
        }
      />
    </>
  );

  if (embedded) return body;

  return (
    <div
      className="dashboard-drawer-backdrop fixed inset-0 z-100 flex items-center justify-center bg-[#07162d]/45 p-3 backdrop-blur-sm"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.currentTarget === mouseEvent.target) onClose();
      }}
    >
      {body}
    </div>
  );
}

/**
 * One event's production, drawn where it sits on the board.
 *
 * No backdrop, no close button and no modal role: this is the page rather than
 * something over it, so a cook reads the day's dishes without opening anything.
 */
export function KitchenEventPanel(props: DetailsProps) {
  return <KitchenEventDetails {...props} inline key={props.event.id} />;
}

/**
 * The week keeps every preview inside one day column. Its production panel is
 * deliberately wider than that column and clipped by this frame, matching a
 * paper schedule continuing behind the next day; the full popup is the place
 * to see and operate on every item.
 */
export function KitchenEventPreview({
  onOpen,
  ...props
}: DetailsProps & { onOpen: () => void }) {
  return (
    <div className="relative h-36 w-full overflow-hidden bg-[#dceaff]">
      <div aria-hidden="true" className="min-w-150 pointer-events-none" inert>
        <KitchenEventDetails {...props} preview key={props.event.id} />
      </div>
      <button
        aria-label={`Open ${props.event.clientName ?? props.event.title} kitchen event`}
        className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1f4d73]"
        onClick={onOpen}
        type="button"
      />
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
