"use client";

import { LineIcon } from "@/features/events/components/event-manager-shared";

export function KitchenToolbar({
  canAddKitchenEvent,
  canManageWorkers,
  onAddKitchenEvent,
  onManageWorkers,
  workersOnly,
  onWorkersOnlyChange
}: {
  canAddKitchenEvent: boolean;
  canManageWorkers: boolean;
  onAddKitchenEvent: () => void;
  onManageWorkers: () => void;
  workersOnly: boolean;
  onWorkersOnlyChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {/* The board's one primary action, and drawn as one. It used to be a
          full-width dashed placeholder box - the shape this product uses for
          "nothing here yet", which is the opposite of what it does. */}
      <button
        className="inline-flex h-11 grow items-center justify-center gap-2 rounded-xl bg-[#1f4d73] px-4 text-sm font-bold text-white shadow-sm transition enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45 sm:grow-0 sm:justify-start"
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
          className="inline-flex h-11 grow items-center justify-center gap-2 rounded-xl border border-[#b9c2cf] bg-white px-4 text-sm font-bold text-[#17202a] transition hover:border-[#1f4d73] hover:bg-[#eef4fa] sm:grow-0 sm:justify-start"
          onClick={onManageWorkers}
          type="button"
        >
          <LineIcon className="h-4 w-4 text-[#1f4d73]" name="user" />
          Manage workers
        </button>
      ) : null}

      <label
        className="inline-flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[#b9c2cf] bg-white px-3.5 text-xs font-bold text-[#17202a] transition hover:border-[#1f4d73] hover:bg-[#eef4fa] sm:ml-auto sm:w-auto"
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

        <span className="leading-tight">Workers see assigned items only</span>
      </label>
    </div>
  );
}
