"use client";

import { useMemo, useState } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { CalendarBookingDialog } from "@/features/calendar/forms/calendar-booking-dialog";
import {
  DateRangePickerDialog,
  type DateRange
} from "@/features/calendar/forms/date-range-picker-dialog";
import { AsyncState } from "@/components/ui/async-state";
import { addDays, addMonths, buildMonthGrid, dateKey, dateKeyFromIso, startOfDay, startOfMonth } from "@/lib/dates/calendar-date";
import { formatHebrewDate } from "@/lib/dates/hebrew-date";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";

type CalendarStatus = "confirmed" | "hold" | "school";

type CalendarBooking = {
  id: string;
  dateKey: string;
  title: string;
  hall: string;
  type: string;
  packageName?: string;
  status: CalendarStatus;
};

type EventsResponse = {
  events: Array<{
    id: string;
    clientName: string;
    eventDate: string;
    eventStatus: string;
    eventType: string | null;
    packageName: string | null;
    hall: { id: string; name: string };
  }>;
  halls: Array<{ id: string; name: string }>;
  eventTypes: Array<{ id: string; name: string }>;
  packages: Array<{ id: string; name: string }>;
};

/* Legacy July fixture retained for visual-reference history.
type CalendarDay = {
  day: number;
  hebrewDate: string;
  currentMonth: boolean;
  fullyBooked?: boolean;
};

const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const calendarDays: CalendarDay[] = [
  { day: 28, hebrewDate: "13 בתמוז", currentMonth: false },
  { day: 29, hebrewDate: "14 בתמוז", currentMonth: false },
  { day: 30, hebrewDate: "15 בתמוז", currentMonth: false },
  { day: 1, hebrewDate: "16 בתמוז", currentMonth: true, fullyBooked: true },
  { day: 2, hebrewDate: "17 בתמוז", currentMonth: true },
  { day: 3, hebrewDate: "18 בתמוז", currentMonth: true },
  { day: 4, hebrewDate: "19 בתמוז", currentMonth: true, fullyBooked: true },

  { day: 5, hebrewDate: "20 בתמוז", currentMonth: true },
  { day: 6, hebrewDate: "21 בתמוז", currentMonth: true },
  { day: 7, hebrewDate: "22 בתמוז", currentMonth: true },
  { day: 8, hebrewDate: "23 בתמוז", currentMonth: true },
  { day: 9, hebrewDate: "24 בתמוז", currentMonth: true },
  { day: 10, hebrewDate: "25 בתמוז", currentMonth: true },
  { day: 11, hebrewDate: "26 בתמוז", currentMonth: true },

  { day: 12, hebrewDate: "27 בתמוז", currentMonth: true },
  { day: 13, hebrewDate: "28 בתמוז", currentMonth: true },
  { day: 14, hebrewDate: "29 בתמוז", currentMonth: true },
  { day: 15, hebrewDate: "1 באב", currentMonth: true },
  { day: 16, hebrewDate: "2 באב", currentMonth: true },
  { day: 17, hebrewDate: "3 באב", currentMonth: true },
  { day: 18, hebrewDate: "4 באב", currentMonth: true, fullyBooked: true },

  { day: 19, hebrewDate: "5 באב", currentMonth: true },
  { day: 20, hebrewDate: "6 באב", currentMonth: true },
  { day: 21, hebrewDate: "7 באב", currentMonth: true },
  { day: 22, hebrewDate: "8 באב", currentMonth: true },
  { day: 23, hebrewDate: "9 באב", currentMonth: true },
  { day: 24, hebrewDate: "10 באב", currentMonth: true },
  { day: 25, hebrewDate: "11 באב", currentMonth: true },

  { day: 26, hebrewDate: "12 באב", currentMonth: true },
  { day: 27, hebrewDate: "13 באב", currentMonth: true },
  { day: 28, hebrewDate: "14 באב", currentMonth: true },
  { day: 29, hebrewDate: "15 באב", currentMonth: true },
  { day: 30, hebrewDate: "16 באב", currentMonth: true },
  { day: 31, hebrewDate: "17 באב", currentMonth: true },
  { day: 1, hebrewDate: "18 באב", currentMonth: false }
];
*/

const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type AvailabilityDay = {
  dateKey: string;
  dateLabel: string;
  day: number;
  dayName: string;
  hebrewDate: string;
  roomsAvailable: number;
  status: "available" | "hold";
};

