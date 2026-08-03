"use client";

export type CalendarStatus = "confirmed" | "hold" | "school";

export type CalendarBooking = {
  id: string;
  dateKey: string;
  title: string;
  hall: string;
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
    eventType: string | null;
    packageName: string | null;
    hall: { id: string; name: string };
  }>;
  halls: Array<{ id: string; name: string }>;
  eventTypes: Array<{ id: string; name: string }>;
  packages: Array<{ id: string; name: string }>;
  calendarSettings?: {
    dailyEventLimit: number;
  };
};

export const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export type AvailabilityDay = {
  dateKey: string;
  dateLabel: string;
  day: number;
  dayName: string;
  hebrewDate: string;
  roomsAvailable: number;
  status: "available" | "hold";
};

export function CalendarIcon({ className = "h-4 w-4" }: { className?: string }) {
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

export function BuildingIcon({ className = "h-4 w-4" }: { className?: string }) {
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

export function SettingsIcon({ className = "h-4 w-4" }: { className?: string }) {
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

export type BlockedRange = {
  id: string;
  startLabel: string;
  endLabel?: string;
  hebrewLabel: string;
};

export const initialBlockedRanges: BlockedRange[] = [
  {
    id: "july-4",
    startLabel: "Sat, Jul 4, 2026",
    hebrewLabel: "19 בתמוז"
  },
  {
    id: "july-18",
    startLabel: "Sat, Jul 18, 2026",
    hebrewLabel: "4 באב"
  },
  {
    id: "july-22-24",
    startLabel: "Wed, Jul 22, 2026",
    endLabel: "Fri, Jul 24, 2026",
    hebrewLabel: "8 באב to 10 באב"
  }
];

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
