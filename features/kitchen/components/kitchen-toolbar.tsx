"use client";

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
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_222px]">
      <button
        className="h-12 border border-dashed border-[#c4ccd5] bg-white px-6 text-left text-sm font-black text-[#64748b] hover:border-[#007dbb] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#c4ccd5]"
        disabled={!canAddKitchenEvent}
        onClick={onAddKitchenEvent}
        type="button"
      >
        + Add Kitchen Event
      </button>

      {/* Beside the board rather than under Staff: these are names on a
          production list, not members with logins and permissions, and the
          control that consumes them is one click away inside an event. */}
      {canManageWorkers ? (
        <button
          className="h-12 border border-[#d6dde5] bg-white px-5 text-sm font-black text-[#07162d] hover:border-[#007dbb] hover:bg-[#eef4fa]"
          onClick={onManageWorkers}
          type="button"
        >
          Manage workers
        </button>
      ) : null}

      <label
        className="flex min-h-12 cursor-pointer items-center justify-center gap-3 border border-[#d6dde5] bg-white px-4 text-center text-xs font-black text-[#07162d]"
        htmlFor="workers-assigned-only"
      >
        <input
          className="h-4 w-4 shrink-0 accent-[#1f4d73]"
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