/* Legacy availability fixture retained only for visual-reference history.
const availabilityDays: AvailabilityDay[] = [
  {
    day: 1,
    dayName: "Wed",
    hebrewDate: "16 בתמוז 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 2,
    dayName: "Thu",
    hebrewDate: "17 בתמוז 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 3,
    dayName: "Fri",
    hebrewDate: "18 בתמוז 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 5,
    dayName: "Sun",
    hebrewDate: "20 בתמוז 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 6,
    dayName: "Mon",
    hebrewDate: "21 בתמוז 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 7,
    dayName: "Tue",
    hebrewDate: "22 בתמוז 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 8,
    dayName: "Wed",
    hebrewDate: "23 בתמוז 5786",
    roomsAvailable: 4,
    status: "available"
  },
  {
    day: 9,
    dayName: "Thu",
    hebrewDate: "24 בתמוז 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 10,
    dayName: "Fri",
    hebrewDate: "25 בתמוז 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 11,
    dayName: "Sat",
    hebrewDate: "26 בתמוז 5786",
    roomsAvailable: 4,
    status: "hold"
  },
  {
    day: 12,
    dayName: "Sun",
    hebrewDate: "27 בתמוז 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 13,
    dayName: "Mon",
    hebrewDate: "28 בתמוז 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 14,
    dayName: "Tue",
    hebrewDate: "29 בתמוז 5786",
    roomsAvailable: 4,
    status: "available"
  },
  {
    day: 15,
    dayName: "Wed",
    hebrewDate: "1 באב 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 16,
    dayName: "Thu",
    hebrewDate: "2 באב 5786",
    roomsAvailable: 4,
    status: "available"
  },
  {
    day: 17,
    dayName: "Fri",
    hebrewDate: "3 באב 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 19,
    dayName: "Sun",
    hebrewDate: "5 באב 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 20,
    dayName: "Mon",
    hebrewDate: "6 באב 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 21,
    dayName: "Tue",
    hebrewDate: "7 באב 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 25,
    dayName: "Sat",
    hebrewDate: "11 באב 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 26,
    dayName: "Sun",
    hebrewDate: "12 באב 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 27,
    dayName: "Mon",
    hebrewDate: "13 באב 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 28,
    dayName: "Tue",
    hebrewDate: "14 באב 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 29,
    dayName: "Wed",
    hebrewDate: "15 באב 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 30,
    dayName: "Thu",
    hebrewDate: "16 באב 5786",
    roomsAvailable: 5,
    status: "available"
  },
  {
    day: 31,
    dayName: "Fri",
    hebrewDate: "17 באב 5786",
    roomsAvailable: 5,
    status: "available"
  }
];
*/

function CalendarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect height="17" rx="2" width="18" x="3" y="4" />
      <path d="M8 2v4M16 2v4M3 9h18" />
    </svg>
  );
}

function BuildingIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M4 21h16M6 21V9l6-5 6 5v12M9 21v-7h6v7" />
    </svg>
  );
}

function SettingsIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1-2.8-2.8.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3v-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1 2.8-2.8.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3h4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1 2.8 2.8-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2v4h-.2a1.7 1.7 0 0 0-1.4 1Z" />
    </svg>
  );
}

function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-[#516071]">
      <span className={["h-2.5 w-2.5 rounded-full", color].join(" ")} />
      {label}
    </span>
  );
}

