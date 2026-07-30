"use client";

import { type ReactNode } from "react";

export type StaffStatus = "Active" | "Inactive";
export type RoleName =
  | "Administrator"
  | "Event Manager"
  | "Kitchen Staff"
  | "Billing Staff"
  | "Viewer";
export type IconName =
  | "users"
  | "building"
  | "roles"
  | "search"
  | "more"
  | "phone"
  | "folder"
  | "shield"
  | "check"
  | "edit"
  | "eye"
  | "plus";

export type StaffMember = {
  id: string;
  initials: string;
  name: string;
  email: string;
  department: string;
  role: RoleName;
  status: StaffStatus;
  lastLogin: string;
  phone: string;
  color: string;
};

export type StaffResponse = {
  staff: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    department: string;
    role: string;
    status: StaffStatus;
    createdAt: string;
  }>;
};

export const roleTemplates: Array<{ role: RoleName; description: string }> = [
  { role: "Administrator", description: "Full access" },
  { role: "Event Manager", description: "Manage events" },
  { role: "Kitchen Staff", description: "Kitchen access" },
  { role: "Billing Staff", description: "Billing access" },
  { role: "Viewer", description: "Read only" }
];

export const roleColors: Record<RoleName, string> = {
  Administrator: "border-[#9bc8f2] bg-[#edf6ff] text-[#1769aa]",
  "Event Manager": "border-[#a9dfc9] bg-[#effaf5] text-[#147653]",
  "Kitchen Staff": "border-[#efd39d] bg-[#fff7e8] text-[#a45f00]",
  "Billing Staff": "border-[#d2c6f7] bg-[#f5f2ff] text-[#6550c4]",
  Viewer: "border-[#cdd5df] bg-[#f4f6f8] text-[#536172]"
};

export const permissionColumns = [
  "Dashboard",
  "Events",
  "Kitchen",
  "Menu",
  "Billing",
  "Staff",
  "Files",
  "Clients",
  "Settings"
];

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
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };
  const icons: Record<IconName, ReactNode> = {
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19M16 5.5a3 3 0 0 1 0 5.5M17 13a4.5 4.5 0 0 1 3.5 4.4V19" />
      </>
    ),
    building: (
      <>
        <path d="M4 21V6l8-3 8 3v15M8 9h2M14 9h2M8 13h2M14 13h2M9 21v-4h6v4" />
      </>
    ),
    roles: (
      <>
        <circle cx="8" cy="8" r="3" />
        <path d="M3 20v-2a5 5 0 0 1 10 0v2M16 7h5M18.5 4.5v5M16 14h5M16 18h5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    more: (
      <>
        <circle cx="12" cy="5" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="19" r="1" fill="currentColor" />
      </>
    ),
    phone: (
      <path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c0 1-1 2-2 2A16 16 0 0 1 3 5c0-1 1-2 2-2Z" />
    ),
    folder: <path d="M3 6h7l2 2h9v11H3Z" />,
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    check: <path d="m6 12 4 4 8-9" />,
    edit: (
      <>
        <path d="m14 5 5 5M4 20l4-1 11-11-4-4L4 15Z" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />
  };
  return <svg {...common}>{icons[name]}</svg>;
}

export function RoleBadge({ role }: { role: RoleName }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-black ${roleColors[role]}`}
    >
      {role}
    </span>
  );
}

export function StatusBadge({ status }: { status: StaffStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black ${status === "Active" ? "border-[#a9dfc9] bg-[#effaf5] text-[#147653]" : "border-[#f2b7ba] bg-[#fff2f2] text-[#d63740]"}`}
    >
      {status}
    </span>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex min-h-14 flex-col items-stretch justify-between gap-3 border-b border-[#d8dde5] px-3 py-3 sm:flex-row sm:items-center sm:px-4">
      <div className="min-w-0">
        <h2 className="text-sm font-black">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-[10px] text-[#6a7483]">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="min-w-0">{action}</div> : null}
    </header>
  );
}

export const secondaryButtonClass =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-black text-[#233144] shadow-sm transition hover:bg-[#eef4fa]";
