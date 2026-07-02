"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearCachedSyncedUser, getCachedSyncedUser, syncSignedInUser, type SyncSignedInUserResponse } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SettingsSectionId =
  | "platform-settings"
  | "halls"
  | "hall-performance"
  | "user-types"
  | "user-access"
  | "feature-access"
  | "payments-gmail"
  | "google-calendar";

type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  pageTitle: string;
  path: string;
  icon: "gear" | "hall" | "chart" | "users" | "shield" | "key" | "mail" | "calendar";
};

type PlatformSettingsPageProps = {
  initialActiveItem?: string;
};

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "platform-settings",
    label: "Platform Settings",
    pageTitle: "Platform Settings",
    path: "/dashboard/settings",
    icon: "gear"
  },
  {
    id: "halls",
    label: "Halls",
    pageTitle: "Halls",
    path: "/dashboard/settings/halls",
    icon: "hall"
  },
  {
    id: "hall-performance",
    label: "Hall Performance",
    pageTitle: "Hall Performance",
    path: "/dashboard/settings/hall-performance",
    icon: "chart"
  },
  {
    id: "user-types",
    label: "User Types",
    pageTitle: "User Types / Role Templates",
    path: "/dashboard/settings/user-types",
    icon: "users"
  },
  {
    id: "user-access",
    label: "User Access",
    pageTitle: "User Access",
    path: "/dashboard/settings/user-access",
    icon: "shield"
  },
  {
    id: "feature-access",
    label: "Feature Access",
    pageTitle: "Feature Access Control",
    path: "/dashboard/settings/feature-access",
    icon: "key"
  },
  {
    id: "payments-gmail",
    label: "Payments / Gmail",
    pageTitle: "Payments / Gmail",
    path: "/dashboard/settings/payments-gmail",
    icon: "mail"
  },
  {
    id: "google-calendar",
    label: "Google Calendar",
    pageTitle: "Google Calendar",
    path: "/dashboard/settings/google-calendar",
    icon: "calendar"
  }
];

function resolveSettingsSectionId(value: string): SettingsSectionId {
  return SETTINGS_SECTIONS.find((section) => section.id === value || section.label === value)?.id ?? "platform-settings";
}

const halls = [
  {
    name: "Hall 1",
    description: "Default active bookable hall"
  },
  {
    name: "Hall 2",
    description: "Default active bookable hall"
  },
  {
    name: "Hall 3",
    description: "New active bookable hall using platform defaults"
  }
];

const userTypes = [
  {
    name: "Admin",
    description: "All permissions enabled",
    icon: "shield" as const,
    iconClassName: "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]",
    badges: [
      { label: "System Default", icon: "check" as const, className: "border-[#A7F3D0] bg-[#ECFDF5] text-[#027A48]" },
      { label: "All Halls", icon: "hall" as const, className: "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]" }
    ]
  },
  {
    name: "Hall Secretary",
    description: "Calendar, booking, event manager, payment email",
    icon: "users" as const,
    iconClassName: "border-[#E5E0D6] bg-[#F7F4ED] text-[#B9974D]",
    badges: [
      { label: "Template", icon: "clipboard" as const, className: "border-[#EBD6A7] bg-[#FFF8E8] text-[#B07A12]" },
      { label: "Selected Halls", icon: "hall" as const, className: "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]" }
    ]
  },
  {
    name: "Kitchen Worker",
    description: "Kitchen dashboard only, no payment visibility",
    icon: "kitchen" as const,
    iconClassName: "border-[#FED7AA] bg-[#FFF4E8] text-[#D97706]",
    badges: [
      { label: "Template", icon: "clipboard" as const, className: "border-[#EBD6A7] bg-[#FFF8E8] text-[#B07A12]" },
      { label: "No Payment Info", icon: "info" as const, className: "border-[#FDBA74] bg-[#FFF7ED] text-[#C2410C]" }
    ]
  }
];

const userAccessRows = [
  {
    name: "Admin User",
    email: "admin@example.com",
    icon: "users" as const,
    iconClassName: "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]",
    badges: [
      { label: "Admin", icon: "shield" as const, className: "border-[#A7F3D0] bg-[#ECFDF5] text-[#027A48]" },
      { label: "All Halls", icon: "hall" as const, className: "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]" }
    ],
    actions: ["Edit", "Resend Invite"] as const
  },
  {
    name: "Kitchen Staff",
    email: "kitchen@example.com",
    icon: "kitchen" as const,
    iconClassName: "border-[#E5E0D6] bg-[#F7F4ED] text-[#B9974D]",
    badges: [
      { label: "Kitchen Worker", icon: "users" as const, className: "border-[#EBD6A7] bg-[#FFF8E8] text-[#B07A12]" },
      { label: "Hall 1 + Hall 2", icon: "hall" as const, className: "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]" }
    ],
    actions: ["Edit", "Deactivate"] as const
  }
];

