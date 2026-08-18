"use client";

import { type ReactNode } from "react";

export type BadgeTone = "green" | "gold" | "red";
export type IconName =
  | "calendar"
  | "check"
  | "chevron"
  | "clock"
  | "close"
  | "couples"
  | "document"
  | "expand"
  | "files"
  | "fork"
  | "guests"
  | "mail"
  | "map"
  | "menu"
  | "phone"
  | "plus"
  | "printer"
  | "save"
  | "store"
  | "upload"
  | "user";

export type EventFile = {
  id: string;
  bookingStatus: string;
  clientName: string;
  eventType: string;
  title: string;
  date: string;
  dateInput: string;
  time: string;
  timeInput: string;
  hallId: string;
  room: string;
  packageName: string;
  guests: string;
  children: string;
  couples: string;
  coordinator: string;
  balance: string;
  status: "Confirmed" | "Hold";
  paymentStatus: string;
  version: number;
  cancelledAt: string | null;
  completedAt: string | null;
  waitersCount: number;
  setupTime: string;
  washingTime: string;
  tableclothName: string;
  notes: string[];
  internalNotes: string;
  daveningNote: string;
  memberShulName: string;
  sideBoxes: string;
  shabbosSetup: string;
  diningManagerNotes: string | null;
  activityLogs: Array<{
    id: string;
    actionType: string;
    message: string;
    userName: string | null;
    createdAt: string;
  }>;
  diningHallMapPreset: {
    id: string;
    name: string;
    objects: unknown[];
  } | null;
  phone: string;
  email: string;
  workspaceData: Record<string, unknown>;
  menuItemIds?: string[];
};

export type EventHallOption = {
  id: string;
  name: string;
};

export type EventsResponse = {
  events: Array<{
    id: string;
    clientName: string;
    eventDate: string;
    eventType: string | null;
    eventStatus: string;
    bookingStatus: string;
    startsAt: string | null;
    endsAt: string | null;
    setupStartsAt: string | null;
    cleanupEndsAt: string | null;
    holdExpiresAt: string | null;
    cancelledAt: string | null;
    completedAt: string | null;
    version: number;
    paymentStatus: string | null;
    packageName: string | null;
    couplesCount: number;
    menCount: number;
    ladiesCount: number;
    boysCount: number;
    girlsCount: number;
    kidsCount: number;
    waitersCount: number;
    setupTime: string | null;
    washingTime: string | null;
    tableclothName: string | null;
    notes: string | null;
    daveningNote: string | null;
    memberShulName: string | null;
    sideBoxes: unknown;
    shabbosSetup: unknown;
    diningManagerNotes: string | null;
    activityLogs?: Array<{
      id: string;
      actionType: string;
      message: string;
      userName: string | null;
      createdAt: string;
    }>;
    diningHallMapPreset: {
      id: string;
      name: string;
      objects: unknown[];
    } | null;
    phone: string;
    email: string | null;
    workspaceData: Record<string, unknown> | null;
    menuItemIds: string[];
    hall: { id: string; name: string };
  }>;
  halls: EventHallOption[];
  eventTypes: Array<{ id: string; name: string }>;
};

export const tabs = [
  { label: "Event details", icon: "calendar" },
  { label: "Menu", icon: "document" },
  { label: "Client portal", icon: "files" },
  { label: "Billing", icon: "document" },
  { label: "Hall map", icon: "map" },
  { label: "Kitchen", icon: "fork" },
  { label: "Vendors", icon: "store" },
  { label: "Files", icon: "files" }
] satisfies Array<{ label: string; icon: IconName }>;

export type EventWorkspaceTab = (typeof tabs)[number]["label"];

export const timelineRows = [
  ["03:00 PM", "Dining room setup begins", "Event"],
  ["04:30 PM", "Kitchen starts hot service prep", "Kitchen"],
  ["06:30 PM", "Guests arrive and first course begins", "Event"],
  ["10:45 PM", "Cleanup instructions begin", "Event"]
];

/// The catalog, read from /api/menu to populate the selector drawer. Dishes and
/// add-ons come back together because the menu tab offers both.
export type EventMenuResponse = {
  items: Array<{
    id: string;
    name: string;
    isActive: boolean;
    services: Array<{ serviceStyle: string }>;
  }>;
  addOns: Array<{
    id: string;
    name: string;
    price: string | number | null;
    isActive: boolean;
  }>;
};

/// One event's menu, read from /api/events/[eventId]/menu.
export type EventMenuDocument = {
  id: string | null;
  meal: string;
  status: "Draft" | "ClientSubmitted" | "Confirmed";
  serviceStyle: string | null;
  confirmedAt: string | null;
  /// Sent back on every write and checked, so two people editing one menu get
  /// a conflict rather than one of them silently losing their changes.
  version: number;
  confirmedBy: { id: string; name: string } | null;
  lines: EventMenuLine[];
};

