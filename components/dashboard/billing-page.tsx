"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { clearCachedSyncedUser, getCachedSyncedUser, syncSignedInUser, type SyncSignedInUserResponse } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type BillingTab = "Dashboard" | "Transactions" | "Invoices" | "Event Billing" | "Settings";
type IconName = "bank" | "invoice" | "plus" | "search" | "settings" | "upload" | "print" | "payment" | "back" | "chevron";

const tabs: BillingTab[] = ["Dashboard", "Transactions", "Invoices", "Event Billing", "Settings"];
const cashMovementBars = [
  { label: "$15k", day: "Mon", className: "h-24 bg-[#d8dde5]" },
  { label: "$1.8k", day: "Tue", className: "h-10 bg-[#d8dde5]" },
  { label: "$8.7k", day: "Wed", className: "h-14 bg-[#d8dde5]" },
  { label: "$5.2k", day: "Thu", className: "h-24 bg-[#d8dde5]" },
  { label: "$2.5k", day: "Fri", className: "h-8 bg-[#d8dde5]" }
];

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

  const icons: Record<IconName, ReactNode> = {
    bank: <><path d="M3 10h18" /><path d="M5 10v9M9 10v9M15 10v9M19 10v9" /><path d="M3 19h18M12 3 4 7h16Z" /></>,
    invoice: <><path d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12h2M3 12h2M12 3v2M12 19v2M17 7l1.4-1.4M5.6 18.4 7 17M17 17l1.4 1.4M5.6 5.6 7 7" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></>,
    print: <><path d="M7 8V3h10v5" /><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7Z" /></>,
    payment: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    chevron: <path d="m9 6 6 6-6 6" />,
  };

  return <svg {...common}>{icons[name]}</svg>;
}

function TopAction({ icon, label, tone = "outline" }: { icon?: IconName; label: string; tone?: "outline" | "primary" }) {
  return (
    <button
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-black transition hover:-translate-y-0.5 ${
        tone === "primary"
          ? "border-[#1f4d73] bg-[#1f4d73] text-white shadow-md shadow-[#1f4d73]/15"
          : "border-[#b9c2cf] bg-white text-[#17202a] hover:bg-[#eef4fa]"
      }`}
      type="button"
    >
      {icon ? <LineIcon name={icon} /> : null}
      {label}
    </button>
  );
}

function StatCard({ label, value, note, tone = "navy" }: { label: string; value: string; note: string; tone?: "green" | "red" | "gold" | "navy" }) {
  const colors = {
    green: "text-[#146c43]",
    red: "text-[#a62b24]",
    gold: "text-[#9a5b00]",
    navy: "text-[#17202a]",
  };

  return (
    <article className="rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6a7483]">{label}</p>
      <p className={`mt-2 text-2xl font-black ${colors[tone]}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#6a7483]">{note}</p>
    </article>
  );
}

