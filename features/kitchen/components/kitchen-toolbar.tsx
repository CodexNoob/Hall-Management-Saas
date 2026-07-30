"use client";



export function KitchenToolbar({
  onAddKitchenEvent,
  workersOnly,
  onWorkersOnlyChange
}: {
  onAddKitchenEvent: () => void;
  workersOnly: boolean;
  onWorkersOnlyChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_222px]">
      <button
        className="h-12 border border-dashed border-[#c4ccd5] bg-white px-6 text-left text-sm font-black text-[#64748b] hover:border-[#007dbb]"
        onClick={onAddKitchenEvent}
        type="button"
      >
        + Add Kitchen Event
      </button>

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
