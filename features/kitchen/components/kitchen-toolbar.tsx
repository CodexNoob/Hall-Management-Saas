"use client";

import { LineIcon } from "@/features/events/components/event-manager-shared";

export function KitchenToolbar({
  canAddKitchenEvent,
  canManageWorkers,
  onAddKitchenEvent,
  onManageWorkers,
  workersOnly,
  onWorkersOnlyChange,
  showWorkersOnly = true
}: {
  canAddKitchenEvent: boolean;
  canManageWorkers: boolean;
  onAddKitchenEvent: () => void;
  onManageWorkers: () => void;
  workersOnly: boolean;
  onWorkersOnlyChange: (checked: boolean) => void;
  /**
   * False for a cook the server already scoped to their own dishes.
   *
   * The filter is a personal view control, not a policy - it narrows the board
   * of whoever ticks it and changes nothing for anybody else. For a scoped cook
   * there is nothing left to narrow, so offering it would suggest they are
   * choosing a restriction that was in fact decided for them.
   */
  showWorkersOnly?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 border border-dashed border-[#eef0f3] bg-white/95 p-3">
      <button
        className="inline-flex h-10 grow items-center justify-start gap-2 border-0 bg-transparent px-2 text-base font-black text-[#637085] transition enabled:hover:text-[#061126] disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!canAddKitchenEvent}
        onClick={onAddKitchenEvent}
        type="button"
      >
        <LineIcon className="h-4 w-4" name="plus" />
        Add kitchen event
      </button>

      {/* Beside the board rather than under Staff: these are names on a
          production list, not members with logins and permissions, and the
          control that consumes them is one click away inside an event. */}
      {canManageWorkers ? (
        <button
          className="inline-flex h-10 grow items-center justify-center gap-2 border border-[#d8dde5] bg-white px-3 text-sm font-black text-[#061126] transition hover:bg-[#f7f7f7] sm:grow-0"
          onClick={onManageWorkers}
          type="button"
        >
          <LineIcon className="h-4 w-4" name="user" />
          Manage workers
        </button>
      ) : null}

      {showWorkersOnly ? (
        <label
          className="inline-flex h-10 w-full cursor-pointer items-center gap-2.5 border border-[#d8dde5] bg-white px-3 text-xs font-black text-[#061126] transition hover:bg-[#f7f7f7] sm:ml-auto sm:w-auto"
          htmlFor="workers-assigned-only"
        >
          <input
            className="h-4 w-4 shrink-0 rounded accent-[#1f4d73]"
            checked={workersOnly}
            id="workers-assigned-only"
            name="workersAssignedOnly"
            onChange={(event) => onWorkersOnlyChange(event.target.checked)}
            type="checkbox"
          />

          <span className="leading-tight">Show only my assigned items</span>
        </label>
      ) : null}
    </div>
  );
}
