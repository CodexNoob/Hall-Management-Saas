"use client";

import { useState } from "react";
import {
  DateRangePickerDialog,
  type DateRange
} from "@/features/calendar/forms/date-range-picker-dialog";
import {
  BuildingIcon,
  StatusDot,
  type AvailabilityDay
} from "@/features/calendar/components/calendar-shared";
import { AvailabilityDaysSkeleton } from "@/features/calendar/components/calendar-skeleton";
import { type WeekStartsOn } from "@/lib/dates/calendar-date";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export function AvailabilityView({
  canManageBlockedDates,
  blockDateError,
  days,
  endDate,
  endDateLabel,
  halls,
  isLoadingDays = false,
  onHallChange,
  onNewBooking,
  onRemoveDay,
  onRangeChange,
  selectedHallId,
  showHebrewDate = true,
  startDate,
  startDateLabel,
  weekStartsOn
}: {
  canManageBlockedDates: boolean;
  blockDateError: string | null;
  /** Already scoped to `selectedHallId`, and empty until one is picked. */
  days: AvailabilityDay[];
  endDate: Date;
  endDateLabel: string;
  halls: Array<{ id: string; name: string }>;
  /**
   * A newly picked range whose bookings are still on the way. The rows below
   * become placeholders while the header - the hall select, the range picker -
   * stays live, so a range chosen by mistake can be changed straight away.
   */
  isLoadingDays?: boolean;
  onHallChange: (hallId: string) => void;
  onNewBooking?: () => void;
  onRemoveDay: (dateKey: string) => void | Promise<void>;
  onRangeChange: (range: DateRange) => void;
  /** "" until the reader chooses one, which is what gates the list below. */
  selectedHallId: string;
  /** Settings > Calendar > Show Hebrew dates, which covers the whole tab. */
  showHebrewDate?: boolean;
  startDate: Date;
  startDateLabel: string;
  weekStartsOn?: WeekStartsOn;
}) {
  const { t } = useAppLanguage();
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
  const selectedHall = halls.find((hall) => hall.id === selectedHallId);

  return (
    <section className="dashboard-panel-enter mx-auto max-w-[1800px] overflow-visible rounded-xl border border-[#d8dde5] bg-white">
      <header className="flex flex-col gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BuildingIcon />
            <h1 className="text-sm font-black">{t("calendar.availability")}</h1>
          </div>
          <p className="mt-1 text-xs text-[#6a7483]">
            {t("calendar.availabilityHint")}
          </p>
        </div>

        {onNewBooking ? (
          <button
            className="h-9 shrink-0 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white transition hover:bg-[#15344f]"
            onClick={onNewBooking}
            type="button"
          >
            {t("common.newBooking")}
          </button>
        ) : null}
      </header>

      <div className="p-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-black">{t("calendar.availabilityRange")}</h2>
            <p className="text-xs font-bold text-[#617086]">
              {selectedHall ? `${selectedHall.name} · ` : ""}
              {startDateLabel} to {endDateLabel}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[180px_156px_156px_auto]">
            <label className="rounded-xl border border-[#b9c2cf] bg-white px-3 py-2">
              <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">
                {t("calendar.hall")}
              </span>
              <select
                className="mt-1 h-6 w-full min-w-0 border-0 bg-transparent p-0 text-sm font-bold text-[#17202a] outline-none"
                onChange={(event) => onHallChange(event.target.value)}
                value={selectedHallId}
              >
                <option value="">{t("calendar.selectHall")}</option>
                {halls.map((hall) => (
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
              <strong className="mt-1 block text-sm">{startDateLabel}</strong>
            </div>
            <div className="rounded-xl border border-[#d8dde5] bg-white px-3 py-2">
              <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">
                {t("calendar.endDate")}
              </span>
              <strong className="mt-1 block text-sm">{endDateLabel}</strong>
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
                endDate={endDate}
                isOpen={isRangePickerOpen}
                mobileCentered
                onApply={onRangeChange}
                onClose={() => setIsRangePickerOpen(false)}
                startDate={startDate}
                weekStartsOn={weekStartsOn}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <StatusDot color="bg-[#178151]" label={t("calendar.available")} />
          <StatusDot color="bg-[#b66b00]" label={t("calendar.hold")} />
          <StatusDot color="bg-[#94a1b1]" label={t("calendar.full")} />
        </div>

        {isLoadingDays && selectedHallId ? <AvailabilityDaysSkeleton /> : null}

        {!selectedHallId ? (
          <div className="mt-3 rounded-xl border border-dashed border-[#c7d0dc] bg-[#fbfcfd] p-8 text-center">
            <p className="text-sm font-black text-[#17202a]">
              {halls.length === 0
                ? t("calendar.noBookableHallsYet")
                : t("calendar.chooseHallToSee")}
            </p>
            <p className="mt-2 text-xs text-[#6a7483]">
              {halls.length === 0
                ? t("calendar.addHallInSettings")
                : t("calendar.everyCountBelongsToHall")}
            </p>
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {(isLoadingDays ? [] : days).map((availabilityDay) => {
            const isHold = availabilityDay.status === "hold";
            const isFull = availabilityDay.status === "full";
            return (
              <article
                className="dashboard-hover-card flex min-h-16 flex-col justify-center gap-3 rounded-xl border border-[#d8dde5] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                key={availabilityDay.dateKey}
              >
                <div>
                  <h3 className="text-sm font-black">
                    {availabilityDay.dateLabel}
                  </h3>
                  {showHebrewDate ? (
                    <p className="mt-1 text-xs text-[#617086]" dir="rtl">
                      {availabilityDay.hebrewDate}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                  <span className="text-xs text-[#617086]">
                    {isHold
                      ? t("calendar.oneHoldSlotsAvailable", {
                          count: availabilityDay.roomsAvailable
                        })
                      : t("calendar.slotsAvailable", {
                          count: availabilityDay.roomsAvailable
                        })}
                  </span>
                  <span
                    className={`inline-flex min-w-22 justify-center rounded-full border px-3 py-1 text-[10px] font-black ${
                      isHold
                        ? "border-[#efcf98] bg-[#fff8ec] text-[#995700]"
                        : isFull
                          ? "border-[#d8dde5] bg-[#f4f6f9] text-[#617086]"
                          : "border-[#b9ddcf] bg-[#effbf6] text-[#087047]"
                    }`}
                  >
                    {isHold ? "Hold" : isFull ? "Full" : "Available"}
                  </span>
                  {canManageBlockedDates ? (
                    <button
                      className="h-8 rounded-lg border border-[#efb5ad] bg-white px-3 text-xs font-black text-[#c3291b] transition hover:bg-[#fff4f2]"
                      onClick={() => onRemoveDay(availabilityDay.dateKey)}
                      type="button"
                    >
                      {t("calendar.blockDate")}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
          {blockDateError ? (
            <p
              className="rounded-lg border border-[#f1c4bd] bg-[#fff5f3] px-3 py-2 text-xs font-bold text-[#b42318]"
              role="alert"
            >
              {blockDateError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
