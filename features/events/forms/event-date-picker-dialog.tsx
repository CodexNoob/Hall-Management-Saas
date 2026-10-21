"use client";

import { useEffect, useId, useMemo } from "react";
import { AsyncState } from "@/components/ui/async-state";
import { StatusDot } from "@/features/calendar/components/calendar-shared";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import {
  addDays,
  dateKey,
  dateKeyFromIso,
  startOfDay
} from "@/lib/dates/calendar-date";
import { formatHebrewDateWithoutYear } from "@/lib/dates/hebrew-date";
import {
  hallDayStatus,
  type HallDayStatus
} from "@/lib/bookings/hall-day-availability";
import { useAppLanguage } from "@/components/providers/app-language-provider";

/**
 * How far ahead the list runs. One request covers the whole window, so the
 * dialog opens once and never fetches again while it is open.
 */
const WINDOW_DAYS = 90;

/** What the daily limit counts, and what a hold is called in the database. */
const HOLD_STATUS = "TENTATIVE_HOLD";
const ACTIVE_STATUSES = new Set([HOLD_STATUS, "CONFIRMED"]);

type CalendarPayload = {
  events: Array<{
    id: string;
    eventDate: string;
    bookingStatus: string;
    hall: { id: string };
  }>;
  halls: Array<{ id: string; dailyEventLimit?: number | null }>;
  blockedDates: Array<{
    hallId: string | null;
    startDate: string;
    endDate: string;
  }>;
  calendarSettings?: { dailyEventLimit: number };
};

type PickerDay = {
  dateKey: string;
  dateLabel: string;
  hebrewDate: string;
  openSlots: number;
  status: HallDayStatus;
};

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric"
});

const statusChrome: Record<
  HallDayStatus,
  { label: string; className: string }
> = {
  available: {
    label: "Available",
    className: "border-[#b9ddcf] bg-[#effbf6] text-[#087047]"
  },
  hold: {
    label: "Hold",
    className: "border-[#efcf98] bg-[#fff8ec] text-[#995700]"
  },
  full: {
    label: "Full",
    className: "border-[#d8dde5] bg-[#f4f6f9] text-[#617086]"
  },
  blocked: {
    label: "Blocked",
    className: "border-[#efb5ad] bg-[#fff4f2] text-[#b42318]"
  }
};

/**
 * The list of days this event may be moved to, in place of a date picker.
 *
 * A native date input will happily accept a day the hall cannot take, and the
 * refusal then arrives from the server after the save. This asks the same
 * question up front and offers only the days that answer yes - the Calendar's
 * Availability tab, narrowed to one hall and to one decision.
 *
 * Days that cannot be chosen are listed rather than hidden, greyed out and
 * labelled with the reason. A picker that silently omits dates leaves the
 * reader wondering whether the day exists at all.
 */