function Pill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "gold" | "red" | "gray" }) {
  const colors = {
    blue: "border-[#b9c2cf] bg-[#eef4fa] text-[#1f4d73]",
    green: "border-[#146c43] bg-[#eef4fa] text-[#146c43]",
    gold: "border-[#9a5b00] bg-[#fbfcfd] text-[#9a5b00]",
    red: "border-[#a62b24] bg-[#fbfcfd] text-[#a62b24]",
    gray: "border-[#b9c2cf] bg-[#fbfcfd] text-[#6a7483]",
  };

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${colors[tone]}`}>{children}</span>;
}

function BillingHeader({ activeTab, setActiveTab }: { activeTab: BillingTab; setActiveTab: (tab: BillingTab) => void }) {
  return (
    <header className="border-b border-[#d8dde5] bg-white">
      <nav className="flex flex-wrap gap-1 px-4 pt-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`rounded-t-lg border px-5 py-3 text-sm font-black ${
              activeTab === tab ? "border-[#b9c2cf] border-b-white bg-white text-[#17202a]" : "border-transparent text-[#17202a] hover:bg-[#fbfcfd]"
            }`}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
    </header>
  );
}

function DashboardTab({ setActiveTab }: { setActiveTab: (tab: BillingTab) => void }) {
  const transactions = [
    ["Jun 24", "Bank deposit", "Event Deposit", "Friedman", "$15,000", "green"],
    ["Jun 29", "Zelle Yidel Graus", "Uncategorized", "Unassigned", "$3,900", "green"],
    ["Jun 25", "Premium Linen Co.", "Linen Rental", "Friedman", "-$1,840", "red"],
    ["Jun 26", "Kitchen Supply", "Food Purchase", "Weiss", "-$4,120", "red"],
    ["Jun 27", "Check deposit", "Event Deposit", "Klein", "$2,500", "green"],
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 lg:grid-cols-5">
        <StatCard label="Bank Income" value="$21,400" note="Posted transactions" tone="green" />
        <StatCard label="Expenses" value="$11,760" note="Posted transactions" tone="red" />
        <StatCard label="Net Profit" value="$9,640" note="Current period" />
        <StatCard label="Open Invoices" value="$54,325" note="4 invoices" tone="gold" />
        <StatCard label="Needs Review" value="2" note="Events linked to review items" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#d8dde5] p-4">
            <div>
              <h2 className="font-black text-[#17202a]">Billing dashboard</h2>
              <p className="text-sm text-[#6a7483]">Daily office view for the finance team.</p>
            </div>
            <TopAction label="Review transactions" />
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-3">
            {["Assign card batch payout to the correct events or split it across events.", "Friedman and Klein have open balances before event week.", "Review payroll and linen transactions before closing the week."].map((text, index) => (
              <article key={text} className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-4">
                <h3 className="font-black text-[#17202a]">{["Next action", "Invoice action", "Profit check"][index]}</h3>
                <p className="mt-2 text-sm leading-6 text-[#17202a]">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#d8dde5] p-4">
            <div>
              <h2 className="font-black text-[#17202a]">Cash movement</h2>
              <p className="text-sm text-[#6a7483]">Sample weekly activity.</p>
            </div>
            <button className="rounded-lg border border-[#b9c2cf] px-4 py-2 text-sm font-black" type="button" onClick={() => setActiveTab("Event Billing")}>Open event billing</button>
          </div>
          <div className="flex h-52 items-end gap-3 p-6">
            {cashMovementBars.map((bar) => (
              <div key={bar.day} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-black">{bar.label}</span>
                <div className={`w-full rounded-t-md ${bar.className}`} />
                <span className="text-xs text-[#6a7483]">{bar.day}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
          <div className="border-b border-[#d8dde5] p-4">
            <h2 className="font-black text-[#17202a]">Recent bank transactions</h2>
            <p className="text-sm text-[#6a7483]">Imported from connected bank or file upload.</p>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-[#6a7483]">
                <tr>{["Date", "Transaction", "Category", "Event", "Amount"].map((head) => <th key={head} className="border-b border-[#d8dde5] py-3">{head}</th>)}</tr>
              </thead>
              <tbody>
                {transactions.map(([date, name, category, event, amount, tone]) => (
                  <tr key={`${date}-${name}`} className="border-b border-[#d8dde5]">
                    <td className="py-3">{date}</td>
                    <td className="font-black">{name}</td>
                    <td>{category}</td>
                    <td>{event}</td>
                    <td className={`text-right font-black ${tone === "green" ? "text-[#146c43]" : "text-[#a62b24]"}`}>{amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#d8dde5] p-4">
            <div>
              <h2 className="font-black text-[#17202a]">Open balances</h2>
              <p className="text-sm text-[#6a7483]">Invoices that still need payment.</p>
            </div>
            <button className="rounded-lg border border-[#b9c2cf] px-4 py-2 text-sm font-black" type="button" onClick={() => setActiveTab("Invoices")}>Open invoices</button>
          </div>
          <div className="space-y-3 p-4">
            {["INV-1028 - Friedman", "INV-1029 - Klein", "INV-1030 - Weiss", "INV-1031 - Green"].map((invoice, index) => (
              <article key={invoice} className="rounded-lg border border-[#d8dde5] p-4">
                <h3 className="font-black">{invoice}</h3>
                <p className="text-sm text-[#6a7483]">{["$30,220 open. Due Jul 1, 2026.", "$15,060 open. Due Jul 5, 2026.", "$5 open. Due Paid.", "$9,040 open. Due Jul 12, 2026."][index]}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function TransactionsTab({ openModal }: { openModal: () => void }) {
  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[430px_1fr]">
      <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="border-b border-[#d8dde5] p-4">
          <h2 className="font-black">Transactions</h2>
          <p className="text-sm text-[#6a7483]">Bank feed and imported entries.</p>
        </div>
        <div className="space-y-3 p-4">
          <label className="block text-xs font-black uppercase tracking-[0.08em] text-[#6a7483]">Search</label>
          <input className="h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm" placeholder="Merchant, memo, client, amount" />
          <div className="grid grid-cols-2 gap-2">
            <select className="h-10 rounded-lg border border-[#b9c2cf] px-3 text-sm" aria-label="Transaction status filter" title="Transaction status filter"><option>Needs review</option></select>
            <select className="h-10 rounded-lg border border-[#b9c2cf] px-3 text-sm" aria-label="Transaction category filter" title="Transaction category filter"><option>All categories</option></select>
          </div>
          <button className="w-full rounded-lg border border-[#1f4d73] bg-[#eef4fa] p-3 text-left" type="button" onClick={openModal}>
            <div className="flex justify-between font-black"><span>Zelle Yidel Graus</span><span className="text-[#146c43]">$3,900</span></div>
            <p className="text-xs text-[#6a7483]">Jun 29 - Zelle payment from YIDEL GRAUS XXXXXXX5312</p>
            <div className="mt-2 flex gap-2"><Pill tone="gold">Unassigned</Pill><Pill>Uncategorized</Pill><Pill tone="gray">1 splits</Pill></div>
          </button>
          <article className="rounded-lg border border-[#d8dde5] p-3">
            <div className="flex justify-between font-black"><span>Payroll</span><span className="text-[#a62b24]">-$5,200</span></div>
            <p className="text-xs text-[#6a7483]">Jun 27 - Waiter payroll weekend events</p>
            <div className="mt-2 flex gap-2"><Pill tone="gold">Unassigned</Pill><Pill>Staff Payroll</Pill><Pill tone="gray">1 splits</Pill></div>
          </article>
        </div>
      </section>

      <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#d8dde5] p-4">
          <div>
            <h2 className="text-2xl font-black">Transaction review</h2>
            <p className="text-sm text-[#6a7483]">Open any bank transaction from the list. Review opens as a centered posting popup.</p>
          </div>
          <TopAction label="Review transactions" tone="primary" />
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <StatCard label="Needs Review" value="2" note="Pending bank items" />
          <StatCard label="Assigned" value="5" note="Posted or matched" />
          <StatCard label="Open Balance" value="$54,325" note="Across invoices" />
        </div>
        <div className="mx-4 rounded-lg border border-[#9a5b00] bg-[#fbfcfd] p-3 text-sm text-[#9a5b00]">
          This area stays in the billing module. The transaction posting screen opens as a popup in the same tall ratio as the reference.
        </div>
      </section>
    </div>
  );
}

function InvoicesTab() {
  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[430px_1fr]">
      <section className="rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div><h2 className="font-black">Invoices</h2><p className="text-sm text-[#6a7483]">Draft, send, and receive payment.</p></div>
          <TopAction label="New" />
        </div>
        <input className="mt-5 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm" placeholder="Invoice, client, status" />
        <select className="mt-3 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm" aria-label="Invoice status filter" title="Invoice status filter"><option>All invoices</option></select>
        <div className="mt-3 space-y-2">
          {["INV-1028 - Friedman", "INV-1029 - Klein", "INV-1030 - Weiss", "INV-1031 - Green"].map((invoice, index) => (
            <article key={invoice} className={`rounded-lg border p-3 ${index === 1 ? "border-[#1f4d73] bg-[#eef4fa]" : "border-[#d8dde5]"}`}>
              <div className="flex justify-between font-black"><span>{invoice}</span><span>{["$48,220", "$17,560", "$22,855", "$9,040"][index]}</span></div>
              <p className="text-xs text-[#6a7483]">{["Jun 12, 2026 - Due Jul 1, 2026", "Jun 16, 2026 - Due Jul 5, 2026", "Jun 20, 2026 - Due Paid", "Jun 24, 2026 - Due Jul 12, 2026"][index]}</p>
              <div className="mt-2 flex gap-2"><Pill tone={index === 2 ? "green" : index === 3 ? "gold" : "red"}>{index === 2 ? "Paid" : index === 3 ? "Draft" : "Open"}</Pill><Pill>Balance {["$30,220", "$15,060", "$5", "$9,040"][index]}</Pill></div>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#d8dde5] p-4">
          <div><h2 className="text-2xl font-black">INV-1029</h2><p className="text-sm text-[#6a7483]">Klein - Sheva Brachos</p></div>
          <div className="flex gap-2"><TopAction label="Record payment" /><TopAction icon="print" label="Print" /><TopAction label="Save invoice" tone="primary" /></div>
        </div>
        <div className="grid gap-2 p-4 md:grid-cols-5">
          <StatCard label="Total" value="$17,560" note="" />
          <StatCard label="Payments" value="$2,500" note="" tone="green" />
          <StatCard label="Balance" value="$15,060" note="" tone="gold" />
          <StatCard label="Status" value="Open" note="" />
          <StatCard label="Due" value="Jul 5, 2026" note="" />
        </div>
        <div className="grid gap-4 p-4 pt-0 xl:grid-cols-2">
          <article className="rounded-xl border border-[#d8dde5] p-4">
            <div className="flex justify-between"><h3 className="font-black">Invoice builder</h3><TopAction label="Add item" /></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {["Client", "Status", "Due Date", "Event"].map((label, index) => <label key={label} className="text-xs font-black uppercase text-[#6a7483]">{label}<input className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm" defaultValue={["Klein", "Open", "Jul 5, 2026", "Klein - Jul 11, 2026"][index]} /></label>)}
            </div>
          </article>
          <article className="rounded-xl border border-[#d8dde5] p-4">
            <h3 className="font-black">Invoice preview</h3>
            <div className="mt-4 rounded-lg border border-[#d8dde5] p-4">
              <div className="flex justify-between"><strong>Event Core</strong><span className="text-right font-black">INV-1029<br /><span className="text-sm font-medium text-[#6a7483]">Due Jul 5, 2026</span></span></div>
              <div className="mt-6 space-y-2 text-sm"><div className="flex justify-between"><span>Dairy package</span><strong>$14,760</strong></div><div className="flex justify-between"><span>Room charge</span><strong>$2,800</strong></div></div>
              <p className="mt-4 text-right text-2xl font-black">$17,560</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

function EventBillingTab() {
  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[430px_1fr]">
      <section className="rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm">
        <h2 className="font-black">Event Billing</h2>
        <p className="text-sm text-[#6a7483]">Open a specific event billing workspace.</p>
        <input className="mt-5 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm" placeholder="Client, hall, date, status" />
        <select className="mt-3 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm" aria-label="Event billing balance filter" title="Event billing balance filter"><option>Open balance</option></select>
        <div className="mt-3 rounded-lg border border-[#9a5b00] bg-[#fbfcfd] p-3 text-sm text-[#9a5b00]">Events highlighted here have open invoice balances.</div>
        <div className="mt-3 space-y-2">
          {["Friedman", "Klein", "Weiss", "Green"].map((name, index) => (
            <article key={name} className="rounded-lg border border-[#9a5b00] bg-[#fbfcfd] p-3">
              <div className="flex justify-between font-black"><span>{name}</span><span>{["$29,320", "$15,060", "$22,855", "$9,040"][index]}</span></div>
              <p className="text-xs text-[#6a7483]">{["Jul 8, 2026 - Wedding - Grand Hall", "Jul 11, 2026 - Sheva Brachos - Nachlas Yehuda A", "Jul 14, 2026 - Bar Mitzvah - Terrace Room", "Jul 20, 2026 - Dinner - Small Hall"][index]}</p>
              <div className="mt-2 flex gap-2"><Pill tone="gold">Open balance</Pill><Pill>{index === 1 ? "Hold" : index === 3 ? "Proposal" : "Confirmed"}</Pill>{index < 3 ? <Pill tone="gold">Needs review</Pill> : null}</div>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#d8dde5] p-4">
          <div><h2 className="text-2xl font-black">Friedman</h2><p className="text-sm text-[#6a7483]">Wedding - Jul 8, 2026 - Grand Hall</p></div>
          <div className="flex gap-2"><TopAction label="Create invoice" /><TopAction label="Record payment" /><TopAction icon="print" label="Print statement" tone="primary" /></div>
        </div>
        <div className="grid gap-2 p-4 md:grid-cols-5">
          <StatCard label="Invoices" value="$48,220" note="" />
          <StatCard label="Paid" value="$18,900" note="" tone="green" />
          <StatCard label="Open Balance" value="$29,320" note="" tone="gold" />
          <StatCard label="Expenses" value="$7,640" note="" tone="red" />
          <StatCard label="Profit" value="$11,260" note="" />
        </div>
        <div className="grid gap-4 p-4 pt-0 xl:grid-cols-2">
          <article className="rounded-xl border border-[#d8dde5] p-4"><h3 className="font-black">Event billing summary</h3><dl className="mt-4 grid grid-cols-[140px_1fr] gap-3 text-sm"><dt className="font-black uppercase text-[#6a7483]">Client</dt><dd className="font-black">Friedman</dd><dt className="font-black uppercase text-[#6a7483]">Status</dt><dd className="font-black">Confirmed</dd><dt className="font-black uppercase text-[#6a7483]">Package</dt><dd className="font-black">Gold Dinner</dd><dt className="font-black uppercase text-[#6a7483]">Coordinator</dt><dd className="font-black">M. Stern</dd><dt className="font-black uppercase text-[#6a7483]">Due Date</dt><dd className="font-black">Jul 1, 2026</dd></dl></article>
          <article className="rounded-xl border border-[#d8dde5] p-4"><h3 className="font-black">Billing actions</h3><div className="mt-4 space-y-3">{["Create invoice for this event", "Make payment / record payment", "Assign bank transactions", "Client statement"].map((action) => <button key={action} className="h-10 w-full rounded-lg border border-[#b9c2cf] font-black" type="button">{action}</button>)}</div></article>
        </div>
      </section>
    </div>
  );
}

function SettingsTab() {
  const categories = ["Uncategorized", "Event Deposit", "Final Payment", "Vendor Cost", "Food Purchase", "Staff Payroll", "Linen Rental", "Equipment Rental", "Utilities", "Repairs", "Refund", "Office Expense"];

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[1fr_1fr]">
      <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="border-b border-[#d8dde5] p-4"><h2 className="font-black">Invoice settings</h2><p className="text-sm text-[#6a7483]">Controls invoice PDF and email defaults.</p></div>
        <div className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-black uppercase text-[#6a7483]">Business Name<input className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm" defaultValue="Event Core Demo Hall" /></label><label className="text-xs font-black uppercase text-[#6a7483]">Payment Terms<select className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm" aria-label="Payment terms" title="Payment terms"><option>Due before event</option></select></label></div>
          <label className="text-xs font-black uppercase text-[#6a7483]">Invoice Footer<textarea className="mt-1 h-24 w-full rounded-lg border border-[#b9c2cf] p-3 text-sm" defaultValue="Thank you. Please submit payment according to the agreed terms." /></label>
          <button className="h-10 w-full rounded-lg bg-[#1f4d73] text-sm font-black text-white" type="button">Save settings</button>
        </div>
      </section>
      <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="border-b border-[#d8dde5] p-4"><h2 className="font-black">Bank and categories</h2><p className="text-sm text-[#6a7483]">Rules for transaction review.</p></div>
        <div className="m-4 rounded-lg border border-[#9a5b00] bg-[#fbfcfd] p-3 text-sm text-[#9a5b00]">In production, bank transactions would come from a bank connection or CSV import. This prototype shows the approval workflow.</div>
        <table className="w-full text-left text-sm"><thead className="text-xs uppercase text-[#6a7483]"><tr><th className="border-y border-[#d8dde5] p-3">Category</th><th className="border-y border-[#d8dde5] p-3">Type</th></tr></thead><tbody>{categories.map((category, index) => <tr key={category}><td className="border-b border-[#d8dde5] p-3 font-black">{category}</td><td className="border-b border-[#d8dde5] p-3">{index === 1 || index === 2 ? "Income" : "Expense / General"}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}

function PendingTransactionModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/45 p-4">
      <section className="max-h-[92vh] w-full max-w-130 overflow-hidden rounded-3xl border border-white/40 bg-white shadow-2xl">
        <header className="bg-[#146c43] p-5 text-white">
          <div className="flex items-center justify-between">
            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60" type="button" onClick={onClose} aria-label="Close transaction review"><LineIcon name="back" /></button>
            <h2 className="text-xl font-black">Pending transaction</h2>
            <Pill tone="green">Needs review</Pill>
          </div>
        </header>
        <div className="max-h-[74vh] overflow-y-auto p-5">
          <article className="rounded-xl bg-white p-4 shadow-lg">
            <div className="flex justify-between"><h3 className="text-2xl font-black">Zelle Yidel Graus</h3><span className="text-[#6a7483]">6/29/26</span></div>
            <p className="text-sm uppercase text-[#6a7483]">BUS COMPLETE CHK (1909) - 1</p>
            <p className="text-center text-5xl font-black">$3,900</p>
          </article>
          <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-[#b9c2cf] text-sm font-black"><button className="h-12 bg-white" type="button">Categorize</button><button className="h-12 border-x border-[#b9c2cf] bg-white" type="button">Match</button><button className="h-12 bg-white" type="button">Transfer</button></div>
          <p className="mt-5 text-sm text-[#6a7483]">Confirm or edit how this transaction should post in Event Core.</p>
          <div className="mt-5 divide-y divide-[#d8dde5]">
            {["Category*|Uncategorized", "Split transaction|1 split lines", "From / To event|Unassigned", "Invoice|No invoice", "Attachment|Choose File  No file chosen"].map((row) => {
              const [label, value] = row.split("|");
              return <button key={label} className="flex w-full items-center justify-between py-4 text-left" type="button"><span><span className="block text-sm text-[#6a7483]">{label}</span><strong>{value}</strong></span><LineIcon name="chevron" className="h-5 w-5 text-[#6a7483]" /></button>;
            })}
          </div>
          <div className="mt-4 flex gap-3"><button className="rounded-lg border border-[#b9c2cf] px-4 text-sm font-black" type="button">Split</button><button className="h-12 flex-1 rounded-lg bg-[#146c43] font-black text-white" type="button" onClick={onClose}>Post</button></div>
        </div>
      </section>
    </div>
  );
}

function BillingContent({ activeTab, setActiveTab, openModal }: { activeTab: BillingTab; setActiveTab: (tab: BillingTab) => void; openModal: () => void }) {
  if (activeTab === "Transactions") return <TransactionsTab openModal={openModal} />;
  if (activeTab === "Invoices") return <InvoicesTab />;
  if (activeTab === "Event Billing") return <EventBillingTab />;
  if (activeTab === "Settings") return <SettingsTab />;
  return <DashboardTab setActiveTab={setActiveTab} />;
}

export function BillingPage() {
  const router = useRouter();
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(null);
  const [activeTab, setActiveTab] = useState<BillingTab>("Dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const cachedSyncData = getCachedSyncedUser();

    if (cachedSyncData) setSyncData(cachedSyncData);

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
        if (isMounted) setSyncData(synced);
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Billing"
        subtitle="Transactions, invoices, event billing, payments, and financial dashboard."
        actionsSlot={
          <>
            <TopAction icon="upload" label="Import bank file" />
            <TopAction icon="settings" label="Invoice settings" />
            <TopAction icon="plus" label="New invoice" tone="primary" />
          </>
        }
      />
      <section className="h-[calc(100vh-5rem)] bg-[#fbfcfd]">
        <div className="flex h-full flex-col">
          <BillingHeader activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <BillingContent activeTab={activeTab} setActiveTab={setActiveTab} openModal={() => setIsModalOpen(true)} />
          </div>
        </div>
      </section>
      {isModalOpen ? <PendingTransactionModal onClose={() => setIsModalOpen(false)} /> : null}
    </div>
  );
}
