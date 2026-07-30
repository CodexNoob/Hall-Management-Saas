"use client";

import { type ReactNode } from "react";

export type VendorStatus = "Active" | "Pending" | "Inactive";
export type VendorCategory = string;
export type IconName =
  | "plus"
  | "export"
  | "users"
  | "search"
  | "filter"
  | "more"
  | "phone"
  | "mail"
  | "briefcase"
  | "calendar"
  | "edit"
  | "history"
  | "warning";

export type Vendor = {
  id: string;
  initials: string;
  name: string;
  description: string;
  category: VendorCategory;
  contact: string;
  phone: string;
  email: string;
  status: VendorStatus;
  rating: number;
  preferred?: boolean;
  color: string;
};

export type VendorsResponse = {
  vendors: Array<{
    id: string;
    name: string;
    description: string | null;
    category: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    rating: string | number | null;
  }>;
};

export const categoryColors: Record<string, string> = {
  Catering: "border-[#a9dfc9] bg-[#effaf5] text-[#147653]",
  Linens: "border-[#b9d5ef] bg-[#eef6fd] text-[#246b9f]",
  Flowers: "border-[#e7c5e4] bg-[#fff2fc] text-[#a54d9d]",
  Rentals: "border-[#efd39d] bg-[#fff7e8] text-[#a45f00]",
  "AV Services": "border-[#d2c6f7] bg-[#f5f2ff] text-[#6550c4]",
  Staffing: "border-[#efd39d] bg-[#fff7e8] text-[#a45f00]",
  Bakery: "border-[#efc7b9] bg-[#fff4ef] text-[#a84d2c]"
};

export function Icon({
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
    plus: <path d="M12 5v14M5 12h14" />,
    export: (
      <>
        <path d="M12 16V3M7 8l5-5 5 5" />
        <path d="M5 13v7h14v-7" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a5 5 0 0 1 10 0v2M16 6a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    filter: <path d="M4 5h16l-6 7v6l-4 2v-8Z" />,
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
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V4h6v3M3 12h18" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    edit: <path d="m14 5 5 5M4 20l4-1 11-11-4-4L4 15Z" />,
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3 2 21h20Z" />
        <path d="M12 9v5M12 18h.01" />
      </>
    )
  };
  return <svg {...common}>{icons[name]}</svg>;
}

export function MetricCard({
  label,
  value,
  description,
  warning
}: {
  label: string;
  value: string;
  description: string;
  warning?: boolean;
}) {
  return (
    <article className="rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#687588]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p
        className={`mt-2 text-xs ${warning ? "font-bold text-[#b56a00]" : "text-[#6a7483]"}`}
      >
        {description}
      </p>
    </article>
  );
}

export function CategoryBadge({ category }: { category: VendorCategory }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] font-black ${categoryColors[category] ?? "border-[#cdd5df] bg-[#f4f6f8] text-[#536172]"}`}
    >
      {category}
    </span>
  );
}

export function StatusBadge({ status }: { status: VendorStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black ${status === "Active" ? "border-[#a9dfc9] bg-[#effaf5] text-[#147653]" : "border-[#efd39d] bg-[#fff7e8] text-[#a45f00]"}`}
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
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
      <div>
        <h2 className="text-sm font-black">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-[10px] text-[#6a7483]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export const secondaryButton =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#c7d0dc] bg-white px-3 text-xs font-black text-[#233144] shadow-sm transition hover:bg-[#eef4fa]";
