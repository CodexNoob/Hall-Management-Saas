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
import { type WeekStartsOn } from "@/lib/dates/calendar-date";

export function AvailabilityView({
  canManageBlockedDates,
  blockDateError,
  days,
  endDate,
  endDateLabel,
  onNewBooking,
  onRemoveDay,
  onRangeChange,
  startDate,
  startDateLabel,
  weekStartsOn
}: {
  canManageBlockedDates: boolean;
  blockDateError: string | null;
  days: AvailabilityDay[];
  endDate: Date;
  endDateLabel: string;
  onNewBooking?: () => void;
  onRemoveDay: (dateKey: string) => void | Promise<void>;
  onRangeChange: (range: DateRange) => void;
  startDate: Date;
  startDateLabel: string;
  weekStartsOn?: WeekStartsOn;
}) {
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);

  return (
    <section className="dashboard-panel-enter mx-auto max-w-[1800px] overflow-visible rounded-xl border border-[#d8dde5] bg-white">
      <header className="flex flex-col gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BuildingIcon />
            <h1 className="text-sm font-black">Availability</h1>
          </div>
          <p className="mt-1 text-xs text-[#6a7483]">
            Open the range picker, select the start date, then select the end
            date from the same open calendar.
          </p>
        </div>

        {onNewBooking ? (
          <button
            className="h-9 shrink-0 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white transition hover:bg-[#15344f]"
            onClick={onNewBooking}
            type="button"
          >
            New booking
          </button>
        ) : null}
      </header>

      <div className="p-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-black">Availability Range</h2>
            <p className="text-xs font-bold text-[#617086]">
              {startDateLabel} to {endDateLabel}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[156px_156px_auto]">
            <div className="rounded-xl border border-[#8fbce3] bg-[#f1f7fc] px-3 py-2">
              <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">
                Start date
              </span>
              <strong className="mt-1 block text-sm">{startDateLabel}</strong>
            </div>
            <div className="rounded-xl border border-[#d8dde5] bg-white px-3 py-2">
              <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">
                End date
              </span>
              <strong className="mt-1 block text-sm">{endDateLabel}</strong>
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

        <div className="mt-3 flex gap-3">
          <StatusDot color="bg-[#178151]" label="Available" />
          <StatusDot color="bg-[#b66b00]" label="Hold" />
        </div>

        <div className="mt-3 space-y-2">
          {days.map((availabilityDay) => {
            const isHold = availabilityDay.status === "hold";
            return (
              <article
                className="dashboard-hover-card flex min-h-16 flex-col justify-center gap-3 rounded-xl border border-[#d8dde5] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                key={availabilityDay.dateKey}
              >
                <div>
                  <h3 className="text-sm font-black">
                    {availabilityDay.dateLabel}
                  </h3>
                  <p className="mt-1 text-xs text-[#617086]" dir="rtl">
                    {availabilityDay.hebrewDate}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                  <span className="text-xs text-[#617086]">
                    {isHold
                      ? `1 hold · ${availabilityDay.roomsAvailable} event slots still available`
                      : `${availabilityDay.roomsAvailable} event slots available`}
                  </span>
                  <span
                    className={`inline-flex min-w-22 justify-center rounded-full border px-3 py-1 text-[10px] font-black ${isHold ? "border-[#efcf98] bg-[#fff8ec] text-[#995700]" : "border-[#b9ddcf] bg-[#effbf6] text-[#087047]"}`}
                  >
                    {isHold ? "Hold" : "Available"}
                  </span>
                  {canManageBlockedDates ? (
                    <button
                      className="h-8 rounded-lg border border-[#efb5ad] bg-white px-3 text-xs font-black text-[#c3291b] transition hover:bg-[#fff4f2]"
                      onClick={() => onRemoveDay(availabilityDay.dateKey)}
                      type="button"
                    >
                      Block date
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