export function EventDatePickerDialog({
  eventId,
  hallId,
  hallName,
  onClose,
  onSelect,
  open,
  selectedDate
}: {
  /** Excluded from its own day's counts, so the event never blocks itself. */
  eventId: string;
  hallId: string;
  hallName: string;
  onClose: () => void;
  onSelect: (nextDateKey: string) => void;
  open: boolean;
  selectedDate: string;
}) {
  const { t } = useAppLanguage();
  const titleId = useId();
  const today = useMemo(() => startOfDay(new Date()), []);
  const rangeUrl = `/api/calendar?startDate=${dateKey(today)}&endDate=${dateKey(
    addDays(today, WINDOW_DAYS - 1)
  )}`;
  // Nothing is fetched until the dialog is opened: every event in the manager
  // would otherwise pull a 90-day calendar the reader never asked to see.
  const calendarQuery = useAuthenticatedQuery<CalendarPayload>(rangeUrl, open);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const days = useMemo<PickerDay[]>(() => {
    const payload = calendarQuery.data;

    if (!payload) return [];

    const hall = payload.halls.find((option) => option.id === hallId);
    const dailyEventLimit =
      hall?.dailyEventLimit ?? payload.calendarSettings?.dailyEventLimit ?? 2;
    // This event's own booking is dropped: it occupies the day it is already
    // on, and counting it there would report its current date as full and
    // refuse to leave it where it is.
    const hallEvents = payload.events.filter(
      (event) => event.hall.id === hallId && event.id !== eventId
    );

    return Array.from({ length: WINDOW_DAYS }, (_, offset) => {
      const date = addDays(today, offset);
      const key = dateKey(date);
      const onThisDay = hallEvents.filter(
        (event) => dateKeyFromIso(event.eventDate) === key
      );
      const activeCount = onThisDay.filter((event) =>
        ACTIVE_STATUSES.has(event.bookingStatus)
      ).length;

      return {
        dateKey: key,
        dateLabel: dayLabelFormatter.format(date),
        hebrewDate: formatHebrewDateWithoutYear(date),
        openSlots: Math.max(0, dailyEventLimit - activeCount),
        status: hallDayStatus({
          // Only ranges closing this hall. A null hall is a legacy range that
          // closed the whole venue.
          isBlocked: payload.blockedDates.some(
            (range) =>
              (range.hallId === null || range.hallId === hallId) &&
              key >= dateKeyFromIso(range.startDate) &&
              key <= dateKeyFromIso(range.endDate)
          ),
          holdCount: onThisDay.filter(
            (event) => event.bookingStatus === HOLD_STATUS
          ).length,
          activeCount,
          dailyEventLimit
        })
      };
    });
  }, [calendarQuery.data, eventId, hallId, today]);

  if (!open) return null;

  return (
    <div
      className="dashboard-drawer-backdrop fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-2 sm:p-3"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="dashboard-panel-enter flex max-h-[calc(100dvh-16px)] w-full max-w-140 flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl sm:max-h-[calc(100dvh-24px)]"
        role="dialog"
      >
        <header className="shrink-0 border-b border-[#d8dde5] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-[#17202a]" id={titleId}>
                {t("events.moveThisEvent")}
              </h2>
              <p className="mt-1 text-xs text-[#6a7483]">
                The next {WINDOW_DAYS} days in {hallName}. A day with an event
                on hold cannot be chosen.
              </p>
            </div>

            <button
              aria-label={t("common.close")}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#b9c2cf] text-[#516071] hover:bg-[#eef4fa]"
              onClick={onClose}
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <StatusDot color="bg-[#178151]" label={t("calendar.available")} />
            <StatusDot color="bg-[#b66b00]" label={t("calendar.hold")} />
            <StatusDot color="bg-[#94a1b1]" label={t("calendar.full")} />
            <StatusDot color="bg-[#c3291b]" label={t("calendar.blocked")} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <AsyncState
            error={calendarQuery.error}
            isLoading={calendarQuery.isLoading}
            onRetry={() => void calendarQuery.refetch()}
          />

          <div className="space-y-2">
            {days.map((day) => {
              const chrome = statusChrome[day.status];
              const isOpen = day.status === "available";
              const isCurrent = day.dateKey === selectedDate;

              return (
                <button
                  aria-current={isCurrent ? "date" : undefined}
                  className={`flex min-h-16 w-full flex-col justify-center gap-3 rounded-xl border px-3 py-2 text-left transition sm:flex-row sm:items-center sm:justify-between ${
                    isOpen
                      ? "dashboard-hover-card cursor-pointer border-[#d8dde5] bg-white"
                      : "cursor-not-allowed border-[#e6eaf0] bg-[#fbfcfd] opacity-70"
                  } ${isCurrent ? "ring-2 ring-inset ring-[#1f4d73]" : ""}`}
                  disabled={!isOpen}
                  key={day.dateKey}
                  onClick={() => {
                    onSelect(day.dateKey);
                    onClose();
                  }}
                  type="button"
                >
                  <div>
                    <span className="block text-sm font-black text-[#17202a]">
                      {day.dateLabel}
                      {isCurrent ? " · current date" : ""}
                    </span>
                    <span className="mt-1 block text-xs text-[#617086]" dir="rtl">
                      {day.hebrewDate}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                    <span className="text-xs text-[#617086]">
                      {day.status === "blocked"
                        ? t("events.notBookable")
                        : t("events.slotsAvailable", {
                            count: day.openSlots
                          })}
                    </span>
                    <span
                      className={`inline-flex min-w-22 justify-center rounded-full border px-3 py-1 text-[10px] font-black ${chrome.className}`}
                    >
                      {chrome.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
