"use client";

import { type ReactNode, useMemo, useEffect, useState } from "react";
import {
  type IconName,
  LineIcon,
  Pill,
  type BillingResponse
} from "@/features/billing/components/billing-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

type SortKey = "date" | "amount" | "customer" | "status";
type ReviewFilter = "All" | "Needs review" | "Matched" | "Paid";
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
  email: string;
  phone: string;
  event: string;
  eventType: string;
  venue: string;
  venueLocation: string;
  venueCapacity: string;
  type: string;
  date: string;
  dateValue: number;
  startTime: string;
  endTime: string;
  amount: number;
  paidAmount: number;
  paymentMethod: string;
  referenceNo: string;
  status: TransactionStatus;
  notes: string;
  activity: Array<{
    actor: string;
    description: string;
    time: string;
    title: string;
  }>;
};

const statusTone: Record<
  TransactionStatus,
  "blue" | "green" | "gold" | "red" | "gray"
> = {
  Cancelled: "red",
  Confirmed: "blue",
  Paid: "green",
  Pending: "gold",
  Refunded: "gray"
};

const sampleRows: TransactionRow[] = [
  {
    id: "TRX-0001",
    bookingId: "BK-0001",
    customer: "Graph Demo Client",
    email: "client@example.com",
    phone: "+63 912 345 6789",
    event: "Graph Demo Event 14",
    eventType: "Conference",
    venue: "Main Hall",
    venueLocation: "123 Event Street, Manila",
    venueCapacity: "200 pax",
    type: "Payment",
    date: "Jul 27, 2026",
    dateValue: new Date("2026-07-27").getTime(),
    startTime: "09:00 AM",
    endTime: "05:00 PM",
    amount: 8000,
    paidAmount: 8000,
    paymentMethod: "Bank Transfer",
    referenceNo: "TRX-20260727-001",
    status: "Paid",
    notes: "This is a demo transaction for Graph Demo Event 14.",
    activity: [
      {
        actor: "Admin",
        description: "Payment of $8,000.00 via Bank Transfer",
        time: "Jul 27, 2026 10:30 AM",
        title: "Payment received"
      },
      {
        actor: "Admin",
        description: "Transaction BK-0001 was created",
        time: "Jul 27, 2026 09:15 AM",
        title: "Transaction created"
      }
    ]
  },
  {
    id: "TRX-0002",
    bookingId: "BK-0002",
    customer: "Juan Dela Cruz",
    email: "juan@example.com",
    phone: "+63 917 555 1122",
    event: "Wedding Reception",
    eventType: "Wedding",
    venue: "Hall 1",
    venueLocation: "Event Core Hall 1",
    venueCapacity: "180 pax",
    type: "Invoice",
    date: "Jul 26, 2026",
    dateValue: new Date("2026-07-26").getTime(),
    startTime: "06:00 PM",
    endTime: "11:00 PM",
    amount: 12500,
    paidAmount: 0,
    paymentMethod: "Pending",
    referenceNo: "TRX-20260726-002",
    status: "Pending",
    notes: "Waiting for client payment confirmation.",
    activity: [
      {
        actor: "Admin",
        description: "Invoice prepared and sent to customer",
        time: "Jul 26, 2026 11:00 AM",
        title: "Invoice sent"
      }
    ]
  },
  {
    id: "TRX-0003",
    bookingId: "BK-0003",
    customer: "Maria Santos",
    email: "maria@example.com",
    phone: "+63 920 444 1212",
    event: "Birthday Celebration",
    eventType: "Birthday",
    venue: "Hall 2",
    venueLocation: "Event Core Hall 2",
    venueCapacity: "120 pax",
    type: "Deposit",
    date: "Jul 25, 2026",
    dateValue: new Date("2026-07-25").getTime(),
    startTime: "01:00 PM",
    endTime: "05:00 PM",
    amount: 5500,
    paidAmount: 2500,
    paymentMethod: "Card",
    referenceNo: "TRX-20260725-003",
    status: "Confirmed",
    notes: "Deposit received, balance remains open.",
    activity: [
      {
        actor: "Admin",
        description: "Deposit marked confirmed",
        time: "Jul 25, 2026 03:45 PM",
        title: "Deposit confirmed"
      }
    ]
  },
  {
    id: "TRX-0004",
    bookingId: "BK-0004",
    customer: "ABC Company",
    email: "billing@abc.example",
    phone: "+1 718 555 0123",
    event: "Corporate Seminar",
    eventType: "Corporate",
    venue: "Grand Hall",
    venueLocation: "Main Building",
    venueCapacity: "300 pax",
    type: "Payment",
    date: "Jul 24, 2026",
    dateValue: new Date("2026-07-24").getTime(),
    startTime: "10:00 AM",
    endTime: "04:00 PM",
    amount: 18000,
    paidAmount: 18000,
    paymentMethod: "ACH",
    referenceNo: "TRX-20260724-004",
    status: "Paid",
    notes: "Corporate seminar paid in full.",
    activity: [
      {
        actor: "Admin",
        description: "Payment matched to corporate seminar",
        time: "Jul 24, 2026 01:10 PM",
        title: "Payment received"
      }
    ]
  }
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
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

export function buildRows(data: BillingResponse): TransactionRow[] {
  // Keep the transaction screen empty when the tenant has no billing records.
  // The former sample fallback made UI-only rows look like production data.
  void sampleRows;
  const apiRows = data.transactions.map((transaction, index) => {
    const amount = transaction.amountCents / 100;
    const date = new Date(transaction.createdAt);
    const customer = transaction.event?.clientName || "Unassigned customer";
    const status = normalizeStatus(transaction.status);

    return {
      id: transaction.id,
      bookingId: `BK-${String(index + 1).padStart(4, "0")}`,
      customer,
      email: "",
      phone: "",
      event: transaction.event?.clientName
        ? `${transaction.event.clientName} Event`
        : "Unassigned Event",
      eventType: amount < 0 ? "Refund" : "Event Payment",
      venue: "Not linked",
      venueLocation: "",
      venueCapacity: "",
      type: amount < 0 ? "Refund" : "Payment",
      date: date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }),
      dateValue: date.getTime(),
      startTime: "",
      endTime: "",
      amount,
      paidAmount: status === "Paid" ? amount : 0,
      paymentMethod: transaction.provider || "Manual Entry",
      referenceNo: `TRX-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(index + 1).padStart(3, "0")}`,
      status,
      notes: "Synced from Event Core billing records.",
      activity: [
        {
          actor: "Admin",
          description: `Transaction status set to ${status}`,
          time: `${date.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric"
          })} 09:15 AM`,
          title: "Transaction updated"
        },
        {
          actor: "Admin",
          description: "Transaction was imported into Event Core",
          time: `${date.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric"
          })} 09:00 AM`,
          title: "Transaction created"
        }
      ]
    } satisfies TransactionRow;
  });

  return apiRows;
}

