"use client";

import {
  weekStartDayIndex,
  type WeekStartsOn
} from "@/lib/dates/calendar-date";

export type CalendarStatus = "confirmed" | "hold" | "school";

/// Which of the three renderings of the same bookings the Calendar tab shows.
/// Settings > Calendar > Default view picks the one a visit opens on; the
/// switcher above the grid changes it for the rest of the visit.
export type CalendarView = "month" | "week" | "agenda";

export type CalendarBooking = {
  id: string;
  dateKey: string;
  title: string;
  hall: string;
  hallColor: string | null;
  type: string;
  packageName?: string;
  status: CalendarStatus;
};

export type EventsResponse = {
  events: Array<{
    id: string;
    clientName: string;
    eventDate: string;
    eventStatus: string;
    bookingStatus: string;
    eventType: string | null;
    packageName: string | null;
    hall: { id: string; name: string; color: string | null };
  }>;
  halls: Array<{
    id: string;
    name: string;
    color?: string | null;
    dailyEventLimit?: number | null;
  }>;
  eventTypes: Array<{ id: string; name: string }>;
  /** Staff a new booking can be assigned to. The id is the membership. */
  coordinators: Array<{ id: string; name: string }>;
  blockedDates: Array<{
    id: string;
    startDate: string;
    endDate: string;
    label: string;
    reason: string | null;
  }>;
  calendarSettings?: {
    dailyEventLimit: number;
    defaultView?: CalendarView;
    weekStartsOn?: WeekStartsOn;
    showHebrewDate?: boolean;
    showAvailability?: boolean;
    clickAnywhereToAdd?: boolean;
  };
};

export const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/// The header row rotated to match the grid, which starts its weeks wherever
/// Settings says. Rotating the labels and the grid from the same value is what
/// keeps a column's heading over the days it actually holds.
export function weekDayLabels(weekStartsOn: WeekStartsOn = "sunday") {
  const startIndex = weekStartDayIndex(weekStartsOn);
  return weekDays.map(
    (_, index) => weekDays[(startIndex + index) % weekDays.length]
  );
}

export type AvailabilityDay = {
  dateKey: string;
  dateLabel: string;
  day: number;
  dayName: string;
  hebrewDate: string;
  roomsAvailable: number;
  status: "available" | "hold";
};

export function CalendarIcon({
  className = "h-4 w-4"
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <rect height="17" rx="2" width="18" x="3" y="4" />
      <path d="M8 2v4M16 2v4M3 9h18" />
    </svg>
  );
}

export function BuildingIcon({
  className = "h-4 w-4"
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M4 21h16M6 21V9l6-5 6 5v12M9 21v-7h6v7" />
    </svg>
  );
}

export function SettingsIcon({
  className = "h-4 w-4"
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1-2.8-2.8.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3v-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1 2.8-2.8.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3h4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1 2.8 2.8-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2v4h-.2a1.7 1.7 0 0 0-1.4 1Z" />
    </svg>
  );
}

export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-[#516071]">
      <span className={["h-2.5 w-2.5 rounded-full", color].join(" ")} />
      {label}
    </span>
  );
}

export function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
