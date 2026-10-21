"use client";

import { useEffect, useState } from "react";
import {
  DateRangePickerDialog,
  type DateRange
} from "@/features/calendar/forms/date-range-picker-dialog";
import { formatHebrewDateWithoutYear } from "@/lib/dates/hebrew-date";
import { dateKey, type WeekStartsOn } from "@/lib/dates/calendar-date";
import {
  ClockIcon,
  SettingsIcon
} from "@/features/calendar/components/calendar-shared";
import { LiveNumberField } from "@/components/ui/number-field";
import { countSchema } from "@/lib/validation/number";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export function CalendarSettingsView({
  dailyEventLimit,
  blockedDates,
  canUpdateSettings,
  blockedDateMutationError,
  hallAvailability,
  isMutatingBlockedDate,
  isSavingDailyEventLimit,
  saveDailyEventLimitError,
  onSaveDailyEventLimit,
  onAddBlockedRange,
  onRemoveBlockedRange,
  weekStartsOn
}: {
  blockedDates: Array<{
    id: string;
    hallId: string | null;
    startDate: string;
    endDate: string;
    label: string;
  }>;
  canUpdateSettings: boolean;
  blockedDateMutationError: string | null;
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
  isMutatingBlockedDate: boolean;
  saveDailyEventLimitError: string | null;
  onSaveDailyEventLimit: (limit: number) => Promise<void>;
  onAddBlockedRange: (range: DateRange, hallId: string) => Promise<void>;
  onRemoveBlockedRange: (id: string) => Promise<void>;
  weekStartsOn?: WeekStartsOn;
}) {
  const { t } = useAppLanguage();
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
  // Empty until one is chosen, which is what the Add button waits for: a range
  // closes one hall, and there is no sensible hall to guess on the reader's
  // behalf.
  const [blockedHallId, setBlockedHallId] = useState("");
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

  const blockedRanges = blockedDates.map((range) => {
    const startDate = new Date(`${range.startDate.slice(0, 10)}T00:00:00`);
    const endDate = new Date(`${range.endDate.slice(0, 10)}T00:00:00`);
    const isSingleBlockedDay = dateKey(startDate) === dateKey(endDate);
    return {
      id: range.id,
      // A range with no hall predates the column and closes the whole venue.
      // Named as such rather than left blank, so the list never implies a hall
      // it does not have.
      hallLabel:
        hallAvailability.find((hall) => hall.id === range.hallId)?.name ??
        t("calendar.allHallsOption"),
      startLabel: rangeDateFormatter.format(startDate),
      endLabel: isSingleBlockedDay
        ? undefined
        : rangeDateFormatter.format(endDate),
      hebrewLabel: isSingleBlockedDay
        ? formatHebrewDateWithoutYear(startDate)
        : `${formatHebrewDateWithoutYear(startDate)} to ${formatHebrewDateWithoutYear(endDate)}`
    };
  });

  return (
    <section className="dashboard-panel-enter mx-auto max-w-[1800px] overflow-visible rounded-xl border border-[#d8dde5] bg-white">
      <header className="border-b border-[#d8dde5] p-3">
        <div className="flex items-center gap-2">
          <SettingsIcon />
          <h1 className="text-sm font-black">{t("calendar.settingsTitle")}</h1>
        </div>
        <p className="mt-1 text-xs text-[#6a7483]">
          {t("calendar.manageBlockedRanges")}
        </p>
      </header>

      <div className="p-3">
        <div className="mb-3 overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
          <div className="border-b border-[#d8dde5] px-3 py-2">
            <h2 className="text-sm font-black">{t("calendar.dailyEventLimit")}</h2>
            <p className="mt-1 text-xs text-[#6a7483]">
              {t("calendar.dailyLimitBlurb")}
            </p>
          </div>
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#617086]">
                {t("calendar.eventsPerDay")}
              </span>
              <LiveNumberField
                className="h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] outline-none focus:border-[#1f4d73] focus:ring-3 focus:ring-[#1f4d73]/15 sm:max-w-56"
                id="daily-event-limit"
                onCommit={setDailyEventLimitDraft}
                schema={countSchema({
                  t,
                  min: 1,
                  max: 50,
                  label: t("calendar.eventsPerDay")
                })}
                value={dailyEventLimitDraft}
              />
            </label>
            <button
              className="h-10 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white transition enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                !canUpdateSettings ||
                isSavingDailyEventLimit ||
                dailyEventLimitDraft === dailyEventLimit
              }
              onClick={() => onSaveDailyEventLimit(dailyEventLimitDraft)}
              type="button"
            >
              {isSavingDailyEventLimit
                ? t("common.savingEllipsis")
                : t("calendar.saveLimit")}
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
            <h2 className="text-sm font-black">{t("calendar.hallDailyLimits")}</h2>
            <p className="mt-1 text-xs text-[#6a7483]">
              {t("calendar.hallDailyLimitsBlurb")}
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
                      {t("calendar.usesDefault")}
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
                {t("calendar.noBookableHalls")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="overflow-visible rounded-xl border border-[#d8dde5]">
          <div className="border-b border-[#d8dde5] px-3 py-2">
            <h2 className="text-sm font-black">{t("calendar.blockedRanges")}</h2>
            <p className="mt-1 text-xs text-[#6a7483]">
              {t("calendar.blockedRangesBlurb")}
            </p>
          </div>

          <div className="p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-black">{t("calendar.addBlockedRange")}</h3>
                <p className="text-xs font-bold text-[#617086]">
                  {blockedStartLabel} to {blockedEndLabel}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[180px_156px_156px_auto_auto]">
                <label className="rounded-xl border border-[#b9c2cf] bg-white px-3 py-2">
                  <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">
                    {t("calendar.hall")}
                  </span>
                  <select
                    className="mt-1 h-5 w-full min-w-0 border-0 bg-transparent p-0 text-sm font-black text-[#17202a] outline-none"
                    disabled={!canUpdateSettings}
                    onChange={(event) => setBlockedHallId(event.target.value)}
                    value={blockedHallId}
                  >
                    <option value="">{t("calendar.selectHall")}</option>
                    {hallAvailability.map((hall) => (
                      <option key={hall.id} value={hall.id}>
                        {hall.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-xl border border-[#8fbce3] bg-[#f1f7fc] px-3 py-2">
                  <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">
                    {t("calendar.startDate")}
                  </span>
                  <strong className="mt-1 block text-sm">
                    {blockedStartLabel}
                  </strong>
                </div>
                <div className="rounded-xl border border-[#d8dde5] bg-white px-3 py-2">
                  <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">
                    {t("calendar.endDate")}
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
                    {t("calendar.selectRange")}
                  </button>
                  <DateRangePickerDialog
                    endDate={blockedRangeDraft.endDate}
                    isOpen={isRangePickerOpen}
                    mobileCentered
                    onApply={setBlockedRangeDraft}
                    onClose={() => setIsRangePickerOpen(false)}
                    startDate={blockedRangeDraft.startDate}
                    weekStartsOn={weekStartsOn}
                  />
                </div>
                <button
                  className="h-9 self-center rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black transition hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={
                    !canUpdateSettings || isMutatingBlockedDate || !blockedHallId
                  }
                  onClick={() =>
                    void onAddBlockedRange(blockedRangeDraft, blockedHallId)
                  }
                  title={
                    blockedHallId
                      ? undefined
                      : t("calendar.chooseHallToClose")
                  }
                  type="button"
                >
                  {t("calendar.addBlockedRange")}
                </button>
              </div>
            </div>

            {!blockedHallId ? (
              <p className="mt-2 text-xs font-bold text-[#617086]">
                {t("calendar.blockHallHint")}
              </p>
            ) : null}

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
                      <span className="block text-xs font-bold text-[#617086]">
                        {range.hallLabel}
                      </span>
                    </p>
                  </div>

                  <button
                    className="h-8 shrink-0 rounded-lg border border-[#efb5ad] bg-white px-3 text-xs font-black text-[#c3291b] transition hover:bg-[#fff4f2]"
                    disabled={!canUpdateSettings || isMutatingBlockedDate}
                    onClick={() => void onRemoveBlockedRange(range.id)}
                    type="button"
                  >
                    {t("common.remove")}
                  </button>
                </article>
              ))}

              {blockedRanges.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#b9c2cf] p-6 text-center text-sm text-[#6a7483]">
                  {t("calendar.noBlockedRanges")}
                </p>
              ) : null}
              {blockedDateMutationError ? (
                <p
                  className="rounded-lg border border-[#f1c4bd] bg-[#fff5f3] px-3 py-2 text-xs font-bold text-[#b42318]"
                  role="alert"
                >
                  {blockedDateMutationError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
