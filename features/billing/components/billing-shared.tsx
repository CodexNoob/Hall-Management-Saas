"use client";

import { type ReactNode } from "react";
import { centerMobileTab } from "@/lib/ui/center-mobile-tab";

export type BillingTab =
  | "Dashboard"
  | "Transactions"
  | "Invoices"
  | "Event Billing"
  | "Settings";
export type IconName =
  | "bank"
  | "invoice"
  | "plus"
  | "search"
  | "settings"
  | "upload"
  | "print"
  | "edit"
  | "more"
  | "payment"
  | "back"
  | "chevron";

export type BillingResponse = {
  transactions: Array<{
    id: string;
    amountCents: number;
    provider: string;
    status: string;
    createdAt: string;
    event: { clientName: string } | null;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    status: string;
    dueDate: string | null;
    totalCents: number;
    amountPaidCents: number;
  }>;
  summary: {
    paidCents: number;
    openInvoiceCents: number;
    openInvoices: number;
  };
};

export const tabs: BillingTab[] = [
  "Dashboard",
  "Transactions",
  "Invoices",
  "Event Billing",
  "Settings"
];
export const billingTabIcons: Record<BillingTab, IconName> = {
  Dashboard: "bank",
  Transactions: "payment",
  Invoices: "invoice",
  "Event Billing": "bank",
  Settings: "settings"
};
export const cashMovementBars = [
  { label: "$15k", day: "Mon", className: "h-24 bg-[#d8dde5]" },
  { label: "$1.8k", day: "Tue", className: "h-10 bg-[#d8dde5]" },
  { label: "$8.7k", day: "Wed", className: "h-14 bg-[#d8dde5]" },
  { label: "$5.2k", day: "Thu", className: "h-24 bg-[#d8dde5]" },
  { label: "$2.5k", day: "Fri", className: "h-8 bg-[#d8dde5]" }
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
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  const icons: Record<IconName, ReactNode> = {
    bank: (
      <>
        <path d="M3 10h18" />
        <path d="M5 10v9M9 10v9M15 10v9M19 10v9" />
        <path d="M3 19h18M12 3 4 7h16Z" />
      </>
    ),
    invoice: (
      <>
        <path d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1Z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12h2M3 12h2M12 3v2M12 19v2M17 7l1.4-1.4M5.6 18.4 7 17M17 17l1.4 1.4M5.6 5.6 7 7" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M4 20h16" />
      </>
    ),
    print: (
      <>
        <path d="M7 8V3h10v5" />
        <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
        <path d="M7 14h10v7H7Z" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    payment: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
    back: <path d="m15 18-6-6 6-6" />,
    chevron: <path d="m9 6 6 6-6 6" />
  };

  return <svg {...common}>{icons[name]}</svg>;
}

export function TopAction({
  icon,
  label,
  onClick,
  tone = "outline",
  disabled = false,
  compactOnMobile = false
}: {
  icon?: IconName;
  label: string;
  onClick?: () => void;
  tone?: "outline" | "primary";
  disabled?: boolean;
  compactOnMobile?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border text-xs font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
        compactOnMobile
          ? "w-8 border-transparent bg-transparent px-0 shadow-none lg:w-auto lg:px-3"
          : "px-3"
      } ${
        tone === "primary"
          ? compactOnMobile
            ? "text-[#1f4d73] lg:border-[#1f4d73] lg:bg-[#1f4d73] lg:text-white lg:shadow-md lg:shadow-[#1f4d73]/15"
            : "border-[#1f4d73] bg-[#1f4d73] text-white shadow-md shadow-[#1f4d73]/15"
          : compactOnMobile
            ? "text-[#17202a] hover:text-[#1f4d73] lg:border-[#b9c2cf] lg:bg-white lg:hover:bg-[#eef4fa]"
            : "border-[#b9c2cf] bg-white text-[#17202a] hover:bg-[#eef4fa]"
      }`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {icon ? (
        <LineIcon
          name={icon}
          className={compactOnMobile ? "h-6 w-6 lg:h-4 lg:w-4" : undefined}
        />
      ) : null}
      <span className={compactOnMobile ? "hidden lg:inline" : undefined}>
        {label}
      </span>
    </button>
  );
}

export function StatCard({
  label,
  value,
  note,
  tone = "navy"
}: {
  label: string;
  value: string;
  note: string;
  tone?: "green" | "red" | "gold" | "navy";
}) {
  const colors = {
    green: "text-[#146c43]",
    red: "text-[#a62b24]",
    gold: "text-[#9a5b00]",
    navy: "text-[#17202a]"
  };

  return (
    <article className="rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6a7483]">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-black ${colors[tone]}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#6a7483]">{note}</p>
    </article>
  );
}

export function Pill({
  children,
  tone = "blue"
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "gold" | "red" | "gray";
}) {
  const colors = {
    blue: "border-[#b9c2cf] bg-[#eef4fa] text-[#1f4d73]",
    green: "border-[#146c43] bg-[#eef4fa] text-[#146c43]",
    gold: "border-[#9a5b00] bg-[#fbfcfd] text-[#9a5b00]",
    red: "border-[#a62b24] bg-[#fbfcfd] text-[#a62b24]",
    gray: "border-[#b9c2cf] bg-[#fbfcfd] text-[#6a7483]"
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${colors[tone]}`}
    >
      {children}
    </span>
  );
}
