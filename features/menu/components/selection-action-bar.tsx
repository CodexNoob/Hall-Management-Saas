"use client";

import {
  LineIcon,
  type IconName
} from "@/features/menu/components/menu-shared";

type SelectionActionBarProps = {
  /** Verb only - the count and the noun are appended here. */
  actionLabel: string;
  /** Word for one of the things being counted, pluralised with a bare "s". */
  countLabel?: string;
  icon: IconName;
  isBusy?: boolean;
  isDisabled?: boolean;
  onAct: () => void;
  onClear: () => void;
  selectedCount: number;
  /** Danger red for the verb that takes things away. */
  tone?: "primary" | "danger";
};

/**
 * What the current selection can be done to, floating over the page.
 *
 * Fixed to the viewport rather than sticky inside the panel, because sticky
 * would not work here: both halves of the panel sit in `overflow-hidden`
 * sections, which are scroll containers even though nothing scrolls them, so a
 * sticky child resolves against a box that never moves and simply sits at the
 * bottom of its own section. Fixed is also the honest shape for this - the
 * selection belongs to the panel as a whole, not to whichever grid is on screen.
 *
 * One bar, never two, because the panel allows one grid to hold a selection at a
 * time. Two bars offering opposite verbs would leave the reader to work out
 * which of them the next tap belongs to.
 *
 * Absent until something is ticked. A permanently docked bar reading "0
 * selected" spends a row of the screen saying nothing.
 */
export function SelectionActionBar({
  actionLabel,
  countLabel = "item",
  icon,
  isBusy = false,
  isDisabled = false,
  onAct,
  onClear,
  selectedCount,
  tone = "primary"
}: SelectionActionBarProps) {
  if (selectedCount === 0) return null;

  const noun = selectedCount === 1 ? countLabel : `${countLabel}s`;

  return (
    // The outer strip lets clicks through so it does not swallow taps on the
    // cards either side of the pill.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3">
      <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-xl border border-[#d8dde5] bg-white px-3 py-2 shadow-lg shadow-[#17202a]/10">
        {/* Read out but not drawn on a phone, where the sidebar's avatar
            button floats in the bottom-left corner and would sit on top of it.
            Nothing is lost by hiding it there: the action beside it already
            names the same count. */}
        <p
          aria-live="polite"
          className="sr-only shrink-0 text-xs font-black text-[#17202a] sm:not-sr-only"
        >
          {selectedCount} selected
        </p>
        <button
          className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          onClick={onClear}
          type="button"
        >
          Clear
        </button>
        <button
          className={`inline-flex h-9 min-w-0 shrink items-center gap-1.5 rounded-lg px-3 text-xs font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
            tone === "danger"
              ? "bg-[#a62b24] hover:bg-[#84221c]"
              : "bg-[#1f4d73] hover:bg-[#15344f]"
          }`}
          disabled={isDisabled || isBusy}
          onClick={onAct}
          type="button"
        >
          <LineIcon name={icon} className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {isBusy ? "Saving…" : `${actionLabel} ${selectedCount} ${noun}`}
          </span>
        </button>
      </div>
    </div>
  );
}
