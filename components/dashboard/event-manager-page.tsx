"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { NewEventDialog, type NewEventFormValues } from "@/components/forms-and-modals/new-event-dialog";
import { PrintPacketDrawer } from "@/components/forms-and-modals/print-packet-drawer";
import { ClientPortalPreviewDrawer } from "@/components/forms-and-modals/client-portal-preview-drawer";
import { DashboardTopbar } from "@/components/topbars/dashboard-topbar";
import { clearCachedSyncedUser, getCachedSyncedUser, syncSignedInUser, type SyncSignedInUserResponse } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type BadgeTone = "green" | "gold" | "red";
type IconName =
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

type EventFile = {
  title: string;
  date: string;
  time: string;
  room: string;
  packageName: string;
  guests: string;
  children: string;
  couples: string;
  coordinator: string;
  balance: string;
  status: "Confirmed" | "Hold";
  paymentStatus: string;
  notes: string[];
};

const events: EventFile[] = [
  {
    title: "Friedman Wedding",
    date: "Jul 8, 2026",
    time: "6:30 PM",
    room: "Grand Hall",
    packageName: "Gold Dinner",
    guests: "278",
    children: "38",
    couples: "120",
    coordinator: "M. Stern",
    balance: "$30,200.00",
    status: "Confirmed",
    paymentStatus: "Open balance",
    notes: ["Menu: Confirmed", "Layout: Needs final review", "Needs review"],
  },
  {
    title: "Klein Sheva Brachos",
    date: "Jul 11, 2026",
    time: "8:45 PM",
    room: "Nachlas Yehuda A",
    packageName: "Standard Dairy",
    guests: "180",
    children: "24",
    couples: "76",
    coordinator: "Y. Mandel",
    balance: "$15,100.00",
    status: "Hold",
    paymentStatus: "Open balance",
    notes: ["Menu: Needs confirmation", "Layout: Ready", "Needs review"],
  },
  {
    title: "Weiss Bar Mitzvah",
    date: "Jul 14, 2026",
    time: "12:30 PM",
    room: "Terrace Room",
    packageName: "Premium Lunch",
    guests: "205",
    children: "42",
    couples: "84",
    coordinator: "S. Berger",
    balance: "Paid",
    status: "Confirmed",
    paymentStatus: "Paid",
    notes: ["Menu: Confirmed", "Layout: Ready"],
  },
  {
    title: "Green Dinner",
    date: "Jul 20, 2026",
    time: "7:00 PM",
    room: "Small Hall",
    packageName: "Basic Dinner",
    guests: "95",
    children: "12",
    couples: "40",
    coordinator: "A. Klein",
    balance: "$9,200.00",
    status: "Hold",
    paymentStatus: "Open balance",
    notes: ["Menu: Not assigned", "Layout: Not started", "Needs review"],
  },
  {
    title: "Landau Vort",
    date: "Jul 23, 2026",
    time: "8:00 PM",
    room: "Grand Hall",
    packageName: "Light Buffet",
    guests: "160",
    children: "18",
    couples: "70",
    coordinator: "M. Stern",
    balance: "$6,800.00",
    status: "Confirmed",
    paymentStatus: "Open balance",
    notes: ["Menu: Confirmed", "Layout: Ready", "Needs review"],
  },
];

const tabs = [
  { label: "Event details", icon: "calendar" },
  { label: "Menu", icon: "document" },
  { label: "Client portal", icon: "files" },
  { label: "Billing", icon: "document" },
  { label: "Hall map", icon: "map" },
  { label: "Kitchen", icon: "fork" },
  { label: "Vendors", icon: "store" },
  { label: "Files", icon: "files" },
] satisfies Array<{ label: string; icon: IconName }>;

type EventWorkspaceTab = (typeof tabs)[number]["label"];

const timelineRows = [
  ["03:00 PM", "Dining room setup begins", "Event"],
  ["04:30 PM", "Kitchen starts hot service prep", "Kitchen"],
  ["06:30 PM", "Guests arrive and first course begins", "Event"],
  ["10:45 PM", "Washing and cleanup instructions begin", "Event"],
];

const menuItems = [
  { course: "Appetizer", name: "Challah rolls" },
  { course: "Soup", name: "Chicken soup" },
  { course: "Main", name: "Braised short ribs" },
  { course: "Side", name: "Potato kugel" },
  { course: "Main", name: "Children schnitzel" },
];

const addMenuItems = ["Add Appetizer", "Add Soup", "Add Main", "Add Side", "Add Drink", "Add Dessert", "Add more"];

const portalChecklist = [
  ["Event date and time", true],
  ["Guest count editor", true],
  ["Client menu selector", true],
  ["Live total summary", true],
  ["Hall layout view", true],
  ["Payment link", true],
  ["Tablecloth options with pictures", true],
  ["Add-ons with pictures", true],
  ["Balance due", true],
  ["Internal notes", false],
] as const;