export type EventMenuLine = {
  id: string;
  menuItemId: string | null;
  addOnId: string | null;
  kind: "Dish" | "AddOn";
  name: string;
  /// Buffet or Plated for a dish. Null on an add-on, and null on a dish that
  /// is served both ways and has not been told which applies here.
  serviceStyle: string | null;
  /// The styles the dish has a rule for, so the tab can ask when there are two.
  availableStyles: string[];
  price: number | null;
  notes: string | null;
  sortOrder: number;
  source: string;
  /// Deactivated in the library since it was put on this menu. Still served,
  /// but it will not be offered for anything new.
  isRetired: boolean;
};

export type EventMenuDocumentResponse = {
  menu: EventMenuDocument;
};

export const portalChecklist = [
  ["Event date and time", true],
  ["Guest count editor", true],
  ["Client menu selector", true],
  ["Live total summary", true],
  ["Hall layout view", true],
  ["Payment link", true],
  ["Tablecloth options with pictures", true],
  ["Add-ons with pictures", true],
  ["Balance due", true],
  ["Internal notes", false]
] as const;

export function LineIcon({
  name,
  className = "h-4 w-4"
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  const paths: Record<IconName, ReactNode> = {
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M8 2v4M16 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.6 2.6L16.5 9" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    close: <path d="M6 6l12 12M18 6 6 18" />,
    couples: (
      <>
        <circle cx="8" cy="8" r="3" />
        <circle cx="16" cy="8" r="3" />
        <path d="M3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0" />
      </>
    ),
    document: (
      <>
        <path d="M6 3h9l3 3v15H6Z" />
        <path d="M14 3v4h4M9 11h6M9 15h6" />
      </>
    ),
    expand: (
      <>
        <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
        <path d="M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6" />
      </>
    ),
    files: (
      <>
        <path d="M7 3h8l4 4v12H7Z" />
        <path d="M15 3v5h4M5 7H3v14h12v-2" />
      </>
    ),
    fork: (
      <>
        <path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M18 3v18M18 3c2 2 3 4 3 7v2h-3" />
      </>
    ),
    guests: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    map: (
      <>
        <path d="M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3Z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    phone: (
      <>
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.8L7.7 9.8a16 16 0 0 0 6.5 6.5l1.3-1.3a2 2 0 0 1 1.8-.6l3 .5a2 2 0 0 1 1.7 2Z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    printer: (
      <>
        <path d="M7 8V3h10v5" />
        <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
        <path d="M7 14h10v7H7Z" />
      </>
    ),
    save: (
      <>
        <path d="M5 3h12l2 2v16H5Z" />
        <path d="M8 3v6h8M8 21v-7h8v7" />
      </>
    ),
    store: (
      <>
        <path d="M4 10h16l-1-5H5Z" />
        <path d="M6 10v10h12V10M9 20v-6h6v6" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V8" />
        <path d="m8 12 4-4 4 4" />
        <path d="M20 16.5A4.5 4.5 0 0 0 15.8 12a6 6 0 1 0-11.1 3.2A3.5 3.5 0 0 0 6.5 22H18a4 4 0 0 0 2-7.5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M6 21a6 6 0 0 1 12 0" />
      </>
    )
  };

  return <svg {...common}>{paths[name]}</svg>;
}

export function Badge({
  children,
  tone
}: {
  children: ReactNode;
  tone: BadgeTone;
}) {
  const classes = {
    green: "border-[#146c43]/30 bg-[#eef4fa] text-[#146c43]",
    gold: "border-[#9a5b00]/35 bg-[#fbfcfd] text-[#9a5b00]",
    red: "border-[#a62b24]/35 bg-[#fbfcfd] text-[#a62b24]"
  };

  return (
    <span
      className={`inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-black ${classes[tone]}`}
    >
      {children}
    </span>
  );
}

export function ActionButton({
  children,
  icon,
  onClick,
  primary = false
}: {
  children: ReactNode;
  icon: IconName;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <button
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-2.5 text-xs font-black transition hover:-translate-y-0.5 ${
        primary
          ? "border-[#1f4d73] bg-[#1f4d73] text-white shadow-sm shadow-[#1f4d73]/20 hover:bg-[#15344f]"
          : "border-[#b9c2cf] bg-white text-[#17202a] hover:bg-[#eef4fa]"
      }`}
      onClick={onClick}
      type="button"
    >
      <LineIcon name={icon} className="h-3.5 w-3.5 shrink-0" />
      {children}
    </button>
  );
}
