"use client";

import { useEffect, useState } from "react";
import {
  LineIcon,
  Pill,
  type BillingResponse
} from "@/features/billing/components/billing-shared";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import {
  ensurePlaidScript,
  PlaidConnectDialog,
  PlaidConnectionPanel
} from "@/features/billing/transactions/plaid-connection";
import {
  DesktopTransactionSidePanel,
  TransactionDetailsView
} from "@/features/billing/transactions/transaction-details";
import {
  formatTransactionCurrency as formatCurrency,
  transactionIconName,
  transactionMonthLabel,
  transactionShortDate,
  transactionStatusTone as statusTone,
  type SortKey,
  type TransactionStatus
} from "@/features/billing/transactions/transaction-model";
import { useTransactionTable } from "@/features/billing/transactions/use-transaction-table";

function statusBadge(status: TransactionStatus) {
  return <Pill tone={statusTone[status]}>{status}</Pill>;
}

export function TransactionsTab({
  data,
  onRefresh,
  searchQuery
}: {
  data: BillingResponse;
  onRefresh: () => Promise<BillingResponse | null>;
  searchQuery: string;
}) {
  const isFilterPanelOpen = true;
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
  const {
    detailsTransaction,
    detailsTransactionId,
    filteredRows,
    page,
    pageRows,
    reviewCounts,
    reviewFilter,
    rows,
    selectedIds,
    setDetailsTransactionId,
    setPage,
    setReviewFilter,
    setSelectedIds,
    setSortDirection,
    setSortKey,
    setStatusFilter,
    setTypeFilter,
    sortDirection,
    sortKey,
    statusFilter,
    toggleRowSelection,
    toggleSort,
    totalPages,
    pageSize,
    typeFilter,
    typeOptions
  } = useTransactionTable(data, searchQuery);

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

  async function updateTransactionStatus(
    rowIds: string[],
    status: TransactionStatus,
    message: string
  ) {
    try {
      await Promise.all(
        rowIds.map(async (id) => {
          const response = await authenticatedFetch(
            `/api/billing/transactions/${id}`,
            {
              method: "PATCH",
              body: JSON.stringify(
                status === "Cancelled"
                  ? { action: "cancel", note: message }
                  : {
                      action: "categorize",
                      category: "Posted",
                      note: message
                    }
              )
            }
          );
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error ?? "Unable to update transaction.");
          }
        })
      );
      setSelectedIds((current) => current.filter((id) => !rowIds.includes(id)));
      await onRefresh();
      showActionMessage(message);
    } catch (error) {
      showActionMessage(
        error instanceof Error ? error.message : "Unable to update transaction."
      );
    }
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
                    <span>{"\u2022"}</span>
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
                      {"\u2726"} {row.eventType}
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

          <table className="hidden w-full min-w-295 border-separate border-spacing-0 text-left text-sm">
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
                            ? "\u25b2"
                            : "\u25bc"
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
                      aria-label={`Actions for transaction ${row.referenceNo}`}
                      className="rounded-md px-2 py-1 text-lg font-black leading-none text-[#17202a] hover:bg-[#eef4fa]"
                      onClick={(event) => event.stopPropagation()}
                      type="button"
                    >
                      &#8942;
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