const featureAccessRows = [
  {
    name: "Home",
    description: "Cards, summaries, new booking button",
    icon: "home" as const,
    iconClassName: "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]",
    permissions: { view: true, create: true, edit: false, delete: false, manage: false }
  },
  {
    name: "Kitchen Dashboard",
    description: "Today, week, workers, item statuses",
    icon: "kitchen" as const,
    iconClassName: "border-[#EBD6A7] bg-[#FFF8E8] text-[#B9974D]",
    permissions: { view: true, create: false, edit: true, delete: false, manage: false }
  },
  {
    name: "Event Calendar",
    description: "Month view, plus booking, event details",
    icon: "calendar" as const,
    iconClassName: "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]",
    permissions: { view: true, create: true, edit: false, delete: false, manage: false }
  },
  {
    name: "Event Manager",
    description: "Search, edit, status, payment, PDF",
    icon: "users" as const,
    iconClassName: "border-[#DDD6FE] bg-[#F4F0FF] text-[#6D5DF6]",
    permissions: { view: true, create: false, edit: true, delete: false, manage: false }
  },
  {
    name: "Menu",
    description: "Menu items, packages, add-ons",
    icon: "utensils" as const,
    iconClassName: "border-[#EBD6A7] bg-[#FFF8E8] text-[#B9974D]",
    permissions: { view: true, create: false, edit: false, delete: false, manage: false }
  },
  {
    name: "Settings",
    description: "Platform, halls, users, user types",
    icon: "gear" as const,
    iconClassName: "border-[#CBD5E1] bg-[#F1F5F9] text-[#64748B]",
    permissions: { view: false, create: false, edit: false, delete: false, manage: false }
  },
  {
    name: "Payments / Gmail",
    description: "Payment status, payment emails, sender settings",
    icon: "mail" as const,
    iconClassName: "border-[#BBF7D0] bg-[#ECFDF5] text-[#027A48]",
    permissions: { view: true, create: false, edit: false, delete: false, manage: false }
  },
  {
    name: "PDF / Uploads",
    description: "Generate PDFs, upload layout/paper",
    icon: "file" as const,
    iconClassName: "border-[#DDD6FE] bg-[#F4F0FF] text-[#6D5DF6]",
    permissions: { view: true, create: true, edit: true, delete: false, manage: false }
  }
];

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function formatRole(role: string) {
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function LineIcon({ name, className = "h-5 w-5" }: { name: SettingsSection["icon"] | "home" | "bell" | "help" | "save" | "back" | "upload" | "trash" | "info" | "plus" | "edit" | "copy" | "check" | "clipboard" | "kitchen" | "grid" | "send" | "arrow" | "eye" | "file" | "utensils" | "lock" | "x" | "link" | "sync"; className?: string }) {
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

  const paths = {
    gear: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19 15 2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.6-1L14.6 7h-5.2L9 10a7 7 0 0 0-1.6 1L5 10l-2 3.5L5 15a7 7 0 0 0 0 2l-2 1.5L5 22l2.4-1a7 7 0 0 0 1.6 1l.4 3h5.2l.4-3a7 7 0 0 0 1.6-1l2.4 1 2-3.5L19 17a7 7 0 0 0 0-2Z" /></>,
    hall: <><path d="M4 20h16M6 20V9l6-4 6 4v11" /><path d="M9 20v-6h6v6M8 11h8" /></>,
    chart: <><path d="M4 19h16M7 16V9M12 16V5M17 16v-7" /><path d="m15 7 2-2 2 2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    shield: <><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6Z" /><path d="m9 12 2 2 4-5" /></>,
    key: <><path d="M15 7a4 4 0 1 0 2 3.5L22 5l-3-3-5.5 5Z" /><path d="m14 8 2 2" /></>,
    mail: <><path d="M4 6h16v12H4Z" /><path d="m4 7 8 6 8-6" /></>,
    calendar: <><path d="M4 6h16v14H4ZM8 3v5M16 3v5M4 11h16" /></>,
    home: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z" />,
    bell: <><path d="M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3Z" /><path d="M10 21h4" /></>,
    help: <><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="M9.8 9a2.4 2.4 0 0 1 4.4 1.3c0 1.8-2.2 2-2.2 3.7M12 17h.01" /></>,
    save: <><path d="M5 3h12l2 2v16H5Z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>,
    back: <path d="M19 12H5M12 19l-7-7 7-7" />,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    info: <><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="M12 11v5M12 8h.01" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    edit: <><path d="m14 5 5 5-9 9H5v-5Z" /><path d="m13 6 5 5" /></>,
    copy: <><path d="M8 8h11v11H8Z" /><path d="M5 16H4V5h11v1" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    clipboard: <><path d="M8 4h8v4H8Z" /><path d="M6 6H5v15h14V6h-1" /><path d="M9 13h6M9 17h4" /></>,
    kitchen: <><path d="M8 4v5M12 4v5M16 4v5M7 9h10l-1 11H8Z" /><path d="M5 13H3v3h3M19 13h2v3h-3" /></>,
    grid: <><path d="M4 5h5v5H4ZM15 5h5v5h-5ZM4 15h5v5H4ZM15 15h5v5h-5" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    arrow: <path d="m9 18 6-6-6-6" />,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></>,
    file: <><path d="M6 3h9l3 3v15H6Z" /><path d="M15 3v4h4M9 12h6M9 16h4" /></>,
    utensils: <><path d="M7 3v18M11 3v7a4 4 0 0 1-8 0V3M17 3v18M17 3c2 1.5 3 4 3 7v2h-3" /></>,
    lock: <><path d="M6 10h12v11H6Z" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    x: <><path d="M18 6 6 18M6 6l12 12" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l2.1-2.1a5 5 0 0 0-7.1-7.1L11 4.9" /><path d="M14 11a5 5 0 0 0-7.1 0l-2.1 2.1a5 5 0 0 0 7.1 7.1L13 19.1" /></>,
    sync: <><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" /><path d="M3 21v-5h5M3 12A9 9 0 0 1 18.3 5.6L21 8" /><path d="M21 3v5h-5" /></>
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function TopbarIconButton({ children, label, badge }: { children: React.ReactNode; label: string; badge?: string }) {
  return (
    <button className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E5E0D6] bg-white text-[#64748B] shadow-sm shadow-[#B9974D]/5 transition hover:-translate-y-0.5 hover:border-[#B9974D] hover:text-[#B9974D] sm:h-12 sm:w-12" type="button" aria-label={label}>
      {children}
      {badge ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-linear-to-r from-[#B9974D] to-[#0F172A] px-1.5 text-xs font-black text-white">{badge}</span> : null}
    </button>
  );
}

function TextField({
  label,
  value,
  type = "text",
  swatchClassName,
  compact = false
}: {
  label: string;
  value: string;
  type?: "text" | "select";
  swatchClassName?: string;
  compact?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className={compact ? "text-[11px] font-black text-[#0F172A]" : "text-sm font-black text-[#0F172A]"}>{label}</span>
      <span
        className={`flex items-center rounded-2xl border border-[#E5E0D6] bg-[#FFFEFB] font-semibold text-[#1E293B] shadow-sm shadow-[#0F172A]/4 transition focus-within:border-[#16C7C4] focus-within:shadow-[0_0_0_4px_rgba(22,199,196,0.14)] ${
          compact ? "mt-1.5 h-8 gap-2 px-2.5 text-xs" : "mt-3 h-13 gap-3 px-4 text-base"
        }`}
      >
        {swatchClassName ? <span className={`${compact ? "h-4 w-4" : "h-7 w-7"} shrink-0 rounded-md ${swatchClassName}`} /> : null}
        {type === "select" ? (
          <>
            <span className="min-w-0 flex-1 truncate">{value}</span>
            <svg className={`${compact ? "h-3 w-3" : "h-4 w-4"} shrink-0 text-[#64748B]`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <input className="min-w-0 flex-1 bg-transparent outline-none" defaultValue={value} />
        )}
      </span>
    </label>
  );
}

function PermissionToggle({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`relative inline-flex h-7 w-12 items-center rounded-full border p-1 transition ${
        enabled ? "border-[#0F172A] bg-[#0F172A]" : "border-[#D9D9D4] bg-[#E7E3DA]"
      }`}
      aria-label={enabled ? "Enabled" : "Disabled"}
      title={enabled ? "Enabled" : "Disabled"}
    >
      <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </span>
  );
}

function HallsSettingsPanel() {
  return (
    <section className="dashboard-gradient-card overflow-hidden shadow-xl shadow-[#0F172A]/8">
      <div className="relative z-1 p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-black tracking-tight text-[#0F172A] sm:text-2xl">Halls</h2>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#B9974D] px-4 text-xs font-black text-white shadow-lg shadow-[#0F172A]/10 transition hover:-translate-y-0.5 hover:bg-[#9C7D37]"
            type="button"
          >
            <LineIcon name="plus" className="h-4 w-4" />
            Add Hall
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {halls.map((hall) => (
            <article
              key={hall.name}
              className="rounded-2xl border border-[#E5E0D6] bg-[#FFFEFB] p-3.5 shadow-md shadow-[#0F172A]/4 transition hover:-translate-y-0.5 hover:border-[#9DD8D1] hover:shadow-lg hover:shadow-[#0F172A]/7 sm:p-4"
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E5E0D6] bg-[#F7F4ED] text-[#B9974D] shadow-sm shadow-[#0F172A]/5">
                    <LineIcon name="hall" className="h-5 w-5" />
                  </span>

                  <span className="min-w-0">
                    <h3 className="text-base font-black tracking-tight text-[#0F172A] sm:text-lg">{hall.name}</h3>
                    <p className="mt-0.5 text-xs font-semibold leading-5 text-[#64748B] sm:text-sm">{hall.description}</p>
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 text-[11px] font-black text-[#027A48]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#027A48]" />
                    Active
                  </span>

                  <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#BBD7FF] bg-[#EEF7FF] px-2.5 text-[11px] font-black text-[#1D6BFF]">
                    <LineIcon name="calendar" className="h-3 w-3" />
                    Calendar + Kitchen
                  </span>

                  <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-[11px] font-black text-[#0F172A] transition hover:border-[#9DD8D1] hover:bg-[#EEF7FF]" type="button">
                    <LineIcon name="edit" className="h-3 w-3" />
                    Edit
                  </button>

                  <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-[11px] font-black text-[#0F172A] transition hover:border-[#9DD8D1] hover:bg-[#EEF7FF]" type="button">
                    <LineIcon name="copy" className="h-3 w-3" />
                    Duplicate
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureAccessSettingsPanel() {
  const permissionColumns = [
    { key: "view", label: "View", icon: "eye" as const },
    { key: "create", label: "Create", icon: "plus" as const },
    { key: "edit", label: "Edit", icon: "edit" as const },
    { key: "delete", label: "Delete", icon: "trash" as const },
    { key: "manage", label: "Manage", icon: "gear" as const }
  ];

  return (
    <section className="dashboard-gradient-card overflow-hidden shadow-xl shadow-[#0F172A]/8">
      <div className="relative z-1 p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#E5E0D6] bg-[#F7F4ED] text-[#B9974D]">
              <LineIcon name="key" className="h-8 w-8" />
            </span>
            <h2 className="text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl">Feature Access Control</h2>
          </div>

          <button
            className="inline-flex h-13 items-center justify-center gap-3 rounded-2xl bg-[#0F172A] px-6 text-base font-black text-white shadow-xl shadow-[#0F172A]/15 transition hover:-translate-y-0.5 hover:bg-[#243551]"
            type="button"
          >
            <LineIcon name="lock" className="h-5 w-5 text-[#B9974D]" />
            Save Feature Access
          </button>
        </div>

        <div className="mt-7 max-w-xl">
          <TextField label="" value="Admin" type="select" />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button className="inline-flex h-12 items-center justify-center gap-3 rounded-2xl border border-[#CBD5E1] bg-white px-5 text-sm font-black text-[#0F172A] transition hover:border-[#9DD8D1] hover:bg-[#EEF7FF]" type="button">
            <LineIcon name="check" className="h-5 w-5" />
            Select All
          </button>
          <button className="inline-flex h-12 items-center justify-center gap-3 rounded-2xl border border-[#CBD5E1] bg-white px-5 text-sm font-black text-[#0F172A] transition hover:border-[#9DD8D1] hover:bg-[#EEF7FF]" type="button">
            <LineIcon name="x" className="h-5 w-5" />
            Clear All
          </button>
        </div>

        <div className="mt-4 overflow-x-auto pb-2">
          <div className="min-w-245">
            <div className="grid grid-cols-[minmax(320px,1.8fr)_repeat(5,minmax(112px,1fr))] items-center gap-4 border-b border-[#E5E0D6] px-4 py-4 text-sm font-black text-[#64748B]">
              <span>Feature</span>
              {permissionColumns.map((column) => (
                <span key={column.key} className="inline-flex items-center justify-center gap-2">
                  <LineIcon name={column.icon} className="h-4 w-4" />
                  {column.label}
                </span>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              {featureAccessRows.map((feature) => (
                <article
                  key={feature.name}
                  className="grid grid-cols-[minmax(320px,1.8fr)_repeat(5,minmax(112px,1fr))] items-center gap-4 rounded-2xl border border-[#E5E0D6] bg-[#FFFEFB] px-4 py-3 shadow-sm shadow-[#0F172A]/4"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm shadow-[#0F172A]/5 ${feature.iconClassName}`}>
                      <LineIcon name={feature.icon} className="h-6 w-6" />
                    </span>
                    <span className="min-w-0">
                      <h3 className="truncate text-base font-black text-[#0F172A]">{feature.name}</h3>
                      <p className="mt-1 truncate text-xs font-semibold text-[#64748B]">{feature.description}</p>
                    </span>
                  </div>

                  {permissionColumns.map((column) => (
                    <span key={column.key} className="flex justify-center">
                      <PermissionToggle enabled={feature.permissions[column.key as keyof typeof feature.permissions]} />
                    </span>
                  ))}
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function IconField({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon: "link" | "mail" | "file";
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-black text-[#0F172A]">{label}</span>
      <span className="mt-3 flex h-15 items-center gap-4 rounded-2xl border border-[#E5E0D6] bg-[#FFFEFB] px-5 text-base font-semibold text-[#0F172A] shadow-sm shadow-[#0F172A]/4 transition focus-within:border-[#16C7C4] focus-within:shadow-[0_0_0_4px_rgba(22,199,196,0.14)]">
        <LineIcon name={icon} className="h-6 w-6 shrink-0 text-[#64748B]" />
        <input className="min-w-0 flex-1 bg-transparent outline-none" defaultValue={value} />
      </span>
    </label>
  );
}

function PaymentsGmailSettingsPanel() {
  return (
    <section className="dashboard-gradient-card overflow-hidden shadow-xl shadow-[#0F172A]/8">
      <div className="relative z-1 p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#E5E0D6] bg-[#F7F4ED] text-[#B9974D]">
              <LineIcon name="mail" className="h-8 w-8" />
            </span>
            <h2 className="text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl">Payments / Gmail</h2>
          </div>

          <button
            className="inline-flex h-13 items-center justify-center gap-3 rounded-2xl bg-[#0F172A] px-6 text-base font-black text-white shadow-xl shadow-[#0F172A]/15 transition hover:-translate-y-0.5 hover:bg-[#243551]"
            type="button"
          >
            <LineIcon name="save" className="h-5 w-5 text-[#B9974D]" />
            Save
          </button>
        </div>

        <div className="mt-9 grid gap-7 lg:grid-cols-2">
          <IconField label="Default Payment Link" value="https://secure.cardknox.com/belzcheiderevents" icon="link" />
          <IconField label="Connected Gmail Sender" value="payments@example.com" icon="mail" />
          <IconField label="Payment Email Subject" value="Payment Link for Your Event" icon="file" />

          <div className="block min-w-0">
            <span className="text-sm font-black text-[#0F172A]">Send Test Email</span>
            <button
              className="mt-3 inline-flex h-15 w-full items-center justify-center gap-4 rounded-2xl border border-[#0F172A] bg-white px-6 text-base font-black text-[#0F172A] shadow-sm shadow-[#0F172A]/4 transition hover:-translate-y-0.5 hover:border-[#9DD8D1] hover:bg-[#EEF7FF] lg:w-auto lg:min-w-72"
              type="button"
            >
              <LineIcon name="send" className="h-6 w-6" />
              Send Test Email
            </button>
          </div>
        </div>

        <div className="mt-9 flex gap-4 rounded-2xl border border-[#BBD7FF] bg-[#EEF7FF] p-5 text-[#0B4EA2]">
          <LineIcon name="info" className="mt-0.5 h-6 w-6 shrink-0" />
          <p className="text-sm font-semibold leading-7 sm:text-base">
            Payment links and Gmail sender settings are used when sending payment emails to clients.
          </p>
        </div>
      </div>
    </section>
  );
}

function GoogleCalendarSettingsPanel() {
  const calendarCards = [
    {
      title: "Platform Calendar",
      description: "Default calendar for all halls unless a hall-specific calendar is set.",
      icon: "calendar" as const,
      iconClassName: "border-[#A7F3D0] bg-[#ECFDF5] text-[#027A48]",
      badge: "Connected",
      badgeIcon: "check" as const,
      badgeClassName: "border-[#A7F3D0] bg-[#ECFDF5] text-[#027A48]"
    },
    {
      title: "Hall-Specific Calendar",
      description: "Each hall can use its own Google Calendar ID.",
      icon: "hall" as const,
      iconClassName: "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]",
      badge: "Optional",
      badgeIcon: "info" as const,
      badgeClassName: "border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]"
    },
    {
      title: "Duplicate Prevention",
      description: "Uses google_calendar_event_id.",
      icon: "shield" as const,
      iconClassName: "border-[#A7F3D0] bg-[#ECFDF5] text-[#027A48]",
      badge: "Active",
      badgeIcon: "shield" as const,
      badgeClassName: "border-[#A7F3D0] bg-[#ECFDF5] text-[#027A48]"
    }
  ];

  return (
    <section className="dashboard-gradient-card overflow-hidden shadow-xl shadow-[#0F172A]/8">
      <div className="relative z-1 p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#E5E0D6] bg-[#F7F4ED] text-[#B9974D]">
              <LineIcon name="calendar" className="h-8 w-8" />
            </span>
            <h2 className="text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl">Google Calendar</h2>
          </div>

          <button
            className="inline-flex h-13 items-center justify-center gap-3 rounded-2xl bg-[#B9974D] px-6 text-base font-black text-white shadow-xl shadow-[#0F172A]/12 transition hover:-translate-y-0.5 hover:bg-[#9C7D37]"
            type="button"
          >
            <LineIcon name="sync" />
            Test Sync
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {calendarCards.map((card) => (
            <article key={card.title} className="flex min-h-72 flex-col rounded-3xl border border-[#E5E0D6] bg-[#FFFEFB] p-7 shadow-lg shadow-[#0F172A]/5">
              <span className={`flex h-18 w-18 items-center justify-center rounded-full border shadow-sm shadow-[#0F172A]/5 ${card.iconClassName}`}>
                <LineIcon name={card.icon} className="h-9 w-9" />
              </span>
              <h3 className="mt-7 text-2xl font-black tracking-tight text-[#0F172A]">{card.title}</h3>
              <p className="mt-4 text-base font-semibold leading-8 text-[#64748B]">{card.description}</p>
              <div className="mt-auto pt-7">
                <span className={`inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-black ${card.badgeClassName}`}>
                  <LineIcon name={card.badgeIcon} className="h-4 w-4" />
                  {card.badge}
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-7 flex gap-4 rounded-2xl border border-[#BBD7FF] bg-[#EEF7FF] p-5 text-[#0B4EA2]">
          <LineIcon name="info" className="mt-0.5 h-6 w-6 shrink-0" />
          <p className="text-sm font-semibold leading-7 sm:text-base">
            Google Calendar sync keeps your bookings and events in sync across the platform. Use Test Sync to verify your connection at any time.
          </p>
        </div>
      </div>
    </section>
  );
}

function HallPerformanceSettingsPanel() {
  return (
    <section className="dashboard-gradient-card overflow-hidden shadow-xl shadow-[#0F172A]/8">
      <div className="relative z-1 p-3.5 sm:p-4 lg:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black tracking-tight text-[#0F172A] sm:text-xl">Hall Performance Settings</h2>
          <button
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0F172A] px-3 text-[11px] font-black text-white shadow-md shadow-[#0F172A]/10 transition hover:-translate-y-0.5 hover:bg-[#243551]"
            type="button"
          >
            <LineIcon name="save" className="h-3.5 w-3.5 text-[#B9974D]" />
            Save Hall Defaults
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <TextField label="Select Hall" value="Hall 1" type="select" compact />
          <TextField label="Booking Mode" value="One event per night" type="select" compact />
          <TextField label="Allow On Hold" value="Yes" type="select" compact />
          <TextField label="Require Package" value="No" type="select" compact />
          <TextField label="Base Price" value="$0.00" compact />
          <TextField label="Per Couple Price" value="$0.00" compact />
          <TextField label="Connected Halls" value="None" type="select" compact />
          <TextField label="Shared Menu Rule" value="Off" type="select" compact />
          <TextField label="Kitchen Visibility" value="Show on Kitchen Dashboard" type="select" compact />
          <TextField label="Google Calendar" value="Use platform calendar" type="select" compact />
        </div>

        <div className="mt-4 flex gap-2.5 rounded-lg border border-[#BBD7FF] bg-[#EEF7FF] p-3 text-[#0B4EA2]">
          <LineIcon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-[11px] font-semibold leading-5 sm:text-xs">
            Each hall can have its own booking rules, availability rules, pricing, menu defaults, kitchen defaults, PDF defaults,
            payment link, and Google Calendar behavior.
          </p>
        </div>
      </div>
    </section>
  );
}

function UserTypesSettingsPanel() {
  return (
    <section className="dashboard-gradient-card overflow-hidden shadow-xl shadow-[#0F172A]/8">
      <div className="relative z-1 p-3.5 sm:p-4 lg:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#BBD7FF] bg-[#EEF7FF] text-[#1D6BFF]">
              <LineIcon name="users" className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-black tracking-tight text-[#0F172A] sm:text-xl">User Types / Role Templates</h2>
          </div>

          <button
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#B9974D] px-3 text-[11px] font-black text-white shadow-md shadow-[#0F172A]/10 transition hover:-translate-y-0.5 hover:bg-[#9C7D37]"
            type="button"
          >
            <LineIcon name="plus" className="h-3.5 w-3.5" />
            Add User Type
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {userTypes.map((userType) => (
            <article
              key={userType.name}
              className="rounded-2xl border border-[#E5E0D6] bg-[#FFFEFB] p-3.5 shadow-md shadow-[#0F172A]/4 transition hover:-translate-y-0.5 hover:border-[#9DD8D1] hover:shadow-lg hover:shadow-[#0F172A]/7 sm:p-4"
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm shadow-[#0F172A]/5 ${userType.iconClassName}`}>
                    <LineIcon name={userType.icon} className="h-5 w-5" />
                  </span>

                  <span className="min-w-0">
                    <h3 className="text-base font-black tracking-tight text-[#0F172A] sm:text-lg">{userType.name}</h3>
                    <p className="mt-0.5 max-w-md text-xs font-semibold leading-5 text-[#64748B] sm:text-sm">{userType.description}</p>
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {userType.badges.map((badge) => (
                    <span key={badge.label} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-black ${badge.className}`}>
                      <LineIcon name={badge.icon} className="h-3 w-3" />
                      {badge.label}
                    </span>
                  ))}

                  <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-[11px] font-black text-[#0F172A] transition hover:border-[#9DD8D1] hover:bg-[#EEF7FF]" type="button">
                    <LineIcon name="edit" className="h-3 w-3" />
                    Edit
                  </button>

                  <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-[11px] font-black text-[#0F172A] transition hover:border-[#9DD8D1] hover:bg-[#EEF7FF]" type="button">
                    <LineIcon name="copy" className="h-3 w-3" />
                    Duplicate
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function UserAccessSettingsPanel() {
  return (
    <section className="dashboard-gradient-card overflow-hidden shadow-xl shadow-[#0F172A]/8">
      <div className="relative z-1 p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#E5E0D6] bg-[#F7F4ED] text-[#B9974D]">
              <LineIcon name="shield" className="h-8 w-8" />
            </span>
            <h2 className="text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl">User Access</h2>
          </div>

          <button
            className="inline-flex h-13 items-center justify-center gap-3 rounded-2xl bg-[#B9974D] px-6 text-base font-black text-white shadow-xl shadow-[#0F172A]/12 transition hover:-translate-y-0.5 hover:bg-[#9C7D37]"
            type="button"
          >
            <LineIcon name="plus" />
            Add User by Email
          </button>
        </div>

        <div className="mt-7 space-y-5">
          {userAccessRows.map((row) => (
            <article
              key={row.email}
              className="rounded-3xl border border-[#E5E0D6] bg-[#FFFEFB] p-5 shadow-lg shadow-[#0F172A]/5 transition hover:-translate-y-0.5 hover:border-[#9DD8D1] hover:shadow-xl hover:shadow-[#0F172A]/8 sm:p-6"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-4 sm:items-center sm:gap-5">
                  <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border shadow-sm shadow-[#0F172A]/5 ${row.iconClassName}`}>
                    <LineIcon name={row.icon} className="h-8 w-8" />
                  </span>

                  <span className="min-w-0">
                    <h3 className="text-2xl font-black tracking-tight text-[#0F172A]">{row.name}</h3>
                    <p className="mt-1 text-base font-semibold leading-7 text-[#64748B]">{row.email}</p>
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 xl:justify-end">
                  {row.badges.map((badge) => (
                    <span key={badge.label} className={`inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-black ${badge.className}`}>
                      <LineIcon name={badge.icon} className="h-4 w-4" />
                      {badge.label}
                    </span>
                  ))}

                  {row.actions.map((action) => {
                    const isDeactivate = action === "Deactivate";
                    const isResend = action === "Resend Invite";

                    return (
                      <button
                        key={action}
                        className={`inline-flex h-11 items-center gap-2 rounded-2xl border bg-white px-4 text-sm font-black transition ${
                          isDeactivate
                            ? "border-[#FDA4A4] text-[#DC2626] hover:bg-[#FEF2F2]"
                            : "border-[#CBD5E1] text-[#0F172A] hover:border-[#9DD8D1] hover:bg-[#EEF7FF]"
                        }`}
                        type="button"
                      >
                        <LineIcon name={isDeactivate ? "trash" : isResend ? "send" : "edit"} className="h-4 w-4" />
                        {action}
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-7 flex gap-4 rounded-2xl border border-[#BBD7FF] bg-[#EEF7FF] p-5 text-[#0B4EA2]">
          <LineIcon name="info" className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold leading-7 sm:text-base">
            When adding a user, select a saved user type. The saved access setup is applied automatically. Individual overrides are optional.
          </p>
        </div>
      </div>
    </section>
  );
}

export function PlatformSettingsPage({ initialActiveItem = "Platform Settings" }: PlatformSettingsPageProps) {
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<SettingsSectionId>(() => resolveSettingsSectionId(initialActiveItem));

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
    return (
      <main
        className="min-h-screen bg-[#F7F4ED]"
        aria-busy="true"
        aria-label="Loading platform settings"
      />
    );
  }

  const user = syncData.user;
  const initials = getInitials(user.name);
  const roleLabel = formatRole(user.role);
  const activeSection = SETTINGS_SECTIONS.find((section) => section.id === activeSectionId) ?? SETTINGS_SECTIONS[0];
  const isPlatformSettingsView = activeSectionId === "platform-settings";
  const isHallsView = activeSectionId === "halls";
  const isHallPerformanceView = activeSectionId === "hall-performance";
  const isUserTypesView = activeSectionId === "user-types";
  const isUserAccessView = activeSectionId === "user-access";
  const isFeatureAccessView = activeSectionId === "feature-access";
  const isPaymentsGmailView = activeSectionId === "payments-gmail";
  const isGoogleCalendarView = activeSectionId === "google-calendar";

  function handleSettingsSectionChange(section: SettingsSection) {
    setActiveSectionId(section.id);

    if (typeof window !== "undefined" && window.location.pathname !== section.path) {
      window.history.replaceState(null, "", section.path);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden text-[#0F172A] [background:linear-gradient(135deg,rgba(185,151,77,0.13),transparent_34%),linear-gradient(315deg,rgba(15,23,42,0.08),transparent_32%),#F7F4ED]">
      <header className="sticky top-0 z-30 border-b border-[#E5E0D6] bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:min-h-20 sm:gap-5 sm:px-8 lg:px-12">
          <Image src="/hms-logo-header.png" alt="Hall Management SaaS" width={1160} height={300} priority unoptimized className="h-11 w-auto max-w-37.5 object-contain sm:h-14 sm:max-w-none lg:h-16" />
          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <button className="hidden items-center gap-3 rounded-2xl bg-[#0F172A] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#0F172A]/12 transition hover:-translate-y-0.5 hover:bg-[#243551] md:inline-flex" type="button" onClick={() => router.push("/dashboard")}>
              <LineIcon name="home" />
              Dashboard
            </button>
            <TopbarIconButton label="Notifications" badge="3"><LineIcon name="bell" className="h-5 w-5 sm:h-6 sm:w-6" /></TopbarIconButton>
            <TopbarIconButton label="Help"><LineIcon name="help" className="h-5 w-5 sm:h-6 sm:w-6" /></TopbarIconButton>
            <button className="flex items-center gap-3 rounded-3xl px-2 py-1 transition hover:bg-[#F7F4ED] sm:pl-3 sm:pr-4" type="button">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#B9974D] to-[#E7E3DA] text-base font-black text-[#0F172A] sm:h-12 sm:w-12 sm:text-lg">{initials}</span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-black text-[#0F172A]">{user.name}</span>
                <span className="block text-xs font-semibold text-[#64748B]">{roleLabel}</span>
              </span>
              <svg className="hidden h-4 w-4 text-[#64748B] sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-4 py-8 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-[#E7E3DA]/70 to-transparent" />
        <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#B9974D]/12 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-20 h-96 w-96 rounded-full bg-[#0F172A]/10 blur-3xl" />
        <svg className="pointer-events-none absolute right-0 top-0 hidden h-96 w-180 max-w-full text-[#B9974D]/20 sm:block" viewBox="0 0 720 360" fill="none" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <path key={index} d={`M0 ${90 + index * 22}c142-90 242 44 384-46 128-80 214-30 336-98`} stroke="currentColor" />
          ))}
        </svg>

        <div className="relative mx-auto max-w-[1600px]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-[0.32em] text-[#B9974D]">
                Route / Settings
              </p>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-[#0F172A] sm:text-5xl lg:text-6xl">
                {activeSection.pageTitle}
              </h1>
              <p className="mt-5 max-w-4xl text-base leading-8 text-[#64748B] sm:text-lg">
                {isPlatformSettingsView
                  ? "Configure your platform branding, halls, user access, integrations, and default system settings."
                  : "Configure the entire platform: name, halls, user types, user access, feature access, integrations, and defaults."}
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              {!isPlatformSettingsView ? (
                <button
                  className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#0F172A] px-7 text-base font-black text-white shadow-xl shadow-[#0F172A]/15 transition hover:-translate-y-0.5 hover:bg-[#243551]"
                  type="button"
                  onClick={() => router.push("/dashboard")}
                >
                  <LineIcon name="grid" />
                  Main Menu
                </button>
              ) : (
                <>
                  <button className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-[#9DD8D1] bg-white px-6 text-base font-black text-[#0B6F81] shadow-lg shadow-[#0F172A]/6 transition hover:-translate-y-0.5 hover:border-[#B9974D] hover:text-[#9C7D37]" type="button" onClick={() => router.push("/dashboard")}>
                    <LineIcon name="back" />
                    Back to Dashboard
                  </button>
                  <button className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#B9974D] px-6 text-base font-black text-white shadow-2xl shadow-[#0F172A]/15 transition hover:-translate-y-0.5 hover:bg-[#9C7D37]" type="button">
                    <LineIcon name="save" />
                    Save Platform Settings
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={`mt-10 grid gap-6 ${!isPlatformSettingsView ? "lg:grid-cols-[330px_minmax(0,1fr)]" : "lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_470px]"}`}>
            <aside className="dashboard-gradient-card overflow-hidden shadow-xl shadow-[#0F172A]/8">
              <nav className="relative z-1 space-y-3 p-5">
                {SETTINGS_SECTIONS.map((section) => {
                  const isActive = section.id === activeSectionId;
                  return (
                    <button
                      key={section.id}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-black transition ${
                        isActive
                          ? "border border-l-4 border-[#9DD8D1] border-l-[#1D6BFF] bg-[#F7F4ED] text-[#0F172A] shadow-sm shadow-[#0F172A]/5"
                          : "border border-transparent bg-transparent text-[#64748B] hover:border-[#E5E0D6] hover:bg-[#F7F4ED] hover:text-[#B9974D]"
                      }`}
                      type="button"
                      onClick={() => handleSettingsSectionChange(section)}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isActive ? "bg-white text-[#B9974D]" : "bg-[#F7F4ED] text-[#64748B]"}`}>
                        <LineIcon name={section.icon} className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0 truncate">{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            {isHallsView ? (
              <div>
                <HallsSettingsPanel />
              </div>
            ) : isHallPerformanceView ? (
              <div>
                <HallPerformanceSettingsPanel />
              </div>
            ) : isUserTypesView ? (
              <div>
                <UserTypesSettingsPanel />
              </div>
            ) : isUserAccessView ? (
              <div>
                <UserAccessSettingsPanel />
              </div>
            ) : isFeatureAccessView ? (
              <div>
                <FeatureAccessSettingsPanel />
              </div>
            ) : isPaymentsGmailView ? (
              <div>
                <PaymentsGmailSettingsPanel />
              </div>
            ) : isGoogleCalendarView ? (
              <div>
                <GoogleCalendarSettingsPanel />
              </div>
            ) : (
              <>
            <section className="dashboard-gradient-card overflow-hidden shadow-xl shadow-[#0F172A]/8">
              <div className="relative z-1 p-6 sm:p-8">
                <h2 className="text-3xl font-black tracking-tight text-[#0F172A]">Platform Settings</h2>
                <div className="mt-7 grid gap-6 md:grid-cols-2">
                  <TextField label="Platform Name" value="Hall Management Platform" />
                  <TextField label="Organization Name" value="Default Hall Organization" />
                  <TextField label="Short Display Name" value="Hall Platform" />
                  <TextField label="Timezone" value="America/New_York" type="select" />
                  <TextField label="Clock Format" value="12-hour" type="select" />
                  <TextField label="Calendar Start Day" value="Sunday" type="select" />
                  <TextField label="Primary Color" value="#0F172A" swatchClassName="bg-[#0F172A]" />
                  <TextField label="Accent Color" value="#B9974D" swatchClassName="bg-[#B9974D]" />
                </div>

                <div className="mt-8 border-t border-[#E5E0D6] pt-7">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <button className="inline-flex h-13 items-center justify-center gap-3 rounded-2xl border border-[#9DD8D1] bg-white px-5 text-sm font-black text-[#0B6F81] shadow-sm shadow-[#0F172A]/4 transition hover:-translate-y-0.5 hover:border-[#B9974D] hover:text-[#9C7D37]" type="button">
                      <LineIcon name="upload" />
                      Upload Logo
                    </button>
                    <button className="inline-flex h-13 items-center justify-center gap-3 rounded-2xl border border-[#9DD8D1] bg-white px-5 text-sm font-black text-[#0B6F81] shadow-sm shadow-[#0F172A]/4 transition hover:-translate-y-0.5 hover:border-[#B9974D] hover:text-[#9C7D37]" type="button">
                      <LineIcon name="upload" />
                      Upload Favicon
                    </button>
                    <button className="inline-flex h-13 items-center justify-center gap-3 rounded-2xl border border-[#ffb8b8] bg-white px-5 text-sm font-black text-[#ef2020] shadow-sm shadow-[#0F172A]/4 transition hover:-translate-y-0.5 hover:bg-[#fff7f7]" type="button">
                      <LineIcon name="trash" />
                      Reset Theme
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <aside className="dashboard-gradient-card overflow-hidden shadow-xl shadow-[#0F172A]/8 lg:col-span-2 2xl:col-span-1">
              <div className="relative z-1 p-6 sm:p-8">
                <h2 className="text-3xl font-black tracking-tight text-[#0F172A]">Brand Preview</h2>
                <p className="mt-5 text-base leading-8 text-[#64748B]">
                  This preview shows how the platform name and logo area will appear in the app, PDFs, and emails.
                </p>

                <div className="mt-8 flex min-h-48 items-center justify-center rounded-3xl border border-[#E5E0D6] bg-linear-to-br from-[#F7F4ED] to-[#F1F5F9] p-6 shadow-inner shadow-[#0F172A]/4">
                  <div className="flex max-w-full flex-col items-center justify-center text-center">
                    <Image src="/hms-logo-header.png" alt="Hall Management SaaS logo" width={1160} height={300} unoptimized className="h-auto w-60 max-w-full object-contain sm:w-72" />
                    <p className="mt-3 text-sm font-semibold leading-5 text-[#64748B] sm:text-base">
                      Default Hall Organization
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex gap-4 rounded-2xl border border-[#9DD8D1] bg-[#EEF7FF] p-5 text-[#0B6F81]">
                  <LineIcon name="info" className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm font-semibold leading-7">
                    Platform name, colors, logo, PDF header, and email header are controlled from this section.
                  </p>
                </div>
              </div>
            </aside>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
