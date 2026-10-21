"use client";

import { LineIcon } from "@/features/events/components/event-manager-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

/**
 * The right-hand pane before an event has been chosen.
 *
 * It used to open whichever event sorted first, which read as a selection
 * nobody had made - and because the list defaults to its "Active" filter while
 * the first event by start time is usually long finished or expired, that
 * event's row was normally filtered out of the list entirely. So the pane showed
 * one event's data with no highlighted row anywhere to say where it came from.
 * An empty pane is the honest answer to an empty selection.
 */
export function EventWorkspaceEmpty() {
  const { t } = useAppLanguage();
  return (
    <section className="flex h-auto min-h-64 w-full min-w-0 max-w-full flex-col items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-8 text-center xl:h-full">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-[#b9c2cf] bg-white text-[#1f4d73]">
        <LineIcon name="calendar" className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-sm font-black text-[#17202a]">
        {t("events.noneSelected")}
      </h2>
      <p className="mt-2 max-w-sm text-xs text-[#6a7483]">
        {t("events.noneSelectedBody")}
      </p>
    </section>
  );
}
