"use client";

import { useMemo, useState } from "react";
import type { BillingResponse } from "@/features/billing/components/billing-shared";
import {
  buildTransactionRows,
  type ReviewFilter,
  type SortKey
} from "@/features/billing/transactions/transaction-model";

const PAGE_SIZE = 10;

export function useTransactionTable(
  data: BillingResponse,
  searchQuery: string
) {
  const [typeFilter, setTypeFilter] = useState("All types");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("All");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailsTransactionId, setDetailsTransactionId] = useState<string | null>(
    null
  );

  const rows = useMemo(() => buildTransactionRows(data), [data]);
  const filteredRows = useMemo(() => {
    const lowerSearch = searchQuery.trim().toLowerCase();

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
        const matchesReview =
          reviewFilter === "All" ||
          (reviewFilter === "Needs review" &&
            ["Pending", "Confirmed"].includes(row.status)) ||
          (reviewFilter === "Matched" &&
            ["Confirmed", "Paid"].includes(row.status)) ||
          (reviewFilter === "Paid" && row.status === "Paid");

        return matchesSearch && matchesType && matchesStatus && matchesReview;
      })
      .sort((a, b) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        if (sortKey === "amount") return (a.amount - b.amount) * direction;
        if (sortKey === "date") return (a.dateValue - b.dateValue) * direction;
        return a[sortKey].localeCompare(b[sortKey]) * direction;
      });
  }, [
    reviewFilter,
    rows,
    searchQuery,
    sortDirection,
    sortKey,
    statusFilter,
    typeFilter
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );
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

  return {
    detailsTransactionId,
    detailsTransaction,
    filteredRows,
    page: safePage,
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
    pageSize: PAGE_SIZE,
    typeFilter,
    typeOptions
  };
}
