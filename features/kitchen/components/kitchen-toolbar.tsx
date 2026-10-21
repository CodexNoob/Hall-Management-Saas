"use client";

import { LineIcon } from "@/features/events/components/event-manager-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export function KitchenToolbar({
  canAddKitchenEvent,
  canManageWorkers,
  freshnessLabel = "",
  isRefreshing = false,
  onAddKitchenEvent,
  onManageWorkers,
  onRefresh,
  workersOnly,
  onWorkersOnlyChange,
  showWorkersOnly = true
}: {
  canAddKitchenEvent: boolean;
  canManageWorkers: boolean;
  /**
   * When the board on screen was last read from the server, already worded.
   *
   * A board on a kitchen wall is trusted the way a clock is: nobody checks
   * whether it is still running. Saying when it last spoke to the server turns
   * "nothing has changed" into "nothing has changed as of 6:04:12".
   */
  freshnessLabel?: string;
  isRefreshing?: boolean;
  onAddKitchenEvent: () => void;
  onManageWorkers: () => void;
  /** Absent when the caller has nothing to refresh, which hides the control. */
  onRefresh?: () => void;
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
  const { t } = useAppLanguage();
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 border border-dashed border-[#eef0f3] bg-white/95 p-3">
      <button
        className="inline-flex h-10 grow items-center justify-start gap-2 border-0 bg-transparent px-2 text-base font-black text-[#637085] transition enabled:hover:text-[#061126] disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!canAddKitchenEvent}
        onClick={onAddKitchenEvent}
        type="button"
      >
        <LineIcon className="h-4 w-4" name="plus" />
        {t("kitchen.addEvent")}
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
          {t("kitchen.manageWorkers")}
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

          <span className="leading-tight">{t("kitchen.onlyAssigned")}</span>
        </label>
      ) : null}

      {/* Last, and small. This is a status line with a control attached, not a
          feature of the board - it earns its place by being readable without
          being looked for. Same 40px row, border and type scale as the controls
          beside it, so it reads as another item in this bar rather than a new
          piece of chrome. */}
      {onRefresh ? (
        <div className="inline-flex h-10 w-full items-center justify-between gap-2 border border-[#d8dde5] bg-white px-3 text-xs font-black text-[#061126] sm:w-auto">
          <span className="truncate text-[#637085]" role="status">
            {isRefreshing ? t("kitchen.refreshing") : freshnessLabel}
          </span>
          <button
            aria-label={t("kitchen.refresh")}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-[#d8dde5] bg-white text-[#061126] transition hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={isRefreshing}
            onClick={onRefresh}
            type="button"
          >
            <LineIcon className="h-3.5 w-3.5" name="refresh" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