function LineIcon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, ReactNode> = {
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.6 2.6L16.5 9" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    couples: <><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><path d="M3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0" /></>,
    document: <><path d="M6 3h9l3 3v15H6Z" /><path d="M14 3v4h4M9 11h6M9 15h6" /></>,
    expand: <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" /><path d="M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6" /></>,
    files: <><path d="M7 3h8l4 4v12H7Z" /><path d="M15 3v5h4M5 7H3v14h12v-2" /></>,
    fork: <><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M18 3v18M18 3c2 2 3 4 3 7v2h-3" /></>,
    guests: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    map: <><path d="M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15M15 6v15" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.8L7.7 9.8a16 16 0 0 0 6.5 6.5l1.3-1.3a2 2 0 0 1 1.8-.6l3 .5a2 2 0 0 1 1.7 2Z" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    printer: <><path d="M7 8V3h10v5" /><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7Z" /></>,
    save: <><path d="M5 3h12l2 2v16H5Z" /><path d="M8 3v6h8M8 21v-7h8v7" /></>,
    store: <><path d="M4 10h16l-1-5H5Z" /><path d="M6 10v10h12V10M9 20v-6h6v6" /></>,
    upload: <><path d="M12 16V8" /><path d="m8 12 4-4 4 4" /><path d="M20 16.5A4.5 4.5 0 0 0 15.8 12a6 6 0 1 0-11.1 3.2A3.5 3.5 0 0 0 6.5 22H18a4 4 0 0 0 2-7.5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M6 21a6 6 0 0 1 12 0" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function Badge({ children, tone }: { children: ReactNode; tone: BadgeTone }) {
  const classes = {
    green: "border-[#146c43]/30 bg-[#eef4fa] text-[#146c43]",
    gold: "border-[#9a5b00]/35 bg-[#fbfcfd] text-[#9a5b00]",
    red: "border-[#a62b24]/35 bg-[#fbfcfd] text-[#a62b24]",
  };

  return <span className={`inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-black ${classes[tone]}`}>{children}</span>;
}

function ActionButton({ children, icon, onClick, primary = false }: { children: ReactNode; icon: IconName; onClick?: () => void; primary?: boolean }) {
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

function EventListCard({ event, selected, onClick }: { event: EventFile; selected: boolean; onClick: () => void }) {
  const statusTone = event.status === "Confirmed" ? "green" : "gold";

  return (
    <button
      className={`w-full rounded-lg border p-2.5 text-left transition ${
        selected ? "border-[#1f4d73] bg-[#eef4fa]" : "border-[#d8dde5] bg-white hover:border-[#b9c2cf] hover:bg-[#fbfcfd]"
      }`}
      type="button"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#b9c2cf] bg-[#fbfcfd] text-[#1f4d73]">
          <LineIcon name="calendar" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-black text-[#17202a]">{event.title}</h3>
            <Badge tone={statusTone}>{event.status}</Badge>
          </div>
          <div className="mt-1 flex items-start justify-between gap-2 text-[11px] leading-5 text-[#6a7483]">
            <p className="min-w-0">
              {event.date} at {event.time} - {event.room}
              <br />
              {event.packageName} - {event.guests} guests - {event.coordinator}
            </p>
            <span className="shrink-0 text-right text-[#17202a]">{event.balance}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.notes.map((note) => (
              <Badge key={note} tone={note.includes("Not") ? "red" : note.includes("Needs") ? "gold" : "green"}>
                {note}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

function SummaryTile({ label, value, icon, emphasized = false }: { label: string; value: string; icon: IconName; emphasized?: boolean }) {
  return (
    <article className={`min-h-20 rounded-lg border bg-white p-3 ${emphasized ? "border-[#1f4d73] shadow-sm shadow-[#1f4d73]/10" : "border-[#d8dde5]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">{label}</p>
          <p className="mt-2 text-sm font-black text-[#17202a]">{value}</p>
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#6a7483]">
          <LineIcon name={icon} className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483] ${className}`}>
      {label}
      {children}
    </label>
  );
}

function ClientContact() {
  const rows = [
    { icon: "phone", label: "718-555-0142" },
    { icon: "mail", label: "office@friedman.example" },
    { icon: "couples", label: "M. Stern" },
  ] satisfies Array<{ icon: IconName; label: string }>;

  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="user" />
        <h2 className="text-sm font-black text-[#17202a]">Client contact</h2>
      </header>
      <div className="space-y-3 p-3">
        {rows.map((row) => (
          <button key={row.label} className="flex h-12 w-full items-center gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 text-left text-sm font-black text-[#17202a] hover:bg-[#eef4fa]" type="button">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#1f4d73]">
              <LineIcon name={row.icon} />
            </span>
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            <LineIcon name="chevron" className="h-4 w-4 text-[#17202a]" />
          </button>
        ))}
      </div>
    </section>
  );
}

function ReadinessPanel() {
  const rows = [
    ["Event confirmed", true],
    ["Menu confirmed", true],
    ["Hall map confirmed", false],
    ["Timeline confirmed", false],
    ["Event paid", false],
  ] as const;

  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="files" />
        <h2 className="text-sm font-black text-[#17202a]">Readiness</h2>
      </header>
      <div className="space-y-3 p-3">
        {rows.map(([label, done]) => (
          <div key={label} className="flex h-12 items-center gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 text-sm font-black text-[#17202a]">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${done ? "border-[#146c43] text-[#146c43]" : "border-[#b9c2cf] text-transparent"}`}>
              {done ? <LineIcon name="check" className="h-4 w-4" /> : null}
            </span>
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}

function EventInformation({ event }: { event: EventFile }) {
  return (
    <section className="rounded-lg border border-[#1f4d73] bg-white shadow-sm shadow-[#1f4d73]/10">
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="calendar" />
        <h2 className="text-sm font-black text-[#17202a]">Event information</h2>
      </header>
      <div className="grid gap-3 p-3 sm:grid-cols-3">
        <Field label="Client">
          <input className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]" defaultValue={event.title.replace(" Wedding", "")} />
        </Field>
        <Field label="Event type">
          <input className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]" defaultValue={event.title.includes("Wedding") ? "Wedding" : "Dinner"} />
        </Field>
        <Field label="Status">
          <select className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]" defaultValue={event.status} aria-label="Event status">
            <option>Confirmed</option>
            <option>Hold</option>
          </select>
        </Field>
        <Field label="Date">
          <input className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]" defaultValue={event.date} />
        </Field>
        <Field label="Time">
          <input className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]" defaultValue={event.time} />
        </Field>
        <Field label="Hall / Room">
          <input className="mt-1 h-9 w-full rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 text-sm font-medium text-[#17202a]" defaultValue={event.room} />
        </Field>
        <Field label="Guests">
          <input className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]" defaultValue={event.guests} />
        </Field>
        <Field label="Children">
          <input className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]" defaultValue={event.children} />
        </Field>
        <Field label="Couples">
          <input className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-medium text-[#17202a]" defaultValue={event.couples} />
        </Field>
        <Field label="Internal notes" className="sm:col-span-3">
          <textarea
            className="mt-1 min-h-19 w-full rounded-lg border border-[#b9c2cf] bg-white p-3 text-sm font-medium leading-5 text-[#17202a]"
            defaultValue="Confirm final layout and waiter count before the kitchen packet is printed."
          />
        </Field>
      </div>
      <div className="px-3 pb-3">
        <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f]" type="button">
          <LineIcon name="save" className="h-4 w-4" />
          Save event details
        </button>
      </div>
    </section>
  );
}

function TimelineInstructions() {
  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex h-11 items-center justify-between border-b border-[#d8dde5] px-4">
        <div className="flex items-center gap-2">
          <LineIcon name="clock" />
          <h2 className="text-sm font-black text-[#17202a]">Timeline instructions</h2>
        </div>
        <button className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa]" type="button">
          <LineIcon name="plus" />
          Add time
        </button>
      </header>
      <div className="space-y-3 p-3">
        {timelineRows.map(([time, text, type]) => (
          <div key={time} className="grid gap-2 sm:grid-cols-[112px_minmax(0,1fr)_120px_38px]">
            <div className="flex h-10 items-center justify-between rounded-lg border border-[#d8dde5] bg-white px-3 text-sm">
              {time}
              <LineIcon name="clock" className="h-4 w-4" />
            </div>
            <input className="h-10 rounded-lg border border-[#b9c2cf] px-3 text-sm" defaultValue={text} />
            <select className="h-10 rounded-lg border border-[#b9c2cf] px-3 text-sm" defaultValue={type} aria-label={`${time} timeline type`}>
              <option>Event</option>
              <option>Kitchen</option>
              <option>Staff</option>
            </select>
            <button className="flex h-10 items-center justify-center rounded-lg border border-[#b9c2cf] bg-white hover:bg-[#eef4fa]" type="button" aria-label={`Remove ${time}`}>
              <LineIcon name="close" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 px-3 pb-3">
        <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f]" type="button">
          <LineIcon name="save" />
          Save timeline
        </button>
        <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black hover:bg-[#eef4fa]" type="button">
          <LineIcon name="check" />
          Confirm timeline
        </button>
      </div>
    </section>
  );
}

function MenuDishCard({ course, name }: { course: string; name: string }) {
  return (
    <article className="flex h-50 flex-col overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
      <div className="flex flex-1 items-center justify-center bg-[#fbfcfd]">
        <div className="flex h-18 w-18 items-center justify-center rounded-full border border-[#b9c2cf]">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8dde5] bg-white text-[11px] font-black uppercase tracking-[0.08em] text-[#1f4d73]">
            {course}
          </span>
        </div>
      </div>
      <div className="flex h-12 items-center justify-center border-t border-[#d8dde5] px-3">
        <h3 className="truncate text-sm font-black text-[#17202a]">{name}</h3>
      </div>
    </article>
  );
}

function AddMenuCard({ label }: { label: string }) {
  return (
    <button className="flex h-50 flex-col overflow-hidden rounded-lg border border-dashed border-[#b9c2cf] bg-[#fbfcfd] text-[#17202a] hover:border-[#1f4d73] hover:bg-[#eef4fa]" type="button">
      <div className="flex flex-1 items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-[#b9c2cf] bg-white text-[#1f4d73]">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d8dde5]">
            <LineIcon name="plus" className="h-3.5 w-3.5" />
          </span>
        </span>
      </div>
      <div className="flex h-12 w-full items-center justify-center border-t border-[#d8dde5] px-3">
        <span className="truncate text-sm font-black">{label}</span>
      </div>
    </button>
  );
}

function EventMenuContent() {
  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
        <div className="flex items-center gap-2">
          <LineIcon name="document" />
          <h2 className="text-sm font-black text-[#17202a]">Menu for this event</h2>
        </div>
        <button className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f]" type="button">
          <LineIcon name="check" />
          Confirm menu
        </button>
      </header>
      <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {menuItems.map((item) => (
          <MenuDishCard key={item.name} {...item} />
        ))}
        {addMenuItems.map((label) => (
          <AddMenuCard key={label} label={label} />
        ))}
      </div>
    </section>
  );
}

function PortalOptionCard({ title, price, selected = false, highlight = false }: { title: string; price?: string; selected?: boolean; highlight?: boolean }) {
  return (
    <label className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
      <div className={`flex h-20 items-center justify-center rounded-lg border border-[#d8dde5] text-center text-xs font-black uppercase tracking-[0.08em] text-[#516174] ${highlight ? "bg-[#fff2b8]" : "bg-white"}`}>
        {title}
      </div>
      <div className="mt-3 flex items-start gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#516174]">
        <input className="mt-0.5 h-3.5 w-3.5" type={selected ? "radio" : "checkbox"} defaultChecked={selected} name={selected ? "menu-package" : undefined} />
        <span>{title}{price ? <span className="ml-0.5 text-[#17202a]">{price}</span> : null}</span>
      </div>
    </label>
  );
}

function LayoutPreview() {
  const gridStyle = {
    backgroundImage: "linear-gradient(#d8dde5 1px, transparent 1px), linear-gradient(90deg, #d8dde5 1px, transparent 1px)",
    backgroundSize: "22px 22px",
  };

  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white p-4">
      <h2 className="text-sm font-black text-[#17202a]">Layout preview</h2>
      <div className="mt-3 rounded-lg border border-[#d8dde5] p-8" style={gridStyle}>
        <div className="mx-auto grid max-w-96 grid-cols-4 gap-0 text-xs font-black">
          {["Table 1", "Table 2", "Table 5", "Table 6", "Table 3", "Table 4", "Table 7", "Table 8"].map((table) => (
            <div key={table} className="flex h-11 items-center justify-center rounded-full border border-[#17202a] bg-white">
              {table}
            </div>
          ))}
        </div>
        <div className="mx-auto my-2 h-2 max-w-100 rounded-full bg-[#17202a] text-center text-[10px] font-black leading-2 text-white">Mechitza</div>
        <div className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-8 text-xs font-black">
          {["Buffet", "Head table", "Drinks"].map((label) => (
            <div key={label} className="flex h-11 items-center justify-center rounded-lg border border-[#17202a] bg-white">
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClientPortalContent({ event }: { event: EventFile }) {
  return (
    <div className="grid gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <section className="rounded-lg border border-[#d8dde5] bg-white">
          <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
            <LineIcon name="files" />
            <h2 className="text-sm font-black text-[#17202a]">Client sharing checklist</h2>
          </header>
          <div className="space-y-2 p-3">
            {portalChecklist.map(([label, shared]) => (
              <label key={label} className="flex h-11 items-center gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 text-sm font-black text-[#17202a]">
                <input className="h-4 w-4 accent-[#1f4d73]" type="checkbox" defaultChecked={shared} />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="text-xs font-medium text-[#6a7483]">{shared ? "Shared" : "Hidden"}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
          <h2 className="text-sm font-black text-[#17202a]">Client portal link</h2>
          <input className="mt-3 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm" defaultValue="https://eventcore.app/client/e1" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white" type="button">
              <LineIcon name="document" />
              Generate link
            </button>
            <button className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black" type="button">
              <LineIcon name="files" />
              Copy link
            </button>
          </div>
        </section>
      </aside>

      <section className="rounded-lg border border-[#d8dde5] bg-white">
        <header className="rounded-t-lg bg-[#1f4d73] p-6 text-white">
          <h1 className="text-2xl font-black">{event.title}</h1>
          <p className="mt-2 text-sm font-semibold">{event.date} - {event.time} - {event.room}</p>
        </header>
        <div className="space-y-3 p-4">
          <section className="rounded-lg border border-[#d8dde5] p-4">
            <h2 className="text-sm font-black">Event details</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3"><strong>Status</strong><p className="mt-1 text-sm text-[#6a7483]">{event.status}</p></div>
              <div className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3"><strong>Hall</strong><p className="mt-1 text-sm text-[#6a7483]">{event.room}</p></div>
            </div>
          </section>

          <section className="rounded-lg border border-[#d8dde5] p-4">
            <h2 className="text-sm font-black">Guest count</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ["Couples", event.couples],
                ["Children", event.children],
                ["Extra guests", "0"],
              ].map(([label, value]) => (
                <Field key={label} label={label}>
                  <input className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm font-medium text-[#17202a]" defaultValue={value} />
                </Field>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[#d8dde5] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">Menu selection</h2>
              <Badge tone="green">client selectable</Badge>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PortalOptionCard title="Standard dinner" price="Included" selected />
              <PortalOptionCard title="Premium dinner" price="$1,800.00" />
              <PortalOptionCard title="Gold dinner" price="$3,500.00" />
              <PortalOptionCard title="Dairy buffet" price="$1,200.00" />
            </div>
          </section>

          <section className="rounded-lg border border-[#d8dde5] p-4">
            <h2 className="text-sm font-black">Tablecloth options</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PortalOptionCard title="Ivory linen" price="$300.00" />
              <PortalOptionCard title="White linen" price="Included" />
              <PortalOptionCard title="Gold runner" price="$450.00" highlight />
              <PortalOptionCard title="Velvet accent" price="$650.00" />
            </div>
          </section>

          <section className="rounded-lg border border-[#d8dde5] p-4">
            <h2 className="text-sm font-black">Add-ons</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PortalOptionCard title="Coffee station" price="$350.00" />
              <PortalOptionCard title="Sweet table" price="$900.00" />
              <PortalOptionCard title="Extra buffet" price="$750.00" />
              <PortalOptionCard title="Late night snacks" price="$600.00" />
            </div>
          </section>

          <LayoutPreview />

          <section className="rounded-lg border border-[#d8dde5] p-4">
            <h2 className="text-sm font-black">Payment</h2>
            <button className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white" type="button">
              <LineIcon name="document" />
              Pay balance
            </button>
          </section>

          <div className="flex items-center justify-between rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-4">
            <span className="text-sm text-[#17202a]">Estimated client total</span>
            <strong className="text-xl text-[#17202a]">$55,200.00</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

function BillingStatCard({ label, value, note, icon, emphasized = false }: { label: string; value: string; note: string; icon: IconName; emphasized?: boolean }) {
  return (
    <article className={`min-h-27 rounded-lg border bg-white p-3 ${emphasized ? "border-[#1f4d73] shadow-sm shadow-[#1f4d73]/10" : "border-[#d8dde5]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">{label}</p>
          <p className={`mt-2 text-xl font-black ${emphasized ? "text-[#9a5b00]" : "text-[#17202a]"}`}>{value}</p>
          <p className="mt-2 text-xs text-[#6a7483]">{note}</p>
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#6a7483]">
          <LineIcon name={icon} className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

function EventBillingContent() {
  const invoices = [
    ["INV-1028", "Open", "$48,200.00", "$18,000.00", "$30,200.00"],
    ["RET-881", "Paid", "$7,000.00", "$7,000.00", "$0.00"],
  ];

  const transactions = [
    ["Jun 24", "ACH Friedman", "$15,000.00", "Event Deposit"],
    ["Jun 25", "Premium Linen Co.", "$-1,840.00", "Linen Rental"],
    ["Jun 27", "Refund adjustment", "$-600.00", "Refund"],
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BillingStatCard label="Total event" value="$55,200.00" note="Invoice total" icon="document" />
        <BillingStatCard label="Open balance" value="$30,200.00" note="Click to open outstanding balance" icon="document" emphasized />
        <BillingStatCard label="Payments" value="$25,000.00" note="Recorded on event" icon="document" />
        <BillingStatCard label="Transactions" value="3" note="Assigned records" icon="files" />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_336px]">
        <section className="rounded-lg border border-[#d8dde5] bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
            <div className="flex items-center gap-2">
              <LineIcon name="document" />
              <h2 className="text-sm font-black text-[#17202a]">Invoices for this event</h2>
            </div>
            <button className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f]" type="button">
              <LineIcon name="plus" />
              Create invoice
            </button>
          </header>
          <div className="overflow-x-auto p-3">
            <table className="w-full min-w-130 text-left text-sm">
              <thead className="bg-[#fbfcfd] text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
                <tr>
                  {["Invoice", "Status", "Total", "Paid", "Balance"].map((head) => (
                    <th key={head} className="border-b border-[#d8dde5] px-2 py-3">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(([invoice, status, total, paid, balance]) => (
                  <tr key={invoice} className="border-b border-[#d8dde5] last:border-b-0">
                    <td className="px-2 py-3 font-black text-[#17202a]">{invoice}</td>
                    <td className="px-2 py-3">{status}</td>
                    <td className="px-2 py-3">{total}</td>
                    <td className="px-2 py-3">{paid}</td>
                    <td className="px-2 py-3 text-right font-black">{balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-[#d8dde5] bg-white">
          <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
            <LineIcon name="document" />
            <h2 className="text-sm font-black text-[#17202a]">Actions</h2>
          </header>
          <div className="space-y-3 p-3">
            <Field label="Payment amount">
              <input className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm font-medium text-[#17202a]" defaultValue="5000" />
            </Field>
            {["Record payment", "Client statement"].map((action) => (
              <button key={action} className="flex h-12 w-full items-center gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 text-left text-sm font-black text-[#17202a] hover:bg-[#eef4fa]" type="button">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#1f4d73]">
                  <LineIcon name="document" />
                </span>
                <span className="min-w-0 flex-1 truncate">{action}</span>
                <LineIcon name="chevron" className="h-4 w-4 text-[#17202a]" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-[#d8dde5] bg-white">
        <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
          <LineIcon name="files" />
          <h2 className="text-sm font-black text-[#17202a]">Transaction history</h2>
        </header>
        <div className="overflow-x-auto p-3">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="bg-[#fbfcfd] text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
              <tr>
                {["Date", "Source", "Amount", "Category"].map((head) => (
                  <th key={head} className="border-b border-[#d8dde5] px-2 py-3">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map(([date, source, amount, category]) => (
                <tr key={`${date}-${source}`} className="border-b border-[#d8dde5] last:border-b-0">
                  <td className="px-2 py-3">{date}</td>
                  <td className="px-2 py-3 font-black text-[#17202a]">{source}</td>
                  <td className="px-2 py-3 text-right font-black">{amount}</td>
                  <td className="px-2 py-3">{category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function HallMapContent() {
  const layoutRows = [
    ["03:00 PM", "Setup layout"],
    ["06:30 PM", "Guest arrival layout"],
    ["08:00 PM", "Dinner service layout"],
  ];

  const gridStyle = {
    backgroundImage: "linear-gradient(#d8dde5 1px, transparent 1px), linear-gradient(90deg, #d8dde5 1px, transparent 1px)",
    backgroundSize: "22px 22px",
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <section className="rounded-lg border border-[#d8dde5] bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
            <div className="flex items-center gap-2">
              <LineIcon name="clock" />
              <h2 className="text-sm font-black text-[#17202a]">Timeline layouts</h2>
            </div>
            <button className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa]" type="button">
              <LineIcon name="plus" />
              Add layout
            </button>
          </header>
          <div className="space-y-2 p-3">
            {layoutRows.map(([time, label], index) => (
              <button
                key={time}
                className={`grid w-full grid-cols-[104px_minmax(0,1fr)] gap-2 rounded-lg border p-2 text-left ${
                  index === 0 ? "border-[#1f4d73] bg-[#eef4fa]" : "border-[#d8dde5] bg-white hover:bg-[#fbfcfd]"
                }`}
                type="button"
              >
                <span className="flex h-9 items-center justify-between rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm">
                  {time}
                  <LineIcon name="clock" className="h-3.5 w-3.5" />
                </span>
                <span className="flex h-9 min-w-0 items-center rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm">
                  <span className="truncate">{label}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#d8dde5] bg-white p-3 text-sm leading-5 text-[#17202a]">
          Hall map is view-only inside the event. Edit the timing or layout name here. To change the actual room layout, open the official Hall Map editor.
        </section>

        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f]" type="button">
          <LineIcon name="map" />
          Edit layout
        </button>
      </aside>

      <section className="rounded-lg border border-[#d8dde5] bg-white">
        <header className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <LineIcon name="map" />
            <h2 className="text-sm font-black text-[#17202a]">Setup layout</h2>
          </div>
          <Badge tone="gold">Needs final review</Badge>
        </header>
        <div className="px-4 pb-4">
          <div className="min-h-80 rounded-lg border border-[#d8dde5] p-12" style={gridStyle}>
            <div className="mx-auto grid max-w-md grid-cols-4 gap-x-4 gap-y-6 text-xs font-black">
              {["Table 1", "Table 2", "Table 5", "Table 6", "Table 3", "Table 4", "Table 7", "Table 8"].map((table) => (
                <div key={table} className="flex h-12 items-center justify-center rounded-full border border-[#17202a] bg-white">
                  {table}
                </div>
              ))}
            </div>
            <div className="mx-auto my-10 h-2 max-w-md rounded-full bg-[#17202a] text-center text-[10px] font-black leading-2 text-white">Mechitza</div>
            <div className="mx-auto mt-20 grid max-w-2xl grid-cols-3 gap-24 text-xs font-black">
              {["Buffet", "Head table", "Drinks"].map((label) => (
                <div key={label} className="flex h-9 items-center justify-center rounded-lg border border-[#17202a] bg-white">
                  {label}
                </div>
              ))}
            </div>
          </div>
          <button className="mt-3 inline-flex h-8 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa]" type="button">
            <LineIcon name="check" />
            Confirm hall map
          </button>
        </div>
      </section>
    </div>
  );
}

function KitchenItemCard({ title, amount, status, note }: { title: string; amount: string; status: string; note: string }) {
  const statusClass = status === "COMPLETE" ? "text-[#146c43]" : status === "IN PROGRESS" ? "text-[#9a5b00]" : "text-[#17202a]";

  return (
    <article className="w-27 border border-[#d8dde5] bg-white p-3">
      <h3 className="border-b border-[#d8dde5] pb-3 text-center text-lg font-black leading-4 text-[#17202a]">{title}</h3>
      <p className="mt-3 text-xs font-black text-[#17202a]">{amount}</p>
      <p className={`mt-1 text-[11px] font-black uppercase tracking-[0.08em] ${statusClass}`}>{status}</p>
      <p className="mt-2 text-[11px] leading-4 text-[#6a7483]">{note}</p>
    </article>
  );
}

function EventKitchenContent() {
  const kitchenItems = [
    ["Challah rolls", "240", "COMPLETE", "Already prepared"],
    ["Chicken soup", "120 bowls", "IN PROGRESS", "Already in progress"],
    ["Braised short ribs", "24 trays", "PENDING", "Changes still allowed"],
    ["Potato kugel", "18 pans", "PENDING", "Changes still allowed"],
    ["Children schnitzel", "38 portions", "PENDING", "Changes still allowed"],
  ];

  return (
    <div className="space-y-3">
      <section className="bg-[#a9a9a9] p-4 text-[#17202a]">
        <div className="flex flex-wrap items-start gap-3">
          <button className="inline-flex h-10 items-center gap-3 bg-white px-4 text-sm font-black" type="button">
            <LineIcon name="chevron" />
            Main Menu
          </button>
          <button className="flex h-10 w-10 items-center justify-center bg-white" type="button" aria-label="Kitchen document">
            <LineIcon name="document" />
          </button>
          <button className="flex h-10 w-10 items-center justify-center bg-white" type="button" aria-label="Previous day">
            <LineIcon name="chevron" className="h-4 w-4 rotate-180" />
          </button>
          <h2 className="flex h-10 items-center text-2xl font-black">Wednesday, July 8, 2026</h2>
          <button className="flex h-10 w-10 items-center justify-center bg-white" type="button" aria-label="Next day">
            <LineIcon name="chevron" />
          </button>
          <button className="h-10 bg-white px-4 text-sm font-black" type="button">Today</button>
          <div className="ml-auto flex flex-wrap gap-3">
            <button className="h-10 bg-[#f5c542] px-5 text-sm font-black" type="button">Today</button>
            <button className="h-10 bg-white px-5 text-sm font-black" type="button">This Week</button>
            <button className="h-10 bg-white px-5 text-sm font-black" type="button">4 Weeks</button>
          </div>
        </div>
        <p className="mt-3 text-2xl font-black text-[#ffe36e]">3:56 PM</p>
      </section>

      <button className="flex h-11 w-full items-center gap-3 border border-[#d8dde5] bg-white px-4 text-sm font-black text-[#6a7483]" type="button">
        <LineIcon name="plus" />
        Kitchen live view
      </button>

      <section className="border border-[#b9c2cf] bg-[#d8eeee] p-4">
        <div className="border border-[#b9c2cf] bg-[#d8eeee] p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
            <div className="border-l-5 border-[#21b8ae] pl-5">
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[#17202a]">Friedman Wedding</p>
              <h2 className="mt-4 text-2xl font-black text-[#001a33]">278 portions</h2>
              <button className="mt-3 inline-flex h-7 items-center gap-2 border border-[#c77cff] bg-[#f7eaff] px-3 text-xs font-black text-[#8a3fd1]" type="button">
                <LineIcon name="document" className="h-3.5 w-3.5" />
                Kitchen live
              </button>
              <p className="mt-4 text-sm font-black uppercase tracking-[0.12em] text-[#516174]">Gold dinner menu assigned</p>
              <div className="mt-3 border border-[#e6c35c] bg-[#fff7d7] px-3 py-2 text-sm font-black text-[#9a5b00]">Needs it ready for 6:30 PM</div>
              <p className="mt-4 max-w-md text-xs leading-5 text-[#1f4d73]">
                Read-only event view. This reflects the kitchen in real time. Kitchen is already in progress. Items already started are no longer changeable.
              </p>
            </div>

            <div className="flex flex-wrap items-start gap-3">
              {kitchenItems.map(([title, amount, status, note]) => (
                <KitchenItemCard key={title} title={title} amount={amount} status={status} note={note} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function EventVendorsContent() {
  const vendorRows = [
    { vendor: "Royal Linen", order: "Tablecloth order", status: "Pending", notes: "Need ivory count" },
    { vendor: "Sweet House", order: "Dessert cups", status: "Confirmed", notes: "Delivery 4:30 PM" },
  ];

  return (
    <section className="min-h-107.5 rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
        <div className="flex items-center gap-2">
          <LineIcon name="store" className="h-4 w-4 text-[#17202a]" />
          <h2 className="text-sm font-black text-[#17202a]">Vendors for this event</h2>
        </div>
        <button
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm shadow-[#1f4d73]/20 hover:bg-[#15344f]"
          type="button"
        >
          <LineIcon name="plus" className="h-3.5 w-3.5" />
          Add vendor order
        </button>
      </header>

      <div className="overflow-x-auto p-3">
        <table className="w-full min-w-190 text-left text-sm">
          <thead className="bg-[#fbfcfd] text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
            <tr className="border-b border-[#d8dde5]">
              <th className="px-2 py-3">Vendor</th>
              <th className="px-2 py-3">Order</th>
              <th className="px-2 py-3">Status</th>
              <th className="px-2 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="text-[#17202a]">
            {vendorRows.map((row) => (
              <tr key={row.vendor} className="border-b border-[#d8dde5] last:border-b-0">
                <td className="px-2 py-3 font-black">{row.vendor}</td>
                <td className="px-2 py-3">{row.order}</td>
                <td className="px-2 py-3">
                  <Badge tone={row.status === "Confirmed" ? "green" : "gold"}>{row.status}</Badge>
                </td>
                <td className="px-2 py-3">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EventFilesContent() {
  const [selectedFileCategory, setSelectedFileCategory] = useState("All files");

  const categories = [
    { label: "All files", count: 3 },
    { label: "Contracts", count: 1 },
    { label: "Billing / Invoices", count: 0 },
    { label: "Hall Map / Layouts", count: 1 },
    { label: "Menus", count: 1 },
    { label: "Client Portal", count: 0 },
    { label: "Vendors", count: 0 },
    { label: "Kitchen", count: 0 },
    { label: "General", count: 0 },
  ];

  const files = [
    { title: "Signed agreement.pdf", category: "Contracts", type: "Contract", date: "Jun 12" },
    { title: "Grand Hall layout.pdf", category: "Hall Map / Layouts", type: "Layout", date: "Jun 27" },
    { title: "Client menu approval.pdf", category: "Menus", type: "Menu", date: "Jun 29" },
  ];
  const visibleFiles = selectedFileCategory === "All files" ? files : files.filter((file) => file.category === selectedFileCategory);

  return (
    <div className="grid min-h-107.5 gap-3 rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
        {categories.map((category) => {
          const isActive = selectedFileCategory === category.label;

          return (
            <button
              key={category.label}
              className={`flex h-9.75 w-full items-center gap-2 border-b border-[#d8dde5] px-4 text-left text-sm last:border-b-0 ${
                isActive ? "bg-[#eef4fa] font-black text-[#17202a]" : "text-[#17202a] hover:bg-[#eef4fa]"
              }`}
              type="button"
              onClick={() => setSelectedFileCategory(category.label)}
            >
              <LineIcon
                name={category.label === "All files" ? "files" : "chevron"}
                className={`h-4 w-4 shrink-0 ${isActive ? "text-[#1f4d73]" : "text-[#17202a]"}`}
              />
              <span className="min-w-0 flex-1 truncate">{category.label}</span>
              <span className="text-xs font-normal text-[#17202a]">{category.count}</span>
            </button>
          );
        })}
      </aside>

      <section className="overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
          <div className="flex items-center gap-2">
            <LineIcon name="files" className="h-4 w-4 text-[#17202a]" />
            <h2 className="text-sm font-black text-[#17202a]">{selectedFileCategory}</h2>
          </div>
          <button
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-sm shadow-[#1f4d73]/20 hover:bg-[#15344f]"
            type="button"
          >
            <LineIcon name="upload" className="h-3.5 w-3.5" />
            Upload file
          </button>
        </header>

        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleFiles.map((file) => (
            <article key={file.title} className="flex min-h-28 flex-col justify-between rounded-lg border border-[#d8dde5] bg-white p-4">
              <div>
                <h3 className="text-sm font-black text-[#17202a]">{file.title}</h3>
                <p className="mt-1 text-xs text-[#6a7483]">{file.category}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="inline-flex h-5 items-center rounded-full border border-[#b9c2cf] bg-[#eef4fa] px-2 text-[11px] font-black text-[#1f4d73]">
                  {file.type}
                </span>
                <span className="inline-flex h-5 items-center rounded-full border border-[#b9c2cf] bg-[#fbfcfd] px-2 text-[11px] font-black text-[#17202a]">
                  {file.date}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function EventTabPlaceholder({ label }: { label: string }) {
  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white p-6">
      <h2 className="text-sm font-black text-[#17202a]">{label}</h2>
      <p className="mt-2 text-sm text-[#6a7483]">This event section is ready for the next workspace panel.</p>
    </section>
  );
}

function EventWorkspace({ event }: { event: EventFile }) {
  const [activeTab, setActiveTab] = useState<EventWorkspaceTab>("Event details");
  const [isPrintPacketOpen, setIsPrintPacketOpen] = useState(false);
  const [isPortalPreviewOpen, setIsPortalPreviewOpen] = useState(false);

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-[#d8dde5] bg-[#fbfcfd]">
      <header className="shrink-0 border-b border-[#d8dde5] bg-white p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <LineIcon name="calendar" />
              <h1 className="truncate text-xl font-black text-[#17202a]">{event.title}</h1>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="green">Confirmed</Badge>
              <Badge tone="gold">Open balance {event.balance}</Badge>
              <Badge tone="gold">Today notes unread</Badge>
              <Badge tone="gold">Needs review</Badge>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-2">
            <ActionButton icon="document" onClick={() => setIsPortalPreviewOpen(true)}>Preview portal</ActionButton>
            <ActionButton icon="printer" onClick={() => setIsPrintPacketOpen(true)} primary>Print packet</ActionButton>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryTile label="Guests" value={event.guests} icon="guests" />
          <SummaryTile label="Couples" value={event.couples} icon="couples" />
          <SummaryTile label="Menu" value="Confirmed" icon="document" />
          <SummaryTile label="Layout" value="Needs final review" icon="map" />
          <SummaryTile label="Open balance" value={event.balance} icon="document" emphasized />
          <SummaryTile label="Today notes" value="Unread" icon="files" emphasized />
        </div>
      </header>

      <PrintPacketDrawer
        event={{ title: event.title, date: event.date, room: event.room }}
        onClose={() => setIsPrintPacketOpen(false)}
        open={isPrintPacketOpen}
      />
      <ClientPortalPreviewDrawer
        event={{ title: event.title, date: event.date, room: event.room, balance: event.balance }}
        onClose={() => setIsPortalPreviewOpen(false)}
        open={isPortalPreviewOpen}
      />

      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#d8dde5] bg-white px-3">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            className={`inline-flex h-10 shrink-0 items-center gap-2 border-b-3 px-2 text-xs font-black ${
              activeTab === tab.label ? "border-[#1f4d73] text-[#17202a]" : "border-transparent text-[#17202a] hover:bg-[#eef4fa]"
            }`}
            type="button"
            onClick={() => setActiveTab(tab.label)}
          >
            <LineIcon name={tab.icon} className="h-3.5 w-3.5 text-[#516174]" />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "Event details" ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_336px]">
            <div className="space-y-3">
              <EventInformation event={event} />
              <TimelineInstructions />
            </div>
            <aside className="space-y-3">
              <ClientContact />
              <ReadinessPanel />
            </aside>
          </div>
        ) : null}

        {activeTab === "Menu" ? <EventMenuContent /> : null}
        {activeTab === "Client portal" ? <ClientPortalContent event={event} /> : null}
        {activeTab === "Billing" ? <EventBillingContent /> : null}
        {activeTab === "Hall map" ? <HallMapContent /> : null}
        {activeTab === "Kitchen" ? <EventKitchenContent /> : null}
        {activeTab === "Vendors" ? <EventVendorsContent /> : null}
        {activeTab === "Files" ? <EventFilesContent /> : null}
        {!["Event details", "Menu", "Client portal", "Billing", "Hall map", "Kitchen", "Vendors", "Files"].includes(activeTab) ? <EventTabPlaceholder label={activeTab} /> : null}
      </div>
    </section>
  );
}

export function EventManagerPage() {
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(null);
  const [selectedEventTitle, setSelectedEventTitle] = useState(events[0].title);
  const [createdEvents, setCreatedEvents] = useState<EventFile[]>([]);
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const cachedSyncData = getCachedSyncedUser();

    if (cachedSyncData) {
      setSyncData(cachedSyncData);
    }

    async function loadUser() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session?.access_token) {
          clearCachedSyncedUser();
          router.replace("/");
          return;
        }

        const synced = await syncSignedInUser(data.session.access_token);

        if (isMounted) {
          setSyncData(synced);
        }
      } catch {
        if (!cachedSyncData) {
          clearCachedSyncedUser();
          router.replace("/");
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!syncData) {
    return <main className="min-h-screen bg-[#f5f6f8]" aria-busy="true" />;
  }

  const allEvents = [...createdEvents, ...events];
  const selectedEvent = allEvents.find((event) => event.title === selectedEventTitle) ?? allEvents[0];

  const createEvent = (values: NewEventFormValues) => {
    const title = `${values.clientName} ${values.eventType}`.trim();
    const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
      new Date(`${values.date}T00:00:00`),
    );
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
      new Date(`${values.date}T${values.time}:00`),
    );

    const newEvent: EventFile = {
      title,
      date,
      time,
      room: values.room,
      packageName: "Not assigned",
      guests: values.guests,
      children: values.children,
      couples: values.couples,
      coordinator: "Unassigned",
      balance: "$0.00",
      status: values.status,
      paymentStatus: "No invoice",
      notes: values.initialNotes ? [values.initialNotes] : [],
    };

    setCreatedEvents((current) => [newEvent, ...current]);
    setSelectedEventTitle(title);
    setIsNewEventOpen(false);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Event Manager"
        subtitle="Select an event, then manage every connected section from one workspace."
        actionsSlot={
          <button
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#1f4d73] px-4 text-sm font-bold text-white shadow-lg shadow-[#17202a]/15 transition hover:-translate-y-0.5 hover:bg-[#15344f] 2xl:px-5"
            onClick={() => setIsNewEventOpen(true)}
            type="button"
          >
            <LineIcon name="plus" />
            New event
          </button>
        }
      />

      <NewEventDialog onClose={() => setIsNewEventOpen(false)} onCreate={createEvent} open={isNewEventOpen} />

      <div className="min-h-0 flex-1 p-3">
      <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#d8dde5] p-3">
            <div>
              <div className="flex items-center gap-2">
                <LineIcon name="calendar" />
                <h2 className="text-sm font-black text-[#17202a]">Events</h2>
              </div>
              <p className="mt-1 text-xs text-[#6a7483]">{allEvents.length} records</p>
            </div>
            <button className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa]" type="button">
              <LineIcon name="close" />
              Clear
            </button>
          </header>

          <div className="shrink-0 border-b border-[#d8dde5] p-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_136px] xl:grid-cols-[minmax(0,1fr)_136px]">
              <input className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a]" placeholder="Search client, hall, type" />
              <select className="h-9 min-w-34 rounded-lg border border-[#b9c2cf] bg-white pl-3 pr-8 text-sm text-[#17202a]" aria-label="Event filter" defaultValue="All events">
                <option>All events</option>
                <option>Confirmed</option>
                <option>Hold</option>
              </select>
            </div>
            <select className="mt-2 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a]" aria-label="Room filter" defaultValue="All rooms">
              <option>All rooms</option>
              <option>Grand Hall</option>
              <option>Nachlas Yehuda A</option>
              <option>Terrace Room</option>
            </select>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {allEvents.map((event) => (
              <EventListCard
                key={event.title}
                event={event}
                selected={event.title === selectedEvent.title}
                onClick={() => setSelectedEventTitle(event.title)}
              />
            ))}
          </div>
        </aside>

        <EventWorkspace event={selectedEvent} />
      </div>
      </div>
    </div>
  );
}
