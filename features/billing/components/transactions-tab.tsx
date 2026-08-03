"use client";

import { useMemo, useState } from "react";
import {
  LineIcon,
  Pill,
  type BillingResponse
} from "@/features/billing/components/billing-shared";

type SortKey = "date" | "amount" | "customer" | "status";
type TransactionStatus =
  | "Pending"
  | "Confirmed"
  | "Paid"
  | "Cancelled"
  | "Refunded";

type TransactionRow = {
  id: string;
  bookingId: string;
  customer: string;
  event: string;
  venue: string;
  type: string;
  date: string;
  dateValue: number;
  amount: number;
  paymentMethod: string;
  status: TransactionStatus;
  notes: string;
  schedule: string;
  billingSummary: string;
  activity: string[];
};

const statusTone: Record<TransactionStatus, "blue" | "green" | "gold" | "red" | "gray"> = {
  Cancelled: "gray",
  Confirmed: "blue",
  Paid: "green",
  Pending: "gold",
  Refunded: "red"
};

const sampleRows: TransactionRow[] = [
  {
    id: "TRX-1028",
    bookingId: "BK-1028",
    customer: "Goldman Family",
    event: "Goldman Family Wedding",
    venue: "Hall 1",
    type: "Invoice payment",
    date: "Jul 28, 2026",
    dateValue: new Date("2026-07-28").getTime(),
    amount: 15000,
    paymentMethod: "Bank transfer",
    status: "Paid",
    notes: "Deposit payment matched to wedding booking.",
    schedule: "Jul 28, 2026 at 2:00 AM",
    billingSummary: "$15,000 received / $0 due",
    activity: ["Created from billing workspace", "Payment marked as paid", "Receipt ready to print"]
  },
  {
    id: "TRX-1029",
    bookingId: "BK-1029",
    customer: "Klein",
    event: "Klein Sheva Brachos",
    venue: "Hall 1",
    type: "Open invoice",
    date: "Jul 29, 2026",
    dateValue: new Date("2026-07-29").getTime(),
    amount: 10000,
    paymentMethod: "Check",
    status: "Confirmed",
    notes: "Awaiting final payment confirmation.",
    schedule: "Jul 29, 2026 at 4:00 PM",
    billingSummary: "$10,000 total / confirmation pending",
    activity: ["Invoice created", "Client reminder scheduled", "Awaiting payment"]
  },
  {
    id: "TRX-1030",
    bookingId: "BK-1030",
    customer: "Weiss",
    event: "Weiss Bar Mitzvah",
    venue: "Hall 2",
    type: "Refund",
    date: "Jul 30, 2026",
    dateValue: new Date("2026-07-30").getTime(),
    amount: -5000,
    paymentMethod: "Card",
    status: "Refunded",
    notes: "Partial refund issued after package adjustment.",
    schedule: "Jul 30, 2026 at 6:30 PM",
    billingSummary: "$5,000 refunded",
    activity: ["Package changed", "Refund approved", "Refund receipt generated"]
  }
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(amount);
}

function normalizeStatus(status: string): TransactionStatus {
  const normalized = status.toLowerCase();

  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("refund")) return "Refunded";
  if (normalized.includes("paid")) return "Paid";
  if (normalized.includes("confirm")) return "Confirmed";
  return "Pending";
}

function buildRows(data: BillingResponse): TransactionRow[] {
  const apiRows = data.transactions.map((transaction, index) => {
    const amount = transaction.amountCents / 100;
    const date = new Date(transaction.createdAt);
    const customer = transaction.event?.clientName || "Unassigned customer";
    const status = normalizeStatus(transaction.status);

    return {
      id: transaction.id,
      bookingId: `BK-${String(index + 1).padStart(4, "0")}`,
      customer,
      event:
        transaction.event?.clientName && transaction.event.clientName !== customer
          ? transaction.event.clientName
          : `${customer} Event`,
      venue: index % 2 === 0 ? "Hall 1" : "Hall 2",
      type: amount < 0 ? "Refund" : "Payment",
      date: date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }),
      dateValue: date.getTime(),
      amount,
      paymentMethod: transaction.provider || "Manual entry",
      status,
      notes: "Synced from Event Core billing records.",
      schedule: "Connected event schedule",
      billingSummary: `${formatCurrency(Math.abs(amount))} ${amount < 0 ? "refunded" : "recorded"}`,
      activity: [
        "Transaction imported",
        `Status set to ${status}`,
        "Ready for review"
      ]
    } satisfies TransactionRow;
  });

  return apiRows.length ? apiRows : sampleRows;
}

