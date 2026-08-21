"use client";

import { useEffect, useState } from "react";
import { DateRangePickerDialog, type DateRange } from "@/features/calendar/forms/date-range-picker-dialog";
import { formatHebrewDateWithoutYear } from "@/lib/dates/hebrew-date";
import { dateKey } from "@/lib/dates/calendar-date";
import { ClockIcon, SettingsIcon, initialBlockedRanges } from "@/features/calendar/components/calendar-shared";
import { LiveNumberField } from "@/components/ui/number-field";
import { countSchema } from "@/lib/validation/number";

export function CalendarSettingsView({
  dailyEventLimit,
  hallAvailability,
  isSavingDailyEventLimit,
  saveDailyEventLimitError,
  onSaveDailyEventLimit
}: {
  dailyEventLimit: number;
  hallAvailability: Array<{
    id: string;
    name: string;
    limit: number;
    used: number;
    isFull: boolean;
    usesDefaultLimit: boolean;
  }>;
  isSavingDailyEventLimit: boolean;
  saveDailyEventLimitError: string | null;
  onSaveDailyEventLimit: (limit: number) => Promise<void>;
}) {
  const [blockedRanges, setBlockedRanges] = useState(initialBlockedRanges);
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
  const [dailyEventLimitDraft, setDailyEventLimitDraft] =
    useState(dailyEventLimit);
  const [blockedRangeDraft, setBlockedRangeDraft] = useState<DateRange>(() => ({
    startDate: new Date(2026, 6, 1),
    endDate: new Date(2026, 6, 2)
  }));
  const rangeDateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const blockedStartLabel = rangeDateFormatter.format(
    blockedRangeDraft.startDate
  );
  const blockedEndLabel = rangeDateFormatter.format(blockedRangeDraft.endDate);

  useEffect(() => {
    setDailyEventLimitDraft(dailyEventLimit);
  }, [dailyEventLimit]);

  function addBlockedRange() {
    setBlockedRanges((current) => {
      const rangeId = `blocked-${dateKey(blockedRangeDraft.startDate)}-${dateKey(blockedRangeDraft.endDate)}`;
      const isSingleBlockedDay =
        dateKey(blockedRangeDraft.startDate) ===
        dateKey(blockedRangeDraft.endDate);
      if (current.some((range) => range.id === rangeId)) return current;

      return [
        {
          id: rangeId,
          startLabel: blockedStartLabel,
          endLabel: isSingleBlockedDay ? undefined : blockedEndLabel,
          hebrewLabel: isSingleBlockedDay
            ? formatHebrewDateWithoutYear(blockedRangeDraft.startDate)
            : `${formatHebrewDateWithoutYear(blockedRangeDraft.startDate)} to ${formatHebrewDateWithoutYear(blockedRangeDraft.endDate)}`
        },
        ...current
      ];
    });
  }

  function removeBlockedRange(rangeId: string) {
    setBlockedRanges((current) =>
      current.filter((range) => range.id !== rangeId)
    );
  }

  return (
    <section className="dashboard-panel-enter mx-auto max-w-[1800px] overflow-visible rounded-xl border border-[#d8dde5] bg-white">
      <header className="border-b border-[#d8dde5] p-3">
        <div className="flex items-center gap-2">
          <SettingsIcon />
          <h1 className="text-sm font-black">Calendar Settings</h1>
        </div>
        <p className="mt-1 text-xs text-[#6a7483]">
          Manage blocked date ranges.
        </p>
      </header>

      <div className="p-3">
        <div className="mb-3 overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
          <div className="border-b border-[#d8dde5] px-3 py-2">
            <h2 className="text-sm font-black">Daily event limit</h2>
            <p className="mt-1 text-xs text-[#6a7483]">
              Choose how many active events can be booked on the same date.
            </p>
          </div>
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#617086]">
                Events allowed per day
              </span>
              <LiveNumberField
                className="h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] outline-none focus:border-[#1f4d73] focus:ring-3 focus:ring-[#1f4d73]/15 sm:max-w-56"
                id="daily-event-limit"
                onCommit={setDailyEventLimitDraft}
                schema={countSchema({
                  min: 1,
                  max: 50,
                  label: "Events allowed per day"
                })}
                value={dailyEventLimitDraft}
              />
            </label>
            <button
              className="h-10 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white transition enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                isSavingDailyEventLimit ||
                dailyEventLimitDraft === dailyEventLimit
              }
              onClick={() => onSaveDailyEventLimit(dailyEventLimitDraft)}
              type="button"
            >
              {isSavingDailyEventLimit ? "Saving..." : "Save limit"}
            </button>
          </div>
          {saveDailyEventLimitError ? (
            <p className="border-t border-[#f1c4bd] bg-[#fff5f3] px-3 py-2 text-xs font-bold text-[#b42318]">
              {saveDailyEventLimitError}
            </p>
          ) : null}
        </div>

        <div className="mb-3 overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
          <div className="border-b border-[#d8dde5] px-3 py-2">
            <h2 className="text-sm font-black">Hall daily limits</h2>
            <p className="mt-1 text-xs text-[#6a7483]">
              Each saved hall uses this daily booking limit.
            </p>
          </div>

          <div className="divide-y divide-[#e5eaf0]">
            {hallAvailability.map((hall) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2"
                key={hall.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-[#17202a]">
                    {hall.name}
                  </p>
                  {hall.usesDefaultLimit ? (
                    <p className="mt-0.5 text-[9px] font-medium text-[#6a7483]">
                      Uses Calendar default
                    </p>
                  ) : null}
                </div>

                <span className="text-xs font-black tabular-nums text-[#17202a]">
                  {hall.limit} per day
                </span>
              </div>
            ))}

            {hallAvailability.length === 0 ? (
              <p className="px-3 py-4 text-xs font-medium text-[#6a7483]">
                No bookable halls are saved yet. Add halls in Settings.
              </p>
            ) : null}
          </div>
        </div>

        <div className="overflow-visible rounded-xl border border-[#d8dde5]">
          <div className="border-b border-[#d8dde5] px-3 py-2">
            <h2 className="text-sm font-black">Blocked ranges</h2>
            <p className="mt-1 text-xs text-[#6a7483]">
              Blocked ranges will not show in Availability and cannot be booked.
            </p>
          </div>

          <div className="p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-black">Add blocked range</h3>
                <p className="text-xs font-bold text-[#617086]">
                  {blockedStartLabel} to {blockedEndLabel}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[156px_156px_auto_auto]">
                <div className="rounded-xl border border-[#8fbce3] bg-[#f1f7fc] px-3 py-2">
                  <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">
                    Start date
                  </span>
                  <strong className="mt-1 block text-sm">
                    {blockedStartLabel}
                  </strong>
                </div>
                <div className="rounded-xl border border-[#d8dde5] bg-white px-3 py-2">
                  <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">
                    End date
                  </span>
                  <strong className="mt-1 block text-sm">
                    {blockedEndLabel}
                  </strong>
                </div>
                <div className="relative col-span-full flex w-full justify-end self-center lg:col-auto lg:w-auto lg:justify-self-end">
                  <button
                    className="h-9 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white transition hover:bg-[#15344f]"
                    onClick={() => setIsRangePickerOpen((current) => !current)}
                    type="button"
                  >
                    Select range
                  </button>
                  <DateRangePickerDialog
                    endDate={blockedRangeDraft.endDate}
                    isOpen={isRangePickerOpen}
                    mobileCentered
                    onApply={setBlockedRangeDraft}
                    onClose={() => setIsRangePickerOpen(false)}
                    startDate={blockedRangeDraft.startDate}
                  />
                </div>
                <button
                  className="h-9 self-center rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black transition hover:bg-[#eef4fa]"
                  onClick={addBlockedRange}
                  type="button"
                >
                  Add blocked range
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {blockedRanges.map((range) => (
                <article
                  className="flex min-h-14 flex-col gap-3 rounded-xl border border-[#d8dde5] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  key={range.id}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#bfd2e2] bg-[#f7fbff] text-[#1f4d73]">
                      <ClockIcon />
                    </span>
                    <p className="min-w-0 text-sm">
                      <strong>
                        {range.startLabel}
                        {range.endLabel ? ` to ${range.endLabel}` : ""}
                      </strong>{" "}
                      <span className="text-xs text-[#617086]" dir="rtl">
                        {range.hebrewLabel}
                      </span>
                    </p>
                  </div>

                  <button
                    className="h-8 shrink-0 rounded-lg border border-[#efb5ad] bg-white px-3 text-xs font-black text-[#c3291b] transition hover:bg-[#fff4f2]"
                    onClick={() => removeBlockedRange(range.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </article>
              ))}

              {blockedRanges.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#b9c2cf] p-6 text-center text-sm text-[#6a7483]">
                  No blocked date ranges.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
