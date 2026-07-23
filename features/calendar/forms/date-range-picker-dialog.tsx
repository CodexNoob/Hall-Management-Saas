"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  buildMonthGrid,
  startOfDay,
  startOfMonth
} from "@/lib/dates/calendar-date";

export type DateRange = {
  startDate: Date;
  endDate: Date;
};

type DateRangePickerDialogProps = {
  endDate: Date;
  isOpen: boolean;
  mobileCentered?: boolean;
  onApply: (range: DateRange) => void;
  onClose: () => void;
  startDate: Date;
};

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric"
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric"
});

export function DateRangePickerDialog({
  endDate,
  isOpen,
  mobileCentered = false,
  onApply,
  onClose,
  startDate
}: DateRangePickerDialogProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(startDate)
  );
  const [draftStartDate, setDraftStartDate] = useState<Date | null>(
    startOfDay(startDate)
  );
  const [draftEndDate, setDraftEndDate] = useState<Date | null>(
    startOfDay(endDate)
  );
  const [selectionStep, setSelectionStep] = useState<"start" | "end">(
    "start"
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setVisibleMonth(startOfMonth(startDate));
    setDraftStartDate(startOfDay(startDate));
    setDraftEndDate(startOfDay(endDate));
    setSelectionStep("start");

    const handlePointerDown = (event: PointerEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        onCloseRef.current();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [endDate, isOpen, startDate]);

  const calendarDays = useMemo(
    () => buildMonthGrid(visibleMonth),
    [visibleMonth]
  );

  if (!isOpen) {
    return null;
  }

  const draftStartTime = draftStartDate?.getTime() ?? null;
  const draftEndTime = draftEndDate?.getTime() ?? null;

  function selectDate(date: Date) {
    const selectedDate = startOfDay(date);

    if (selectionStep === "start" || !draftStartDate) {
      setDraftStartDate(selectedDate);
      setDraftEndDate(null);
      setSelectionStep("end");
      return;
    }

    if (selectedDate < draftStartDate) {
      setDraftStartDate(selectedDate);
      setDraftEndDate(null);
      setSelectionStep("end");
      return;
    }

    setDraftEndDate(selectedDate);
    setSelectionStep("start");
    onApply({
      startDate: draftStartDate,
      endDate: selectedDate
    });
  }

  return (
    <div
      aria-label="Select date range"
      className={`absolute top-[calc(100%+0.5rem)] z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-[#cfd8e3] bg-white p-3 shadow-xl ${
        mobileCentered
          ? "left-1/2 -translate-x-1/2 lg:left-auto lg:right-0 lg:translate-x-0"
          : "right-0"
      }`}
      ref={pickerRef}
      role="dialog"
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <button
          className="h-8 rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-black transition hover:bg-[#eef4fa]"
          onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
          type="button"
        >
          Previous
        </button>

        <strong className="text-center text-sm text-[#17202a]">
          {monthFormatter.format(visibleMonth)}
        </strong>

        <button
          className="h-8 rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-black transition hover:bg-[#eef4fa]"
          onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
          type="button"
        >
          Next
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <span
            className="py-1 text-center text-[10px] font-black uppercase text-[#6a7483]"
            key={day}
          >
            {day}
          </span>
        ))}

        {calendarDays.map((calendarDay) => {
          const dayTime = calendarDay.date.getTime();
          const isStartDate = dayTime === draftStartTime;
          const isEndDate = dayTime === draftEndTime;
          const isInRange =
            draftStartTime !== null &&
            draftEndTime !== null &&
            dayTime > draftStartTime &&
            dayTime < draftEndTime;

          return (
            <button
              aria-label={`Select ${fullDateFormatter.format(calendarDay.date)}`}
              aria-pressed={isStartDate || isEndDate}
              className={`h-8 rounded-lg text-sm font-black transition ${
                isStartDate || isEndDate
                  ? "bg-[#1f4d73] text-white"
                  : isInRange
                    ? "bg-[#dcecf8] text-[#15344f]"
                    : calendarDay.currentMonth
                      ? "text-[#17202a] hover:bg-[#eef4fa]"
                      : "bg-[#f8fafc] text-[#a1acb9] hover:bg-[#f4f6f8]"
              }`}
              key={calendarDay.dateKey}
              onClick={() => selectDate(calendarDay.date)}
              type="button"
            >
              {calendarDay.day}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-[#617086]">
        {selectionStep === "start"
          ? "Select the start date."
          : "Select the end date."}
      </p>
    </div>
  );
}