function statusBadge(status: TransactionStatus) {
  return <Pill tone={statusTone[status]}>{status}</Pill>;
}

export function TransactionsTab({
  data,
  searchQuery,
  setSearchQuery
}: {
  data: BillingResponse;
  openModal: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState("All types");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [dateFilter, setDateFilter] = useState("All dates");
  const [venueFilter, setVenueFilter] = useState("All venues");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const rows = useMemo(() => buildRows(data), [data]);
  const [activeTransactionId, setActiveTransactionId] = useState(
    rows[0]?.id ?? ""
  );

  const filteredRows = useMemo(() => {
    const lowerSearch = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    return rows
      .filter((row) => {
        const matchesSearch =
          !lowerSearch ||
          [
            row.id,
            row.bookingId,
            row.customer,
            row.event,
            row.venue,
            row.type,
            row.paymentMethod,
            row.status
          ]
            .join(" ")
            .toLowerCase()
            .includes(lowerSearch);
        const matchesType = typeFilter === "All types" || row.type === typeFilter;
        const matchesStatus =
          statusFilter === "All statuses" || row.status === statusFilter;
        const matchesVenue = venueFilter === "All venues" || row.venue === venueFilter;
        const matchesDate =
          dateFilter === "All dates" ||
          (dateFilter === "Last 7 days" && now - row.dateValue <= day * 7) ||
          (dateFilter === "Last 30 days" && now - row.dateValue <= day * 30) ||
          (dateFilter === "This year" &&
            new Date(row.dateValue).getFullYear() === new Date().getFullYear());

        return (
          matchesSearch &&
          matchesType &&
          matchesStatus &&
          matchesVenue &&
          matchesDate
        );
      })
      .sort((a, b) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        if (sortKey === "amount") return (a.amount - b.amount) * direction;
        if (sortKey === "date") return (a.dateValue - b.dateValue) * direction;
        return a[sortKey].localeCompare(b[sortKey]) * direction;
      });
  }, [dateFilter, rows, searchQuery, sortDirection, sortKey, statusFilter, typeFilter, venueFilter]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const activeTransaction =
    rows.find((row) => row.id === activeTransactionId) ?? filteredRows[0] ?? rows[0];

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "customer" || nextKey === "status" ? "asc" : "desc");
  }

  function toggleRowSelection(rowId: string) {
    setSelectedIds((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId]
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col p-2 sm:p-4">
      <section className="flex min-h-0 flex-1 flex-col overflow-visible rounded-xl border border-[#d8dde5] bg-white shadow-sm md:overflow-hidden">
        <header className="border-b border-[#d8dde5] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6a7483]">
                Billing workspace
              </p>
              <h2 className="mt-1 text-xl font-black">Transactions</h2>
              <p className="text-sm text-[#6a7483]">
                Review, match, update, and track event-related payments.
              </p>
            </div>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white shadow-md shadow-[#1f4d73]/15 transition hover:bg-[#15344f]"
              type="button"
            >
              <LineIcon name="plus" />
              New Transaction
            </button>
          </div>
        </header>

        <div className="border-b border-[#d8dde5] bg-[#fbfcfd] p-3">
          <div className="grid gap-2 lg:grid-cols-[minmax(15rem,1.5fr)_repeat(5,minmax(8rem,1fr))]">
            <label className="relative min-w-0">
              <LineIcon
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6a7483]"
                name="search"
              />
              <input
                className="h-10 w-full rounded-lg border border-[#b9c2cf] bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/10"
                name="transactionSearch"
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search transactions, customers, events"
                type="search"
                value={searchQuery}
              />
            </label>

            {[
              ["Transaction Type", typeFilter, setTypeFilter, ["All types", "Payment", "Refund", "Invoice payment", "Open invoice"]],
              ["Status", statusFilter, setStatusFilter, ["All statuses", "Pending", "Confirmed", "Paid", "Cancelled", "Refunded"]],
              ["Date range", dateFilter, setDateFilter, ["All dates", "Last 7 days", "Last 30 days", "This year"]],
              ["Venue", venueFilter, setVenueFilter, ["All venues", "Hall 1", "Hall 2"]],
              ["Sort", `${sortKey}:${sortDirection}`, (value: string) => {
                const [key, direction] = value.split(":") as [SortKey, "asc" | "desc"];
                setSortKey(key);
                setSortDirection(direction);
              }, ["date:desc", "date:asc", "amount:desc", "amount:asc", "customer:asc", "status:asc"]]
            ].map(([label, value, setter, options]) => (
              <select
                aria-label={`${label} filter`}
                className="h-10 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/10"
                key={label as string}
                onChange={(event) => {
                  (setter as (value: string) => void)(event.target.value);
                  setPage(1);
                }}
                value={value as string}
              >
                {(options as string[]).map((option) => (
                  <option key={option} value={option}>
                    {option.includes(":")
                      ? option
                          .replace("date", "Date")
                          .replace("amount", "Amount")
                          .replace("customer", "Customer")
                          .replace("status", "Status")
                          .replace(":desc", " newest/highest")
                          .replace(":asc", " oldest/A-Z")
                      : option}
                  </option>
                ))}
              </select>
            ))}
          </div>

          {selectedIds.length ? (
            <div className="mt-3 hidden flex-wrap items-center justify-between gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-sm md:flex">
              <span className="font-black text-[#1f4d73]">
                {selectedIds.length} selected
              </span>
              <div className="flex flex-wrap gap-2">
                {["Print", "Export", "Mark as Paid", "Cancel Transaction"].map(
                  (action) => (
                    <button
                      className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black transition hover:bg-[#eef4fa]"
                      key={action}
                      type="button"
                    >
                      {action}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 max-lg:flex-none lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 max-md:overflow-visible md:overflow-auto">
            <div className="divide-y divide-[#eef1f4] md:hidden">
              {pageRows.map((row) => {
                const isActive = activeTransaction?.id === row.id;

                return (
                  <button
                    className={`grid w-full grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-2 px-3 py-3 text-left transition hover:bg-[#f7fbff] ${
                      isActive ? "bg-[#eef4fa]" : "bg-white"
                    }`}
                    key={row.id}
                    onClick={() => setActiveTransactionId(row.id)}
                    type="button"
                  >
                    <span
                      className="pt-0.5"
                      onClick={(event) => event.stopPropagation()}
                      role="presentation"
                    >
                      <input
                        aria-label={`Select ${row.id}`}
                        checked={selectedIds.includes(row.id)}
                        className="h-4 w-4 accent-[#1f4d73]"
                        onChange={() => toggleRowSelection(row.id)}
                        type="checkbox"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-[#121c2b]">
                        {row.customer}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-semibold text-[#6a7483]">
                        {row.bookingId} · {row.event}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {statusBadge(row.status)}
                        <span className="rounded-full border border-[#d8dde5] bg-white px-2 py-1 text-[0.68rem] font-black text-[#6a7483]">
                          {row.venue}
                        </span>
                        <span className="rounded-full border border-[#d8dde5] bg-white px-2 py-1 text-[0.68rem] font-black text-[#6a7483]">
                          {row.type}
                        </span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span
                        className={`block whitespace-nowrap text-sm font-black ${
                          row.amount < 0 ? "text-[#a62b24]" : "text-[#146c43]"
                        }`}
                      >
                        {formatCurrency(row.amount)}
                      </span>
                      <span className="mt-1 block whitespace-nowrap text-xs text-[#6a7483]">
                        {row.date}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <table className="hidden min-w-[1120px] w-full border-separate border-spacing-0 text-left text-sm md:table">
              <thead className="sticky top-0 z-10 bg-[#f7f9fb] text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#6a7483] shadow-[0_1px_0_#d8dde5]">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      aria-label="Select all visible transactions"
                      checked={pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id))}
                      className="h-4 w-4 accent-[#1f4d73]"
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked
                            ? Array.from(new Set([...current, ...pageRows.map((row) => row.id)]))
                            : current.filter((id) => !pageRows.some((row) => row.id === id))
                        )
                      }
                      type="checkbox"
                    />
                  </th>
                  {[
                    ["Booking / Transaction", "date"],
                    ["Customer", "customer"],
                    ["Event", "customer"],
                    ["Venue", "customer"],
                    ["Type", "customer"],
                    ["Date", "date"],
                    ["Amount", "amount"],
                    ["Method", "customer"],
                    ["Status", "status"]
                  ].map(([label, key]) => (
                    <th className="px-3 py-3" key={label}>
                      <button
                        className="inline-flex items-center gap-1 hover:text-[#1f4d73]"
                        onClick={() => toggleSort(key as SortKey)}
                        type="button"
                      >
                        {label}
                        <span className="text-[0.6rem]">
                          {sortKey === key ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const isActive = activeTransaction?.id === row.id;

                  return (
                    <tr
                      className={`cursor-pointer border-b border-[#eef1f4] transition hover:bg-[#f7fbff] ${
                        isActive ? "bg-[#eef4fa]" : "bg-white"
                      }`}
                      key={row.id}
                      onClick={() => setActiveTransactionId(row.id)}
                      tabIndex={0}
                    >
                      <td className="border-b border-[#eef1f4] px-3 py-2" onClick={(event) => event.stopPropagation()}>
                        <input
                          aria-label={`Select ${row.id}`}
                          checked={selectedIds.includes(row.id)}
                          className="h-4 w-4 accent-[#1f4d73]"
                          onChange={() => toggleRowSelection(row.id)}
                          type="checkbox"
                        />
                      </td>
                      <td className="border-b border-[#eef1f4] px-3 py-2">
                        <p className="font-black text-[#121c2b]">{row.bookingId}</p>
                        <p className="text-xs text-[#6a7483]">{row.id}</p>
                      </td>
                      <td className="border-b border-[#eef1f4] px-3 py-2 font-semibold">{row.customer}</td>
                      <td className="max-w-48 truncate border-b border-[#eef1f4] px-3 py-2">{row.event}</td>
                      <td className="border-b border-[#eef1f4] px-3 py-2">{row.venue}</td>
                      <td className="border-b border-[#eef1f4] px-3 py-2">{row.type}</td>
                      <td className="border-b border-[#eef1f4] px-3 py-2">{row.date}</td>
                      <td className={`border-b border-[#eef1f4] px-3 py-2 text-right font-black ${row.amount < 0 ? "text-[#a62b24]" : "text-[#146c43]"}`}>
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="border-b border-[#eef1f4] px-3 py-2">{row.paymentMethod}</td>
                      <td className="border-b border-[#eef1f4] px-3 py-2">{statusBadge(row.status)}</td>
                      <td className="border-b border-[#eef1f4] px-3 py-2 text-right">
                        <button className="rounded-md px-2 py-1 text-xs font-black text-[#1f4d73] hover:bg-[#eef4fa]" type="button">
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!pageRows.length ? (
              <div className="flex min-h-70 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef4fa] text-[#1f4d73]">
                  <LineIcon className="h-6 w-6" name="payment" />
                </div>
                <h3 className="mt-4 text-lg font-black">No transactions found</h3>
                <p className="mt-1 max-w-md text-sm text-[#6a7483]">
                  Adjust your filters or create a new transaction to begin tracking payments.
                </p>
              </div>
            ) : null}
          </div>

          <TransactionDetailsPanel transaction={activeTransaction} />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d8dde5] bg-white px-4 py-3 text-sm text-[#6a7483]">
          <span>
            Showing {filteredRows.length ? (page - 1) * pageSize + 1 : 0}-
            {Math.min(page * pageSize, filteredRows.length)} of {filteredRows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] px-3 font-black disabled:opacity-40"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (pageNumber) => (
                <button
                  className={`h-9 min-w-9 rounded-lg border px-3 font-black ${
                    pageNumber === page
                      ? "border-[#1f4d73] bg-[#1f4d73] text-white"
                      : "border-[#b9c2cf] bg-white text-[#17202a]"
                  }`}
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                  type="button"
                >
                  {pageNumber}
                </button>
              )
            )}
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] px-3 font-black disabled:opacity-40"
              disabled={page === totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              type="button"
            >
              ›
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function TransactionDetailsPanel({
  transaction
}: {
  transaction?: TransactionRow;
}) {
  if (!transaction) {
    return (
      <aside className="hidden border-l border-[#d8dde5] bg-[#fbfcfd] p-4 lg:block">
        <p className="text-sm text-[#6a7483]">Select a transaction to view details.</p>
      </aside>
    );
  }

  return (
    <aside className="min-h-0 overflow-y-auto border-t border-[#d8dde5] bg-[#fbfcfd] p-4 lg:border-l lg:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6a7483]">
            Transaction details
          </p>
          <h3 className="mt-1 text-lg font-black">{transaction.id}</h3>
          <div className="mt-2">{statusBadge(transaction.status)}</div>
        </div>
        <button className="rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-xs font-black hover:bg-[#eef4fa]" type="button">
          Edit
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <DetailBlock
          title="Booking Information"
          rows={[
            ["Booking ID", transaction.bookingId],
            ["Event", transaction.event],
            ["Venue", transaction.venue]
          ]}
        />
        <DetailBlock
          title="Customer Information"
          rows={[
            ["Customer", transaction.customer],
            ["Schedule", transaction.schedule],
            ["Notes", transaction.notes]
          ]}
        />
        <DetailBlock
          title="Payment Information"
          rows={[
            ["Type", transaction.type],
            ["Amount", formatCurrency(transaction.amount)],
            ["Payment Method", transaction.paymentMethod],
            ["Date", transaction.date]
          ]}
        />
        <DetailBlock
          title="Billing Summary"
          rows={[["Summary", transaction.billingSummary]]}
        />
      </div>

      <div className="mt-4 rounded-xl border border-[#d8dde5] bg-white p-4">
        <h4 className="font-black">Timeline / Activity History</h4>
        <ol className="mt-3 space-y-3">
          {transaction.activity.map((item) => (
            <li className="flex gap-3 text-sm" key={item}>
              <span className="mt-1 h-2 w-2 rounded-full bg-[#1f4d73]" />
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {["Print", "Export", "Mark as Paid", "Cancel Transaction", "Delete"].map(
          (action) => (
            <button
              className={`h-10 rounded-lg border px-3 text-xs font-black transition ${
                action === "Delete" || action === "Cancel Transaction"
                  ? "border-[#e7b4b0] bg-white text-[#a62b24] hover:bg-[#fff7f6]"
                  : action === "Mark as Paid"
                    ? "border-[#1f4d73] bg-[#1f4d73] text-white hover:bg-[#15344f]"
                    : "border-[#b9c2cf] bg-white text-[#17202a] hover:bg-[#eef4fa]"
              }`}
              key={action}
              type="button"
            >
              {action}
            </button>
          )
        )}
      </div>
    </aside>
  );
}

function DetailBlock({
  rows,
  title
}: {
  rows: Array<[string, string]>;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-[#d8dde5] bg-white p-4">
      <h4 className="font-black">{title}</h4>
      <dl className="mt-3 grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3" key={label}>
            <dt className="text-xs font-black uppercase tracking-[0.08em] text-[#6a7483]">
              {label}
            </dt>
            <dd className="min-w-0 font-semibold text-[#17202a]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