function statusBadge(status: TransactionStatus) {
  return <Pill tone={statusTone[status]}>{status}</Pill>;
}

function transactionIconName(row: TransactionRow): IconName {
  if (row.type.toLowerCase().includes("invoice")) return "invoice";
  if (row.type.toLowerCase().includes("refund")) return "back";
  if (row.status === "Pending") return "more";
  return "payment";
}

function transactionMonthLabel(row?: TransactionRow) {
  if (!row) return "";

  return new Date(row.dateValue).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

function transactionShortDate(row: TransactionRow) {
  return new Date(row.dateValue).toLocaleDateString("en-US", {
    day: "numeric",
    month: "numeric",
    year: "2-digit"
  });
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
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("All");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manualRows, setManualRows] = useState<TransactionRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, TransactionStatus>
  >({});
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);
  const [actionMessage, setActionMessage] = useState("");
  const [isPlaidDialogOpen, setIsPlaidDialogOpen] = useState(false);
  const [isBankConnected, setIsBankConnected] = useState(false);
  const [isPlaidBusy, setIsPlaidBusy] = useState(false);

  useEffect(() => {
    async function hydrateConnectionState() {
      try {
        const response = await authenticatedFetch(
          "/api/billing/plaid/connection"
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (payload?.connected) {
          setIsBankConnected(true);
        }
      } catch {
        // ignore and keep the UI in the current state
      }
    }

    void hydrateConnectionState();
  }, []);
  const [detailsTransactionId, setDetailsTransactionId] = useState<
    string | null
  >(null);
  const rows = useMemo(() => {
    const allRows = [...manualRows, ...buildRows(data)];

    return allRows
      .filter((row) => !deletedIds.includes(row.id))
      .map((row) => {
        const overrideStatus = statusOverrides[row.id];

        return overrideStatus
          ? {
              ...row,
              paidAmount:
                overrideStatus === "Paid" ? row.amount : row.paidAmount,
              status: overrideStatus
            }
          : row;
      });
  }, [data, deletedIds, manualRows, statusOverrides]);

  const filteredRows = useMemo(() => {
    const lowerSearch = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    return rows
      .filter((row) => {
        const matchesSearch =
          !lowerSearch ||
          [
            row.bookingId,
            row.id,
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
        const matchesType =
          typeFilter === "All types" || row.type === typeFilter;
        const matchesStatus =
          statusFilter === "All statuses" || row.status === statusFilter;
        const matchesVenue =
          venueFilter === "All venues" || row.venue === venueFilter;
        const matchesReview =
          reviewFilter === "All" ||
          (reviewFilter === "Needs review" &&
            ["Pending", "Confirmed"].includes(row.status)) ||
          (reviewFilter === "Matched" &&
            ["Confirmed", "Paid"].includes(row.status)) ||
          (reviewFilter === "Paid" && row.status === "Paid");
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
          matchesReview &&
          matchesDate
        );
      })
      .sort((a, b) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        if (sortKey === "amount") return (a.amount - b.amount) * direction;
        if (sortKey === "date") return (a.dateValue - b.dateValue) * direction;
        return a[sortKey].localeCompare(b[sortKey]) * direction;
      });
  }, [
    dateFilter,
    rows,
    searchQuery,
    sortDirection,
    sortKey,
    statusFilter,
    typeFilter,
    venueFilter,
    reviewFilter
  ]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const detailsTransaction =
    rows.find((row) => row.id === detailsTransactionId) ?? null;
  const typeOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.type))).sort(),
    [rows]
  );
  const reviewCounts = {
    All: rows.length,
    "Needs review": rows.filter((row) =>
      ["Pending", "Confirmed"].includes(row.status)
    ).length,
    Matched: rows.filter((row) => ["Confirmed", "Paid"].includes(row.status))
      .length,
    Paid: rows.filter((row) => row.status === "Paid").length
  } satisfies Record<ReviewFilter, number>;

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(
      nextKey === "customer" || nextKey === "status" ? "asc" : "desc"
    );
  }

  function toggleRowSelection(rowId: string) {
    setSelectedIds((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId]
    );
  }

  function showActionMessage(message: string) {
    setActionMessage(message);
    window.setTimeout(() => setActionMessage(""), 2600);
  }

  async function completePlaidPreview() {
    setIsPlaidBusy(true);
    try {
      const response = await authenticatedFetch(
        "/api/billing/plaid/link-token",
        { method: "POST" }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to start bank connection.");
      }

      const { linkToken } = await response.json();

      if (!linkToken) {
        throw new Error("Plaid link token was not returned.");
      }

      const plaidScript = await ensurePlaidScript();
      const plaid = (
        window as typeof window & {
          Plaid?: { create: (config: unknown) => { open: () => void } };
        }
      ).Plaid;
      if (!plaid?.create) {
        throw new Error(
          plaidScript
            ? "Plaid Link could not be initialized."
            : "Plaid is not available in this browser session."
        );
      }

      const handler = plaid.create({
        token: linkToken,
        onSuccess: async (
          publicToken: string,
          metadata: {
            institution?: { name?: string; institution_id?: string };
            accounts?: Array<{ id?: string; name?: string; type?: string }>;
          }
        ) => {
          try {
            const exchangeResponse = await authenticatedFetch(
              "/api/billing/plaid/exchange",
              {
                method: "POST",
                body: JSON.stringify({
                  publicToken,
                  institutionName: metadata.institution?.name,
                  institutionId: metadata.institution?.institution_id,
                  metadata: {
                    accountId: metadata.accounts?.[0]?.id,
                    accountName: metadata.accounts?.[0]?.name,
                    accountType: metadata.accounts?.[0]?.type
                  }
                })
              }
            );

            if (!exchangeResponse.ok) {
              const payload = await exchangeResponse.json().catch(() => ({}));
              throw new Error(
                payload.error ?? "Unable to save the bank connection."
              );
            }

            setIsBankConnected(true);
            setIsPlaidDialogOpen(false);
            showActionMessage("Bank account connected for this organization.");
          } catch (error) {
            showActionMessage(
              error instanceof Error
                ? error.message
                : "Could not complete the connection."
            );
          } finally {
            setIsPlaidBusy(false);
          }
        },
        onExit: () => {
          setIsPlaidBusy(false);
        }
      });

      handler.open();
    } catch (error) {
      setIsPlaidBusy(false);
      showActionMessage(
        error instanceof Error
          ? error.message
          : "Could not start the connection flow."
      );
    }
  }

  function resetFilters() {
    setSearchQuery("");
    setTypeFilter("All types");
    setStatusFilter("All statuses");
    setDateFilter("All dates");
    setVenueFilter("All venues");
    setReviewFilter("All");
    setSortKey("date");
    setSortDirection("desc");
    setPage(1);
    showActionMessage("Transaction filters were reset.");
  }

  function addNewTransaction() {
    const createdAt = Date.now();
    const nextNumber = rows.length + manualRows.length + 1;
    const newRow: TransactionRow = {
      activity: [
        {
          actor: "Admin",
          description: "Manual transaction created from Billing.",
          time: new Date(createdAt).toLocaleString("en-US", {
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            month: "short",
            year: "numeric"
          }),
          title: "Transaction created"
        }
      ],
      amount: 0,
      bookingId: `BK-${String(nextNumber).padStart(4, "0")}`,
      customer: "New customer",
      date: new Date(createdAt).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }),
      dateValue: createdAt,
      email: "client@example.com",
      endTime: "05:00 PM",
      event: "New event transaction",
      eventType: "Manual Entry",
      id: `TRX-MANUAL-${createdAt}`,
      notes: "New transaction created from Event Core Billing.",
      paidAmount: 0,
      paymentMethod: "Manual Entry",
      phone: "+1 718 555 0142",
      referenceNo: `TRX-${createdAt}`,
      startTime: "09:00 AM",
      status: "Pending",
      type: "Payment",
      venue: "Hall 1",
      venueCapacity: "200 pax",
      venueLocation: "Event Core venue"
    };

    setManualRows((current) => [newRow, ...current]);
    setDetailsTransactionId(newRow.id);
    setReviewFilter("All");
    setPage(1);
    showActionMessage("New transaction created.");
  }

  function exportTransactions(targetRows = filteredRows) {
    const headers = [
      "Transaction ID",
      "Booking ID",
      "Customer",
      "Event",
      "Venue",
      "Type",
      "Date",
      "Amount",
      "Payment Method",
      "Status"
    ];
    const csvRows = targetRows.map((row) =>
      [
        row.id,
        row.bookingId,
        row.customer,
        row.event,
        row.venue,
        row.type,
        row.date,
        row.amount.toFixed(2),
        row.paymentMethod,
        row.status
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "event-core-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
    showActionMessage("Transactions exported.");
  }

  function printTransactions(targetRows = filteredRows) {
    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) {
      showActionMessage("Allow popups to print transactions.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Event Core Transactions</title>
          <style>
            body { font-family: Arial, sans-serif; color: #17202a; padding: 24px; }
            h1 { margin: 0 0 16px; }
            table { border-collapse: collapse; width: 100%; font-size: 13px; }
            th, td { border-bottom: 1px solid #d8dde5; padding: 10px; text-align: left; }
            th { background: #eef4fa; }
            td.amount { text-align: right; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>Event Core Transactions</h1>
          <table>
            <thead>
              <tr><th>ID</th><th>Customer</th><th>Event</th><th>Venue</th><th>Date</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${targetRows
                .map(
                  (row) =>
                    `<tr><td>${row.bookingId}</td><td>${row.customer}</td><td>${row.event}</td><td>${row.venue}</td><td>${row.date}</td><td class="amount">${formatCurrency(row.amount)}</td><td>${row.status}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    showActionMessage("Print view opened.");
  }

  function updateTransactionStatus(
    rowIds: string[],
    status: TransactionStatus,
    message: string
  ) {
    setStatusOverrides((current) => {
      const next = { ...current };
      rowIds.forEach((id) => {
        next[id] = status;
      });
      return next;
    });
    setSelectedIds((current) => current.filter((id) => !rowIds.includes(id)));
    showActionMessage(message);
  }

  function deleteTransactions(rowIds: string[]) {
    setDeletedIds((current) => Array.from(new Set([...current, ...rowIds])));
    setSelectedIds((current) => current.filter((id) => !rowIds.includes(id)));
    if (detailsTransactionId && rowIds.includes(detailsTransactionId)) {
      setDetailsTransactionId(null);
    }
    showActionMessage(
      rowIds.length === 1 ? "Transaction removed." : "Transactions removed."
    );
  }

  return (
    <div className="relative flex h-auto min-w-0 flex-col p-2 sm:p-4 md:h-full">
      {detailsTransaction ? (
        <div className="md:hidden">
          <TransactionDetailsView
            onCancel={() =>
              updateTransactionStatus(
                [detailsTransaction.id],
                "Cancelled",
                "Transaction cancelled."
              )
            }
            onBack={() => setDetailsTransactionId(null)}
            onPost={() =>
              updateTransactionStatus(
                [detailsTransaction.id],
                "Paid",
                "Transaction posted and marked as paid."
              )
            }
            transaction={detailsTransaction}
          />
        </div>
      ) : null}

      <section
        className={`overflow-visible rounded-xl border border-[#d8dde5] bg-white shadow-sm md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-hidden ${
          detailsTransaction ? "hidden md:flex" : "block"
        }`}
      >
        {actionMessage ? (
          <div className="border-b border-[#d8dde5] bg-[#eef8ef] px-4 py-2 text-sm font-bold text-[#12863d]">
            {actionMessage}
          </div>
        ) : null}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6a7483]">
              Transaction Center
            </p>
            <h2 className="text-xl font-black text-[#17202a]">Transactions</h2>
            <p className="text-sm text-[#6a7483]">
              Review, match, update, and track event-related payments.
            </p>
          </div>
        </header>

        <PlaidConnectionPanel
          connected={isBankConnected}
          onConnect={() => setIsPlaidDialogOpen(true)}
          onDisconnect={() => {
            setIsBankConnected(false);
            showActionMessage("Bank connection preview disconnected.");
          }}
          onManage={() => setIsPlaidDialogOpen(true)}
          onSync={async () => {
            try {
              setIsPlaidBusy(true);
              const response = await authenticatedFetch(
                "/api/billing/plaid/transactions",
                { method: "POST" }
              );

              if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(
                  payload.error ?? "Unable to sync transactions."
                );
              }

              showActionMessage(
                "Bank transactions sync started for this organization."
              );
            } catch (error) {
              showActionMessage(
                error instanceof Error
                  ? error.message
                  : "Unable to sync transactions."
              );
            } finally {
              setIsPlaidBusy(false);
            }
          }}
        />

        <div className="border-b border-[#d8dde5] bg-white">
          <div className="hidden border-b border-[#d8dde5] px-4 md:flex">
            <button
              className={`relative h-14 px-5 text-sm font-black transition ${
                reviewFilter !== "Paid"
                  ? "text-[#17202a] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#26a641]"
                  : "text-[#6a7483] hover:text-[#17202a]"
              }`}
              onClick={() => {
                setReviewFilter("Needs review");
                setPage(1);
              }}
              type="button"
            >
              Pending ({reviewCounts["Needs review"]})
            </button>
            <button
              className={`relative h-14 px-5 text-sm font-black transition ${
                reviewFilter === "Paid"
                  ? "text-[#17202a] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#26a641]"
                  : "text-[#6a7483] hover:text-[#17202a]"
              }`}
              onClick={() => {
                setReviewFilter("Paid");
                setPage(1);
              }}
              type="button"
            >
              Paid ({reviewCounts.Paid})
            </button>
          </div>

          <div className="md:hidden">
            <div className="grid grid-cols-2 border-b border-[#d8dde5] bg-white text-center text-sm font-black text-[#6a7483]">
              <button
                className={`relative h-10 transition ${
                  reviewFilter !== "Paid"
                    ? "text-[#17202a] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#26a641]"
                    : "hover:bg-[#f6f8fa]"
                }`}
                onClick={() => {
                  setReviewFilter("Needs review");
                  setPage(1);
                }}
                type="button"
              >
                Pending ({reviewCounts["Needs review"]})
              </button>
              <button
                className={`relative h-10 transition ${
                  reviewFilter === "Paid"
                    ? "text-[#17202a] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#26a641]"
                    : "hover:bg-[#f6f8fa]"
                }`}
                onClick={() => {
                  setReviewFilter("Paid");
                  setPage(1);
                }}
                type="button"
              >
                Paid
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-2">
              <select
                aria-label="Sort mobile transactions"
                className="h-8 rounded-md border border-[#b9c2cf] bg-[#f6f8fa] px-2 text-xs font-bold text-[#526274] outline-none"
                onChange={(event) => {
                  const [key, direction] = event.target.value.split(":") as [
                    SortKey,
                    "asc" | "desc"
                  ];
                  setSortKey(key);
                  setSortDirection(direction);
                  setPage(1);
                }}
                value={`${sortKey}:${sortDirection}`}
              >
                <option value="date:desc">Sort by: Date</option>
                <option value="amount:desc">Sort by: Amount</option>
                <option value="customer:asc">Sort by: Customer</option>
                <option value="status:asc">Sort by: Status</option>
              </select>
              <select
                aria-label="Filter mobile transactions"
                className="h-8 rounded-md border border-[#b9c2cf] bg-[#f6f8fa] px-2 text-xs font-bold text-[#526274] outline-none"
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                value={statusFilter}
              >
                <option value="All statuses">Filter by: All</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Paid">Paid</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Refunded">Refunded</option>
              </select>
            </div>
          </div>

          <div
            className={`hidden gap-2 p-4 md:grid lg:grid-cols-3 ${
              isFilterPanelOpen ? "" : "md:hidden"
            }`}
          >
            <select
              aria-label="Sort transactions"
              className="h-10 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#526274] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/10"
              onChange={(event) => {
                const [key, direction] = event.target.value.split(":") as [
                  SortKey,
                  "asc" | "desc"
                ];
                setSortKey(key);
                setSortDirection(direction);
                setPage(1);
              }}
              value={`${sortKey}:${sortDirection}`}
            >
              <option value="date:desc">Sort: Newest</option>
              <option value="date:asc">Sort: Oldest</option>
              <option value="amount:desc">Sort: Amount high</option>
              <option value="amount:asc">Sort: Amount low</option>
              <option value="customer:asc">Sort: Customer</option>
            </select>
            <select
              aria-label="Status filter"
              className="h-10 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#526274] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/10"
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="All statuses">Status: All</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Paid">Paid</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Refunded">Refunded</option>
            </select>
            <select
              aria-label="Transaction type filter"
              className="h-10 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#526274] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/10"
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
              value={typeFilter}
            >
              <option value="All types">Filter: All</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {selectedIds.length ? (
            <div className="mt-3 hidden flex-wrap items-center justify-between gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 py-2 text-sm md:flex">
              <span className="font-black text-[#1f4d73]">
                {selectedIds.length} selected
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black transition hover:bg-[#eef4fa]"
                  onClick={() =>
                    printTransactions(
                      rows.filter((row) => selectedIds.includes(row.id))
                    )
                  }
                  type="button"
                >
                  Print
                </button>
                <button
                  className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black transition hover:bg-[#eef4fa]"
                  onClick={() =>
                    exportTransactions(
                      rows.filter((row) => selectedIds.includes(row.id))
                    )
                  }
                  type="button"
                >
                  Export
                </button>
                <button
                  className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black transition hover:bg-[#eef4fa]"
                  onClick={() =>
                    updateTransactionStatus(
                      selectedIds,
                      "Paid",
                      "Selected transactions marked as paid."
                    )
                  }
                  type="button"
                >
                  Mark as Paid
                </button>
                <button
                  className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black transition hover:bg-[#eef4fa]"
                  onClick={() =>
                    updateTransactionStatus(
                      selectedIds,
                      "Confirmed",
                      "Selected transactions matched."
                    )
                  }
                  type="button"
                >
                  Match
                </button>
                <button
                  className="h-8 rounded-lg border border-[#e3b4ad] bg-white px-3 text-xs font-black text-[#b22920] transition hover:bg-[#fff0ee]"
                  onClick={() =>
                    updateTransactionStatus(
                      selectedIds,
                      "Cancelled",
                      "Selected transactions cancelled."
                    )
                  }
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="overflow-visible md:min-h-0 md:flex md:flex-1 md:flex-col md:overflow-hidden">
          <div className="md:hidden">
            {pageRows.length ? (
              <div className="bg-[#eef1f4] px-4 py-2 text-xs font-bold text-[#6a7483]">
                {transactionMonthLabel(pageRows[0])}
              </div>
            ) : null}
            {pageRows.map((row) => (
              <button
                className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#e6ebf0] bg-white px-3 py-3 text-left transition active:bg-[#eef4fa]"
                key={row.id}
                onClick={() => setDetailsTransactionId(row.id)}
                type="button"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef1f4] text-[#526274]">
                  <LineIcon
                    className="h-4 w-4"
                    name={transactionIconName(row)}
                  />
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-[#17202a]">
                    {row.customer}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-semibold text-[#6a7483]">
                    {row.event}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] font-bold text-[#6a7483]">
                    <span className="truncate">{row.venue}</span>
                    <span>•</span>
                    <span>{row.type}</span>
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span
                    className={`block text-sm font-black ${
                      row.amount >= 0 ? "text-[#12863d]" : "text-[#17202a]"
                    }`}
                  >
                    {formatCurrency(row.amount)}
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-[#6a7483]">
                    {transactionShortDate(row)}
                  </span>
                  <span
                    className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                      row.status === "Paid"
                        ? "bg-[#e2f7eb] text-[#12863d]"
                        : row.status === "Pending"
                          ? "bg-[#fff4d8] text-[#a26800]"
                          : row.status === "Cancelled"
                            ? "bg-[#ffe8e4] text-[#b22920]"
                            : "bg-[#e8f1ff] text-[#1f5fbf]"
                    }`}
                  >
                    {row.status}
                  </span>
                </span>
              </button>
            ))}

            {!pageRows.length ? (
              <div className="flex min-h-70 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef4fa] text-[#1f4d73]">
                  <LineIcon className="h-6 w-6" name="payment" />
                </div>
                <h3 className="mt-4 text-lg font-black">
                  No transactions found
                </h3>
                <p className="mt-1 max-w-md text-sm text-[#6a7483]">
                  Adjust your filters or create a new transaction to begin
                  tracking payments.
                </p>
              </div>
            ) : null}
          </div>

          <div className="hidden md:flex md:flex-1 md:flex-col md:overflow-hidden">
            {pageRows.length ? (
              <div className="shrink-0 bg-[#eef1f4] px-5 py-3 text-sm font-black text-[#1f4d73]">
                {transactionMonthLabel(pageRows[0])}
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto">
              {pageRows.map((row) => (
                <button
                  className={`grid w-full grid-cols-[3.25rem_minmax(14rem,1.2fr)_minmax(12rem,1fr)_auto_7rem_1.5rem] items-center gap-4 border-b border-[#e0e5eb] px-5 py-4 text-left transition hover:bg-[#f7fbff] ${
                    detailsTransactionId === row.id
                      ? "border-l-4 border-l-[#26a641] bg-[#eef8ef]"
                      : "bg-white"
                  }`}
                  key={row.id}
                  onClick={() => setDetailsTransactionId(row.id)}
                  type="button"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f3f6] text-[#526274]">
                    <LineIcon
                      className="h-4 w-4"
                      name={transactionIconName(row)}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-black text-[#001428]">
                      {row.customer}
                    </span>
                    <span className="mt-1 block truncate text-sm font-semibold text-[#526274]">
                      ✦ {row.eventType}
                    </span>
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold text-[#526274]">
                    {row.venue || row.event}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      row.status === "Paid"
                        ? "bg-[#e2f7eb] text-[#12863d]"
                        : row.status === "Pending"
                          ? "bg-[#fff1c9] text-[#9b6500]"
                          : row.status === "Cancelled"
                            ? "bg-[#ffe8e4] text-[#b22920]"
                            : "bg-[#e8f1ff] text-[#1f5fbf]"
                    }`}
                  >
                    {row.status === "Pending" ? "Ready" : row.status}
                  </span>
                  <span className="text-right">
                    <span
                      className={`block text-base font-black ${
                        row.amount >= 0 ? "text-[#078342]" : "text-[#001428]"
                      }`}
                    >
                      {row.amount < 0 ? "-" : ""}
                      {formatCurrency(Math.abs(row.amount))}
                    </span>
                    <span className="mt-0.5 block text-sm font-semibold text-[#1f4d73]">
                      {transactionShortDate(row)}
                    </span>
                  </span>
                  <LineIcon className="h-4 w-4 text-[#526274]" name="chevron" />
                </button>
              ))}
            </div>
          </div>

          <table className="hidden w-full min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#f7f9fb] text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#6a7483] shadow-[0_1px_0_#d8dde5]">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    aria-label="Select all visible transactions"
                    checked={
                      pageRows.length > 0 &&
                      pageRows.every((row) => selectedIds.includes(row.id))
                    }
                    className="h-4 w-4 accent-[#1f4d73]"
                    onChange={(event) =>
                      setSelectedIds((current) =>
                        event.target.checked
                          ? Array.from(
                              new Set([
                                ...current,
                                ...pageRows.map((row) => row.id)
                              ])
                            )
                          : current.filter(
                              (id) => !pageRows.some((row) => row.id === id)
                            )
                      )
                    }
                    type="checkbox"
                  />
                </th>
                {[
                  ["Transaction ID", "date"],
                  ["Customer", "customer"],
                  ["Event", "customer"],
                  ["Venue", "customer"],
                  ["Type", "customer"],
                  ["Date", "date"],
                  ["Amount", "amount"],
                  ["Payment Method", "customer"],
                  ["Status", "status"]
                ].map(([label, key]) => (
                  <th className="px-4 py-3" key={label}>
                    <button
                      className="inline-flex items-center gap-1 hover:text-[#1f4d73]"
                      onClick={() => toggleSort(key as SortKey)}
                      type="button"
                    >
                      {label}
                      <span className="text-[0.6rem]">
                        {sortKey === key
                          ? sortDirection === "asc"
                            ? "â–²"
                            : "â–¼"
                          : ""}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="w-12 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr
                  className="cursor-pointer bg-white transition hover:bg-[#f7fbff]"
                  key={row.id}
                  onClick={() => setDetailsTransactionId(row.id)}
                  tabIndex={0}
                >
                  <td
                    className="border-b border-[#eef1f4] px-4 py-3"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      aria-label={`Select ${row.bookingId}`}
                      checked={selectedIds.includes(row.id)}
                      className="h-4 w-4 accent-[#1f4d73]"
                      onChange={() => toggleRowSelection(row.id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="border-b border-[#eef1f4] px-4 py-3">
                    <div>
                      <span className="font-black text-[#0f5fb8]">
                        {row.bookingId}
                      </span>
                      <p className="text-xs text-[#6a7483]">{row.id}</p>
                    </div>
                  </td>
                  <td className="border-b border-[#eef1f4] px-4 py-3 font-semibold">
                    {row.customer}
                  </td>
                  <td className="max-w-60 border-b border-[#eef1f4] px-4 py-3">
                    {row.event}
                  </td>
                  <td className="border-b border-[#eef1f4] px-4 py-3">
                    {row.venue}
                  </td>
                  <td className="border-b border-[#eef1f4] px-4 py-3">
                    {row.type}
                  </td>
                  <td className="border-b border-[#eef1f4] px-4 py-3">
                    {row.date}
                  </td>
                  <td className="border-b border-[#eef1f4] px-4 py-3 text-right font-black text-[#17202a]">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="border-b border-[#eef1f4] px-4 py-3">
                    {row.paymentMethod}
                  </td>
                  <td className="border-b border-[#eef1f4] px-4 py-3">
                    {statusBadge(row.status)}
                  </td>
                  <td className="border-b border-[#eef1f4] px-4 py-3 text-right">
                    <button
                      className="rounded-md px-2 py-1 text-lg font-black leading-none text-[#17202a] hover:bg-[#eef4fa]"
                      onClick={(event) => event.stopPropagation()}
                      type="button"
                    >
                      ⋮
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!pageRows.length ? (
            <div className="hidden min-h-70 flex-col items-center justify-center p-8 text-center md:flex">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef4fa] text-[#1f4d73]">
                <LineIcon className="h-6 w-6" name="payment" />
              </div>
              <h3 className="mt-4 text-lg font-black">No transactions found</h3>
              <p className="mt-1 max-w-md text-sm text-[#6a7483]">
                Adjust your filters or create a new transaction to begin
                tracking payments.
              </p>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d8dde5] bg-white px-4 py-3 text-sm text-[#6a7483]">
          <span>
            Showing {filteredRows.length ? (page - 1) * pageSize + 1 : 0} to{" "}
            {Math.min(page * pageSize, filteredRows.length)} of{" "}
            {filteredRows.length} transactions
          </span>
          <div className="flex items-center gap-1">
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] px-3 font-black disabled:opacity-40"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              &lt;
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
              &gt;
            </button>
          </div>
        </footer>
      </section>

      {detailsTransaction ? (
        <DesktopTransactionSidePanel
          onCancel={() =>
            updateTransactionStatus(
              [detailsTransaction.id],
              "Cancelled",
              "Transaction cancelled."
            )
          }
          onBack={() => setDetailsTransactionId(null)}
          onPost={() =>
            updateTransactionStatus(
              [detailsTransaction.id],
              "Paid",
              "Transaction posted and marked as paid."
            )
          }
          onPrint={() => printTransactions([detailsTransaction])}
          transaction={detailsTransaction}
        />
      ) : null}

      <PlaidConnectDialog
        connected={isBankConnected}
        onClose={() => setIsPlaidDialogOpen(false)}
        onConnect={completePlaidPreview}
        open={isPlaidDialogOpen}
        busy={isPlaidBusy}
      />
    </div>
  );
}

async function ensurePlaidScript() {
  if (typeof window === "undefined") return false;
  if ((window as typeof window & { Plaid?: unknown }).Plaid) return true;

  const existing = document.querySelector("script[data-plaid-link]");
  if (existing) {
    return new Promise<boolean>((resolve) => {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
    });
  }

  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.setAttribute("data-plaid-link", "true");
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function PlaidConnectionPanel({
  connected,
  onConnect,
  onDisconnect,
  onManage,
  onSync
}: {
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onManage: () => void;
  onSync: () => void;
}) {
  return (
    <section className="border-b border-[#d8dde5] bg-[#f8fbff] px-4 py-3">
      <div className="flex flex-col gap-3 rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between md:p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef4fa] text-[#1f4d73]">
            <LineIcon className="h-5 w-5" name="bank" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6a7483]">
              Plaid bank feed
            </p>
            <h3 className="text-base font-black text-[#17202a]">
              {connected
                ? "Business checking connected"
                : "Connect a bank account"}
            </h3>
            <p className="mt-1 text-sm text-[#526274]">
              {connected
                ? "Event Core demo bank •••• 1909 is ready to import and review transactions."
                : "Use Plaid to securely import bank transactions into this billing workspace."}
            </p>
          </div>
        </div>

        {connected ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <span className="rounded-full border border-[#9fd9b6] bg-[#e2f7eb] px-3 py-1 text-xs font-black text-[#12863d]">
              Connected
            </span>
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
              onClick={onSync}
              type="button"
            >
              Sync now
            </button>
            <button
              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
              onClick={onManage}
              type="button"
            >
              Manage
            </button>
            <button
              className="h-9 rounded-lg border border-[#e3b4ad] bg-white px-3 text-sm font-black text-[#b22920] transition hover:bg-[#fff0ee]"
              onClick={onDisconnect}
              type="button"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#1f4d73] bg-[#1f4d73] px-4 text-sm font-black text-white shadow-md shadow-[#1f4d73]/15 transition hover:bg-[#173a57]"
            onClick={onConnect}
            type="button"
          >
            <LineIcon className="h-4 w-4" name="plus" />
            Connect bank
          </button>
        )}
      </div>
    </section>
  );
}

function PlaidConnectDialog({
  connected,
  onClose,
  onConnect,
  open,
  busy
}: {
  connected: boolean;
  onClose: () => void;
  onConnect: () => void;
  open: boolean;
  busy: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#061126]/55 p-4 backdrop-blur-sm">
      <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#d8dde5] bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#d8dde5] px-5 py-4">
          <div className="flex gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#061126] text-white">
              <LineIcon className="h-6 w-6" name="bank" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1f4d73]">
                Plaid connection
              </p>
              <h2 className="text-xl font-black text-[#17202a]">
                Connect bank account
              </h2>
              <p className="mt-1 text-sm text-[#526274]">
                Link a business bank account so Event Core can import, review,
                match, and post transactions.
              </p>
            </div>
          </div>
          <button
            aria-label="Close Plaid connection"
            className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[#233144] shadow-none transition hover:bg-[#e4edf5] hover:text-[#1f4d73] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4d73]/25"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true" className="relative h-4 w-4">
              <span className="absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current transition-transform group-hover:scale-110" />
              <span className="absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current transition-transform group-hover:scale-110" />
            </span>
          </button>
        </header>

        <div className="grid gap-4 px-5 py-5 md:grid-cols-3">
          {[
            {
              title: "1. Secure login",
              text: "The user chooses their bank and signs in through Plaid, not inside Event Core.",
              icon: "payment" as IconName
            },
            {
              title: "2. Choose account",
              text: "Select the checking account to sync with the Billing transaction center.",
              icon: "bank" as IconName
            },
            {
              title: "3. Review feed",
              text: "Imported transactions appear here for matching, posting, and reporting.",
              icon: "invoice" as IconName
            }
          ].map((step) => (
            <article
              className="rounded-xl border border-[#d8dde5] bg-[#f8fbff] p-4"
              key={step.title}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#1f4d73] shadow-sm">
                <LineIcon className="h-5 w-5" name={step.icon} />
              </span>
              <h3 className="mt-3 text-sm font-black text-[#17202a]">
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-[#526274]">
                {step.text}
              </p>
            </article>
          ))}
        </div>

        <div className="border-t border-[#d8dde5] bg-[#f8fbff] px-5 py-4">
          <div className="rounded-xl border border-[#b9c2cf] bg-white p-4">
            <h3 className="font-black text-[#17202a]">
              What we still need for live Plaid
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-[#526274]">
              <li>
                • Plaid credentials must be configured in the server
                environment.
              </li>
              <li>
                • The connection is stored only for the active organization.
              </li>
              <li>
                • Bank transactions will sync into this billing workspace after
                the account is linked.
              </li>
            </ul>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="h-11 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black text-[#17202a] transition hover:bg-[#eef4fa]"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-11 rounded-lg border border-[#1f4d73] bg-[#1f4d73] px-5 text-sm font-black text-white shadow-md shadow-[#1f4d73]/15 transition hover:bg-[#173a57] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={onConnect}
              type="button"
            >
              {busy
                ? "Connecting…"
                : connected
                  ? "Reconnect bank"
                  : "Continue to Plaid"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DesktopTransactionSidePanel({
  onCancel,
  onBack,
  onPost,
  onPrint,
  transaction
}: {
  onCancel: () => void;
  onBack: () => void;
  onPost: () => void;
  onPrint: () => void;
  transaction: TransactionRow;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 hidden md:block">
      <div className="absolute inset-0 bg-[#0f172a]/40" />
      <aside className="pointer-events-auto absolute bottom-0 right-0 top-0 flex w-[43rem] max-w-[48vw] flex-col overflow-hidden bg-white shadow-[-18px_0_42px_rgba(15,23,42,0.22)]">
        <header className="bg-[#061126] px-6 pb-4 pt-5 text-white">
          <div className="flex items-center justify-between">
            <button
              aria-label="Back to transactions"
              className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/15"
              onClick={onBack}
              type="button"
            >
              <LineIcon className="h-5 w-5" name="back" />
            </button>
            <h2 className="text-lg font-black">
              {transaction.status} transaction
            </h2>
            <button
              aria-label="Cancel transaction"
              className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/15"
              onClick={onCancel}
              type="button"
            >
              <span className="relative h-5 w-5 rounded-full border-2 border-current">
                <span className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
              </span>
            </button>
          </div>

          <section className="mt-4 rounded-lg bg-white p-4 text-[#001428] shadow-sm">
            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div>
                <p className="text-lg font-black">{transaction.customer}</p>
                <p className="mt-1 text-xs font-semibold uppercase text-[#526274]">
                  {transaction.event}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black">
                  {transaction.amount < 0 ? "-" : ""}
                  {formatCurrency(Math.abs(transaction.amount))}
                </p>
                <p className="text-sm font-semibold text-[#1f4d73]">
                  {transactionShortDate(transaction)}
                </p>
              </div>
            </div>
          </section>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-[#b9c2cf] text-sm font-black text-[#17202a]">
            {["Categorize", "Match", "Transfer"].map((label, index) => (
              <button
                className={`h-12 bg-white transition hover:bg-[#eef4fa] ${
                  index > 0 ? "border-l border-[#b9c2cf]" : ""
                }`}
                key={label}
                onClick={
                  label === "Match"
                    ? onPost
                    : label === "Transfer"
                      ? onPrint
                      : undefined
                }
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 divide-y divide-[#edf0f4]">
            <DesktopTransactionDetailRow
              icon="more"
              label="Transaction type*"
              value={
                transaction.type === "Payment" ? "Expense" : transaction.type
              }
            />
            <DesktopTransactionDetailRow
              icon="invoice"
              label="Category*"
              value={transaction.eventType || "Supplies & materials - COGS"}
            />
            <DesktopTransactionDetailRow
              icon="settings"
              label="Split transaction"
              value="Select"
            />
            <DesktopTransactionDetailRow
              icon="payment"
              label="From/To"
              value={`${transaction.customer} Corp`}
            />
            <DesktopTransactionDetailRow
              icon="upload"
              label="Billable"
              trailing={
                <span className="relative h-6 w-11 rounded-full bg-[#b9c2cf]">
                  <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow" />
                </span>
              }
              value=""
            />
            <DesktopTransactionDetailRow
              icon="bank"
              label="Customer/Project"
              value="Select a customer or project"
            />
            <DesktopTransactionDetailRow
              icon="upload"
              label="Attachment"
              value="0 attached"
            />
            <DesktopTransactionDetailRow
              icon="invoice"
              label="Memo"
              value={transaction.notes}
            />
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-[#d8dde5] bg-white px-6 py-4">
          <button
            aria-label="Cancel"
            className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#ffb3a8] text-[#d63a2f] transition hover:bg-[#fff0ee]"
            onClick={onCancel}
            type="button"
          >
            <span className="relative h-5 w-5 rounded-full border-2 border-current">
              <span className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
            </span>
          </button>
          <button
            className="h-12 flex-1 rounded-lg bg-[#1f4d73] text-sm font-black text-white shadow-sm transition hover:bg-[#173a57]"
            onClick={onPost}
            type="button"
          >
            Post & next
          </button>
        </footer>
      </aside>
    </div>
  );
}

function DesktopTransactionDetailRow({
  icon,
  label,
  trailing,
  value
}: {
  icon: IconName;
  label: string;
  trailing?: ReactNode;
  value: string;
}) {
  return (
    <button
      className="grid w-full grid-cols-[2rem_1fr_auto] items-center gap-4 py-5 text-left"
      type="button"
    >
      <LineIcon className="h-5 w-5 text-[#6a7483]" name={icon} />
      <span className="min-w-0 text-sm text-[#526274]">
        {label}
        {value ? (
          <strong className="ml-0.5 text-base text-[#001428]">{value}</strong>
        ) : null}
      </span>
      {trailing ?? (
        <LineIcon className="h-4 w-4 text-[#526274]" name="chevron" />
      )}
    </button>
  );
}

function TransactionDetailsView({
  onCancel,
  onBack,
  onPost,
  transaction
}: {
  onCancel: () => void;
  onBack: () => void;
  onPost: () => void;
  transaction: TransactionRow;
}) {
  return (
    <div className="bg-white md:bg-[#f4f7fa] md:p-4">
      <section className="mx-auto min-h-[calc(100dvh-5.25rem)] max-w-4xl overflow-hidden bg-white md:min-h-0 md:rounded-xl md:border md:border-[#d8dde5] md:shadow-sm">
        <header className="bg-[#1f4d73] px-3 pb-12 pt-3 text-white md:px-5 md:pb-16 md:pt-5">
          <div className="flex items-center justify-between">
            <button
              aria-label="Back to transactions"
              className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/10 md:h-10 md:w-10"
              onClick={onBack}
              type="button"
            >
              <LineIcon className="h-5 w-5" name="back" />
            </button>
            <h2 className="text-sm font-black md:text-base">
              {transaction.status} transaction
            </h2>
            <button
              aria-label="Cancel transaction"
              className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/10 md:h-10 md:w-10"
              onClick={onCancel}
              type="button"
            >
              <span className="relative h-5 w-5 rounded-full border-2 border-current">
                <span className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
              </span>
            </button>
          </div>
        </header>

        <div className="-mt-10 px-3 md:-mt-12 md:px-6">
          <section className="rounded-lg border border-[#d8dde5] bg-white p-3 text-center shadow-md md:p-5">
            <div className="grid grid-cols-[1fr_auto] items-start gap-3 text-left">
              <div>
                <p className="text-sm font-black text-[#17202a] md:text-lg">
                  {transaction.customer}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase text-[#6a7483] md:text-xs">
                  {transaction.event}
                </p>
              </div>
              <p className="text-xs font-semibold text-[#526274] md:text-sm">
                {transaction.date.replace(", 2026", "/26")}
              </p>
            </div>
            <p
              className={`mt-1 text-3xl font-black md:text-5xl ${
                transaction.amount >= 0 ? "text-[#17202a]" : "text-[#c0392b]"
              }`}
            >
              {transaction.amount < 0 ? "-" : ""}
              {formatCurrency(Math.abs(transaction.amount))}
            </p>
          </section>
        </div>

        <div className="px-3 py-3 md:px-6 md:py-5">
          <div className="grid grid-cols-2 overflow-hidden rounded-md border border-[#b9c2cf] bg-white text-sm font-black text-[#526274] md:text-base">
            <button className="h-8 bg-[#f6f8fa] md:h-11" type="button">
              Categorize
            </button>
            <button
              className="h-8 border-l border-[#b9c2cf] bg-white md:h-11"
              type="button"
            >
              Match
            </button>
          </div>

          <div className="mt-3 divide-y divide-[#edf0f4] md:mt-5 md:rounded-xl md:border md:border-[#edf0f4] md:px-4">
            <MobileTransactionDetailRow
              icon="more"
              label="Transaction type*"
              value={transaction.type}
            />
            <MobileTransactionDetailRow
              icon="invoice"
              label="Category*"
              value={transaction.eventType}
            />
            <MobileTransactionDetailRow
              icon="settings"
              label="Split transaction"
              muted
              value="Not split"
            />
            <MobileTransactionDetailRow
              icon="payment"
              label="From/To"
              value={`${transaction.customer} • ${transaction.paymentMethod}`}
            />
            <MobileTransactionDetailRow
              icon="invoice"
              label="Billable"
              trailing={
                <span className="relative h-4 w-8 rounded-full bg-[#d8dde5]">
                  <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow" />
                </span>
              }
              value={transaction.venue}
            />
            <MobileTransactionDetailRow
              icon="bank"
              label="Customer/Project"
              value={transaction.event}
            />
            <MobileTransactionDetailRow
              icon="upload"
              label="Attachment"
              value="0 attached"
            />
            <MobileTransactionDetailRow
              icon="invoice"
              label="Memo"
              value={transaction.notes}
            />
          </div>

          <section className="mt-4 border-t border-[#edf0f4] pt-3 md:rounded-xl md:border md:border-[#edf0f4] md:p-4">
            <p className="text-xs font-semibold text-[#6a7483] md:text-sm">
              Full bank description
            </p>
            <p className="mt-1 text-xs font-bold leading-5 text-[#526274] md:text-sm">
              {transaction.referenceNo} • {transaction.customer} •{" "}
              {transaction.event}
            </p>
          </section>

          <button
            className="mt-4 h-11 w-full rounded-md bg-[#078342] text-sm font-black text-white shadow-sm transition hover:bg-[#056b36] md:h-12 md:text-base"
            onClick={onPost}
            type="button"
          >
            Post
          </button>
        </div>
      </section>
    </div>
  );
}

function MobileTransactionDetailRow({
  icon,
  label,
  muted = false,
  trailing,
  value
}: {
  icon: IconName;
  label: string;
  muted?: boolean;
  trailing?: ReactNode;
  value: string;
}) {
  return (
    <button
      className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 py-3 text-left"
      type="button"
    >
      <LineIcon
        className={`h-4 w-4 ${muted ? "text-[#9aa5b3]" : "text-[#6a7483]"}`}
        name={icon}
      />
      <span className="min-w-0">
        <span
          className={`block text-xs font-semibold ${
            muted ? "text-[#a1aab6]" : "text-[#6a7483]"
          }`}
        >
          {label}
        </span>
        <span
          className={`mt-0.5 block truncate text-xs font-bold ${
            muted ? "text-[#b4bdc8]" : "text-[#526274]"
          }`}
        >
          {value}
        </span>
      </span>
      {trailing ?? (
        <LineIcon className="h-4 w-4 text-[#6a7483]" name="chevron" />
      )}
    </button>
  );
}

function DetailCard({
  rows,
  title
}: {
  rows: Array<[string, string]>;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-[#d8dde5] bg-white p-4">
      <h3 className="text-sm font-black text-[#1f4d73]">{title}</h3>
      <dl className="mt-4 space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div
            className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3"
            key={label || value}
          >
            <dt className="text-xs font-semibold text-[#6a7483]">{label}</dt>
            <dd className="min-w-0 font-semibold text-[#17202a]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function NotesCard({ notes }: { notes: string }) {
  return (
    <section className="rounded-xl border border-[#d8dde5] bg-white p-4">
      <h3 className="text-sm font-black text-[#1f4d73]">Notes</h3>
      <p className="mt-4 max-w-prose text-sm font-semibold leading-6 text-[#17202a]">
        {notes}
      </p>
    </section>
  );
}