function AvailabilityView({
  days,
  endDate,
  endDateLabel,
  onNewBooking,
  onRemoveDay,
  onRangeChange,
  startDate,
  startDateLabel
}: {
  days: AvailabilityDay[];
  endDate: Date;
  endDateLabel: string;
  onNewBooking: () => void;
  onRemoveDay: (dateKey: string) => void;
  onRangeChange: (range: DateRange) => void;
  startDate: Date;
  startDateLabel: string;
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
          <p className="mt-1 text-xs text-[#6a7483]">Open the range picker, select the start date, then select the end date from the same open calendar.</p>
        </div>

        <button className="h-9 shrink-0 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white transition hover:bg-[#15344f]" onClick={onNewBooking} type="button">
          New booking
        </button>
      </header>

      <div className="p-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-black">Availability Range</h2>
            <p className="text-xs font-bold text-[#617086]">{startDateLabel} to {endDateLabel}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[156px_156px_auto]">
            <div className="rounded-xl border border-[#8fbce3] bg-[#f1f7fc] px-3 py-2">
              <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">Start date</span>
              <strong className="mt-1 block text-sm">{startDateLabel}</strong>
            </div>
            <div className="rounded-xl border border-[#d8dde5] bg-white px-3 py-2">
              <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">End date</span>
              <strong className="mt-1 block text-sm">{endDateLabel}</strong>
            </div>
            <div className="relative justify-self-end self-center">
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
                onApply={onRangeChange}
                onClose={() => setIsRangePickerOpen(false)}
                startDate={startDate}
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
              <article className="dashboard-hover-card flex min-h-16 flex-col justify-center gap-3 rounded-xl border border-[#d8dde5] px-3 py-2 sm:flex-row sm:items-center sm:justify-between" key={availabilityDay.dateKey}>
                <div>
                  <h3 className="text-sm font-black">
                    {availabilityDay.dateLabel}
                  </h3>
                  <p className="mt-1 text-xs text-[#617086]" dir="rtl">
                    {availabilityDay.hebrewDate}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                  <span className="text-xs text-[#617086]">{isHold ? `1 hold · ${availabilityDay.roomsAvailable} rooms still available` : `${availabilityDay.roomsAvailable} rooms available`}</span>
                  <span className={`inline-flex min-w-22 justify-center rounded-full border px-3 py-1 text-[10px] font-black ${isHold ? "border-[#efcf98] bg-[#fff8ec] text-[#995700]" : "border-[#b9ddcf] bg-[#effbf6] text-[#087047]"}`}>{isHold ? "Hold" : "Available"}</span>
                  <button
                    className="h-8 rounded-lg border border-[#efb5ad] bg-white px-3 text-xs font-black text-[#c3291b] transition hover:bg-[#fff4f2]"
                    onClick={() => onRemoveDay(availabilityDay.dateKey)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

    </section>
  );
}

type BlockedRange = {
  id: string;
  startLabel: string;
  endLabel?: string;
  hebrewLabel: string;
};

const initialBlockedRanges: BlockedRange[] = [
  {
    id: "july-4",
    startLabel: "Sat, Jul 4, 2026",
    hebrewLabel: "19 בתמוז 5786"
  },
  { id: "july-18", startLabel: "Sat, Jul 18, 2026", hebrewLabel: "4 באב 5786" },
  {
    id: "july-22-24",
    startLabel: "Wed, Jul 22, 2026",
    endLabel: "Fri, Jul 24, 2026",
    hebrewLabel: "8 באב 5786 to 10 באב 5786"
  }
];

function ClockIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CalendarSettingsView() {
  const [blockedRanges, setBlockedRanges] = useState(initialBlockedRanges);
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
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
  const blockedStartLabel = rangeDateFormatter.format(blockedRangeDraft.startDate);
  const blockedEndLabel = rangeDateFormatter.format(blockedRangeDraft.endDate);

  function addBlockedRange() {
    setBlockedRanges((current) => {
      const rangeId = `blocked-${dateKey(blockedRangeDraft.startDate)}-${dateKey(blockedRangeDraft.endDate)}`;
      const isSingleBlockedDay = dateKey(blockedRangeDraft.startDate) === dateKey(blockedRangeDraft.endDate);
      if (current.some((range) => range.id === rangeId)) return current;

      return [
        {
          id: rangeId,
          startLabel: blockedStartLabel,
          endLabel: isSingleBlockedDay ? undefined : blockedEndLabel,
          hebrewLabel: "16 בתמוז 5786"
        },
        ...current
      ];
    });
  }

  function removeBlockedRange(rangeId: string) {
    setBlockedRanges((current) => current.filter((range) => range.id !== rangeId));
  }

  return (
    <section className="dashboard-panel-enter mx-auto max-w-[1800px] overflow-visible rounded-xl border border-[#d8dde5] bg-white">
      <header className="border-b border-[#d8dde5] p-3">
        <div className="flex items-center gap-2">
          <SettingsIcon />
          <h1 className="text-sm font-black">Calendar Settings</h1>
        </div>
        <p className="mt-1 text-xs text-[#6a7483]">Manage blocked date ranges.</p>
      </header>

      <div className="p-3">
        <div className="overflow-visible rounded-xl border border-[#d8dde5]">
          <div className="border-b border-[#d8dde5] px-3 py-2">
            <h2 className="text-sm font-black">Blocked ranges</h2>
            <p className="mt-1 text-xs text-[#6a7483]">Blocked ranges will not show in Availability and cannot be booked.</p>
          </div>

          <div className="p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-black">Add blocked range</h3>
                <p className="text-xs font-bold text-[#617086]">{blockedStartLabel} to {blockedEndLabel}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[156px_156px_auto_auto]">
                <div className="rounded-xl border border-[#8fbce3] bg-[#f1f7fc] px-3 py-2">
                  <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">Start date</span>
                  <strong className="mt-1 block text-sm">{blockedStartLabel}</strong>
                </div>
                <div className="rounded-xl border border-[#d8dde5] bg-white px-3 py-2">
                  <span className="block text-[10px] font-black uppercase tracking-wide text-[#617086]">End date</span>
                  <strong className="mt-1 block text-sm">{blockedEndLabel}</strong>
                </div>
                <div className="relative self-center">
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
                    onApply={setBlockedRangeDraft}
                    onClose={() => setIsRangePickerOpen(false)}
                    startDate={blockedRangeDraft.startDate}
                  />
                </div>
                <button className="h-9 self-center rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black transition hover:bg-[#eef4fa]" onClick={addBlockedRange} type="button">
                  Add blocked range
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {blockedRanges.map((range) => (
                <article className="flex min-h-14 flex-col gap-3 rounded-xl border border-[#d8dde5] px-3 py-2 sm:flex-row sm:items-center sm:justify-between" key={range.id}>
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

                  <button className="h-8 shrink-0 rounded-lg border border-[#efb5ad] bg-white px-3 text-xs font-black text-[#c3291b] transition hover:bg-[#fff4f2]" onClick={() => removeBlockedRange(range.id)} type="button">
                    Remove
                  </button>
                </article>
              ))}

              {blockedRanges.length === 0 ? <p className="rounded-xl border border-dashed border-[#b9c2cf] p-6 text-center text-sm text-[#6a7483]">No blocked date ranges.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventPill({ booking, onSelect }: { booking: CalendarBooking; onSelect: () => void }) {
  const colors: Record<CalendarStatus, string> = {
    confirmed: "border-[#b9ddcf] border-l-[#178151] bg-[#f5fbf8] text-[#17202a]",
    hold: "border-[#ead8bb] border-l-[#b66b00] bg-[#fffaf2] text-[#17202a]",
    school: "border-[#d2cff9] border-l-[#5649dd] bg-[#f8f7ff] text-[#17202a]"
  };

  return (
    <button
      className={["flex w-full items-center gap-2 overflow-hidden rounded-md border border-l-4 px-2 py-1 text-left", colors[booking.status]].join(" ")}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      type="button"
    >
      <strong className="min-w-0 flex-1 truncate text-[11px]">{booking.title}</strong>

      <span className="max-w-16 truncate text-[9px] text-[#6a7483]">{booking.hall.replace("Nachlas Yehuda", "NY")}</span>
    </button>
  );
}

export function EventCalendarPage() {
  const eventsQuery = useAuthenticatedQuery<EventsResponse>("/api/events");
  const [activeTab, setActiveTab] = useState<"calendar" | "availability" | "settings">("calendar");
  const today = useMemo(() => startOfDay(new Date()), []);
  const [availabilityRange, setAvailabilityRange] = useState<DateRange>(() => {
    const startDate = startOfMonth(today);
    return {
      startDate,
      endDate: new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
    };
  });
  const [removedAvailabilityDays, setRemovedAvailabilityDays] = useState<
    string[]
  >([]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDateValue, setSelectedDateValue] = useState(today);
  const selectedDate = dateKey(selectedDateValue);
  const [searchQuery, setSearchQuery] = useState("");
  const [hallFilter, setHallFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const bookings = useMemo<CalendarBooking[]>(
    () =>
      (eventsQuery.data?.events ?? []).map((event) => {
        const normalizedStatus = event.eventStatus.toLowerCase();
        const isSchoolEvent = event.eventType?.toLowerCase().includes("school");

        return {
          id: event.id,
          dateKey: dateKeyFromIso(event.eventDate),
          title: event.clientName,
          hall: event.hall.name,
          type: event.eventType ?? "Event",
          packageName: event.packageName ?? undefined,
          status: isSchoolEvent ? "school" : normalizedStatus.includes("confirm") ? "confirmed" : "hold"
        };
      }),
    [eventsQuery.data]
  );
  const halls = useMemo(() => (eventsQuery.data?.halls ?? []).map((hall) => hall.name), [eventsQuery.data]);
  const calendarGridDays = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const availabilityRangeDays = useMemo(() => {
    const days: Date[] = [];

    for (
      let day = startOfDay(availabilityRange.startDate);
      day <= availabilityRange.endDate;
      day = addDays(day, 1)
    ) {
      days.push(day);
    }

    return days;
  }, [availabilityRange.endDate, availabilityRange.startDate]);
  const liveAvailabilityDays = useMemo<AvailabilityDay[]>(
    () =>
      availabilityRangeDays
        .map((day) => {
          const currentDateKey = dateKey(day);
          const dayBookings = bookings.filter((booking) => booking.dateKey === currentDateKey);
          return {
            dateKey: currentDateKey,
            dateLabel: new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric"
            }).format(day),
            day: day.getDate(),
            dayName: new Intl.DateTimeFormat("en-US", {
              weekday: "short"
            }).format(day),
            hebrewDate: formatHebrewDate(day),
            roomsAvailable: Math.max(0, halls.length - new Set(dayBookings.map((booking) => booking.hall)).size),
            status: dayBookings.some((booking) => booking.status === "hold")
              ? ("hold" as const)
              : ("available" as const)
          };
        })
        .filter((day) => !removedAvailabilityDays.includes(day.dateKey)),
    [availabilityRangeDays, bookings, halls.length, removedAvailabilityDays]
  );

  const filteredBookings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesSearch = !query || [booking.title, booking.hall, booking.type, booking.packageName ?? ""].join(" ").toLowerCase().includes(query);

      const matchesHall = hallFilter === "all" || booking.hall === hallFilter;

      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;

      const matchesType = typeFilter === "all" || booking.type === typeFilter;

      return matchesSearch && matchesHall && matchesStatus && matchesType;
    });
  }, [bookings, hallFilter, searchQuery, statusFilter, typeFilter]);

  const selectedBookings = bookings.filter((booking) => booking.dateKey === selectedDate);

  const selectedHallNames = selectedBookings.map((booking) => booking.hall);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(visibleMonth);
  const selectedDateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(selectedDateValue);
  const rangeDateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const availabilityStartDateLabel = rangeDateFormatter.format(
    availabilityRange.startDate
  );
  const availabilityEndDateLabel = rangeDateFormatter.format(
    availabilityRange.endDate
  );

  function selectDate(date: Date) {
    setSelectedDateValue(date);
    setVisibleMonth(startOfMonth(date));
  }

  function moveMonth(amount: number) {
    const nextMonth = addMonths(visibleMonth, amount);
    setVisibleMonth(nextMonth);
    setSelectedDateValue(nextMonth);
  }

  function goToToday() {
    setVisibleMonth(startOfMonth(today));
    setSelectedDateValue(today);
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar title="Calendar" subtitle="Review hall availability, bookings, holds, and fully booked dates." onNewBooking={() => setIsNewBookingOpen(true)} />

      <nav className="mt-2 shrink-0 overflow-hidden border-b border-t border-[#d8dde5] bg-white px-0 sm:px-5 lg:mt-0 lg:border-t-0">
        <div className="grid w-full min-w-0 grid-cols-3 sm:flex sm:min-w-max sm:gap-2">
          <button className={`flex h-12 min-w-0 items-center justify-center gap-1 whitespace-nowrap border-b-3 px-1 text-xs font-black sm:gap-2 sm:px-2 sm:text-sm ${activeTab === "calendar" ? "border-[#1f4d73] text-[#17202a]" : "border-transparent text-[#516071]"}`} onClick={() => setActiveTab("calendar")} type="button">
            <CalendarIcon className="hidden h-4 w-4 sm:block" />
            Month Calendar
          </button>

          <button className={`flex h-12 min-w-0 items-center justify-center gap-1 whitespace-nowrap border-b-3 px-1 text-xs font-black sm:gap-2 sm:px-2 sm:text-sm ${activeTab === "availability" ? "border-[#1f4d73] text-[#17202a]" : "border-transparent text-[#516071]"}`} onClick={() => setActiveTab("availability")} type="button">
            <BuildingIcon className="hidden h-4 w-4 sm:block" />
            Availability
          </button>

          <button className={`flex h-12 min-w-0 items-center justify-center gap-1 whitespace-nowrap border-b-3 px-1 text-xs font-black sm:gap-2 sm:px-2 sm:text-sm ${activeTab === "settings" ? "border-[#1f4d73] text-[#17202a]" : "border-transparent text-[#516071]"}`} onClick={() => setActiveTab("settings")} type="button">
            <SettingsIcon className="hidden h-4 w-4 sm:block" />
            Settings
          </button>
        </div>
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {activeTab === "calendar" && (eventsQuery.isLoading || eventsQuery.error) ? (
          <div className="flex h-full min-h-80 items-center justify-center">
            <AsyncState
              error={eventsQuery.error}
              isLoading={eventsQuery.isLoading}
              onRetry={eventsQuery.refetch}
            />
          </div>
        ) : activeTab === "availability" ? (
          <AvailabilityView
            days={liveAvailabilityDays}
            endDate={availabilityRange.endDate}
            endDateLabel={availabilityEndDateLabel}
            onNewBooking={() => setIsNewBookingOpen(true)}
            onRemoveDay={(removedDateKey) =>
              setRemovedAvailabilityDays((current) =>
                current.includes(removedDateKey)
                  ? current
                  : [...current, removedDateKey]
              )
            }
            onRangeChange={setAvailabilityRange}
            startDate={availabilityRange.startDate}
            startDateLabel={availabilityStartDateLabel}
          />
        ) : activeTab === "settings" ? (
          <CalendarSettingsView />
        ) : (
          <div className="mx-auto grid max-w-[1800px] gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="dashboard-panel-enter min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
              <div className="flex flex-col gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon />
                    <h1 className="text-sm font-black">Month Calendar</h1>
                  </div>

                  <p className="mt-1 text-xs text-[#6a7483]">Click a day to book or review the schedule.</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <StatusDot color="bg-[#178151]" label="Confirmed" />
                  <StatusDot color="bg-[#b66b00]" label="Hold" />
                  <StatusDot color="bg-[#5649dd]" label="School" />
                  <StatusDot color="bg-[#aab5c3]" label="Fully booked" />
                </div>
              </div>

              <div className="flex flex-col gap-3 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-black">{monthLabel}</h2>

                  <div className="grid grid-cols-3 gap-2">
                    <button aria-label="Show previous month" className="h-9 rounded-lg border border-[#b9c2cf] px-3 text-xs font-black hover:bg-[#eef4fa]" onClick={() => moveMonth(-1)} type="button">
                      Previous
                    </button>

                    <button className="h-9 rounded-lg border border-[#b9c2cf] px-3 text-xs font-black hover:bg-[#eef4fa]" onClick={goToToday} type="button">
                      Today
                    </button>

                    <button aria-label="Show next month" className="h-9 rounded-lg border border-[#b9c2cf] px-3 text-xs font-black hover:bg-[#eef4fa]" onClick={() => moveMonth(1)} type="button">
                      Next
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-[minmax(190px,2fr)_repeat(3,minmax(120px,1fr))]">
                  <input className="h-10 min-w-0 rounded-lg border border-[#b9c2cf] px-3 text-sm outline-none focus:border-[#1f4d73]" name="calendarSearch" onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search calendar" type="search" value={searchQuery} />

                  <select className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm" name="calendarHallFilter" onChange={(event) => setHallFilter(event.target.value)} value={hallFilter}>
                    <option value="all">All halls</option>
                    {halls.map((hall) => (
                      <option key={hall} value={hall}>
                        {hall}
                      </option>
                    ))}
                  </select>

                  <select className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm" name="calendarStatusFilter" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                    <option value="all">All statuses</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="hold">Hold</option>
                    <option value="school">School</option>
                  </select>

                  <select className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm" name="calendarTypeFilter" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
                    <option value="all">All types</option>
                    <option value="Wedding">Wedding</option>
                    <option value="Sheva Brachos">Sheva Brachos</option>
                    <option value="Bar Mitzvah">Bar Mitzvah</option>
                    <option value="School event">School event</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto px-3 pb-3">
                <div className="min-w-212.5 overflow-hidden rounded-xl border border-[#d8dde5]">
                  <div className="grid grid-cols-7 bg-[#fbfcfd]">
                    {weekDays.map((day) => (
                      <div key={day} className="border-r border-[#d8dde5] py-3 text-center text-[10px] font-black tracking-wider text-[#6a7483] last:border-r-0">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {calendarGridDays.map((calendarDay) => {
                      const dayBookings = filteredBookings.filter((booking) => booking.dateKey === calendarDay.dateKey);
                      const isSelected = calendarDay.dateKey === selectedDate;
                      const bookedHallCount = new Set(bookings.filter((booking) => booking.dateKey === calendarDay.dateKey).map((booking) => booking.hall)).size;
                      const fullyBooked = calendarDay.currentMonth && halls.length > 0 && bookedHallCount >= halls.length;
                      const dateLabel = new Intl.DateTimeFormat("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric"
                      }).format(calendarDay.date);

                      return (
                        <div key={calendarDay.dateKey} className={`relative min-h-32 border-r border-t border-[#d8dde5] p-2 text-left transition nth-[7n]:border-r-0 ${calendarDay.currentMonth ? "bg-white hover:bg-[#f8fbfd]" : "bg-[#f8f9fb] text-[#94a1b1] hover:bg-[#eef2f6]"} ${isSelected ? "z-1 ring-2 ring-inset ring-[#a8ccec]" : ""}`}>
                          <button aria-label={`Select ${dateLabel}`} className="absolute inset-0 z-0" onClick={() => selectDate(calendarDay.date)} type="button" />

                          <div className="pointer-events-none relative z-1 flex items-start justify-between gap-2">
                            <strong className="text-sm">{calendarDay.day}</strong>

                            <span className="text-[9px] font-semibold" dir="rtl">
                              {formatHebrewDate(calendarDay.date)}
                            </span>
                          </div>

                          <div className="relative z-1 mt-2 space-y-1">
                            {dayBookings.map((booking) => (
                              <EventPill booking={booking} key={booking.id} onSelect={() => selectDate(calendarDay.date)} />
                            ))}
                          </div>

                          {fullyBooked ? <span className="pointer-events-none absolute bottom-2 right-2 z-1 text-[9px] font-black text-[#516071]">Fully booked</span> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <aside className="dashboard-panel-enter self-start overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8dde5] p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon />
                    <h2 className="text-sm font-black">{selectedDateLabel}</h2>
                  </div>

                  <p className="mt-1 text-xs text-[#6a7483]">
                    {selectedBookings.length} {selectedBookings.length === 1 ? "booking" : "bookings"} on this date
                  </p>
                </div>

                <button
                  className="h-9 shrink-0 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f]"
                  onClick={() => setIsNewBookingOpen(true)}
                  type="button"
                >
                  Book date
                </button>
              </div>

              <div className="space-y-3 p-3">
                {selectedBookings.map((booking) => (
                  <article className="dashboard-hover-card rounded-xl border border-[#1f4d73] bg-[#eef4fa] p-3" key={booking.id}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8dde5] bg-white text-[#1f4d73]">✓</span>

                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{booking.title}</strong>

                        <p className="mt-1 truncate text-xs text-[#6a7483]">
                          {booking.hall} · {booking.type}
                          {booking.packageName ? ` · ${booking.packageName}` : ""}
                        </p>
                      </div>

                      <span className="rounded-full border border-[#b9ddcf] bg-white px-2 py-1 text-[9px] font-black text-[#178151]">Confirmed</span>
                    </div>
                  </article>
                ))}

                {halls.map((hall) => {
                  const booked = selectedHallNames.includes(hall);
                  const booking = selectedBookings.find((item) => item.hall === hall);

                  return (
                    <article className={`dashboard-hover-card rounded-xl border p-3 ${booked ? "border-[#ebc7bd] bg-[#fff7f4]" : "border-[#b9ddcf] bg-[#f5fbf8]"}`} key={hall}>
                      <h3 className="text-sm font-black">{hall}</h3>

                      <p className="mt-2 text-xs text-[#6a7483]">{booked ? "Booked by " + booking?.title : "Available"}</p>
                    </article>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </main>

      <CalendarBookingDialog
        eventTypes={eventsQuery.data?.eventTypes ?? []}
        halls={eventsQuery.data?.halls ?? []}
        onClose={() => setIsNewBookingOpen(false)}
        onSaved={async () => {
          await eventsQuery.refetch();
        }}
        open={isNewBookingOpen}
        packages={eventsQuery.data?.packages ?? []}
        selectedDate={selectedDate}
      />
    </div>
  );
}
