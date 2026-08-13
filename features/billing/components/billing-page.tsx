"use client";

import { useRef, useState } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import {
  NewInvoiceDialog,
  type NewInvoiceFormValues
} from "@/features/billing/forms/new-invoice-dialog";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { readApiError } from "@/lib/http/api-request-error";
import {
  MAX_MONEY,
  moneySchema,
  parseNumericInput
} from "@/lib/validation/number";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";

import { BillingContent } from "@/features/billing/components/billing-content";
import { BillingHeader } from "@/features/billing/components/billing-header";
import { PendingTransactionModal } from "@/features/billing/components/pending-transaction-modal";
import {
  TopAction,
  type BillingResponse,
  type BillingTab
} from "@/features/billing/components/billing-shared";
export function BillingPage() {
  const [pageSearchQuery, setPageSearchQuery] =
    useDashboardPageSearch("Billing");
  const { canAccessRoute, hasPermission } = useDashboardAccess();
  const canViewBilling = canAccessRoute("/dashboard/billing");
  const canManagePayments = hasPermission("canManagePayments");
  const billingQuery = useAuthenticatedQuery<BillingResponse>(
    "/api/billing",
    canViewBilling
  );
  const [activeTab, setActiveTab] = useState<BillingTab>("Dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState("");

  async function importBankFile(file: File) {
    try {
      const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
      const dataLines = lines.slice(1);
      const rows = dataLines
        .map((line) => {
          const [date, description, amount, currency = "USD"] = line
            .split(",")
            .map((value) => value.trim().replace(/^"|"$/g, ""));
          // Signed: an imported debit is negative.
          const parsed = parseNumericInput(
            amount ?? "",
            moneySchema({ min: -MAX_MONEY, label: "Amount" })
          );

          if (!date || !description || parsed.status !== "valid") return null;

          return {
            date,
            description,
            amountCents: Math.round(parsed.value * 100),
            currency
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (!rows.length)
        throw new Error(
          "The CSV must contain date, description, amount, and optional currency columns."
        );

      const skipped = dataLines.length - rows.length;
      const response = await authenticatedFetch("/api/billing/import", {
        method: "POST",
        body: JSON.stringify({ rows })
      });
      if (!response.ok) throw await readApiError(response);
      const payload = await response.json().catch(() => ({}));
      setImportMessage(
        skipped > 0
          ? `${payload.imported} bank transactions imported. ${skipped} ${skipped === 1 ? "row was" : "rows were"} skipped because the date, description, or amount could not be read.`
          : `${payload.imported} bank transactions imported.`
      );
      setActiveTab("Transactions");
    } catch (error) {
      setImportMessage(
        error instanceof Error ? error.message : "Unable to import bank file."
      );
    }
  }

  const saveInvoice = async (values: NewInvoiceFormValues) => {
    const parsedAmount = parseNumericInput(
      values.amount,
      moneySchema({ label: "Amount" })
    );

    if (parsedAmount.status !== "valid") {
      throw new Error(
        parsedAmount.status === "invalid"
          ? parsedAmount.message
          : "Enter an invoice amount."
      );
    }

    const amountCents = Math.round(parsedAmount.value * 100);
    const response = await authenticatedFetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: values.eventId,
        clientName: values.clientName,
        status: values.status,
        dueDate: values.dueDate || undefined,
        lineItems: [
          {
            description: values.firstItem,
            quantity: 1,
            unitAmountCents: amountCents
          }
        ]
      })
    });
    if (!response.ok) throw await readApiError(response);
    setIsNewInvoiceOpen(false);
    setActiveTab("Invoices");
    await billingQuery.refetch();
  };

  if (!canViewBilling || billingQuery.isLoading || billingQuery.error || !billingQuery.data) {
    return (
      <DashboardPageState
        emptyMessage={
          canViewBilling
            ? undefined
            : "You do not have permission to view billing. Contact an administrator if you need access."
        }
        emptyTitle={canViewBilling ? undefined : "Access restricted"}
        error={canViewBilling ? billingQuery.error : null}
        isEmpty={!canViewBilling}
        isLoading={canViewBilling && billingQuery.isLoading}
        onRetry={canViewBilling ? billingQuery.refetch : undefined}
        subtitle="Transactions, invoices, event billing, payments, and financial dashboard."
        title="Billing"
      />
    );
  }

  return (
    <div className="dashboard-readable-page flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        compactMobileActions
        title="Billing"
        subtitle="Transactions, invoices, event billing, payments, and financial dashboard."
        actionsSlot={
          <>
            <TopAction
              compactOnMobile
              disabled={!canManagePayments}
              icon="upload"
              label="Import bank file"
              onClick={() => importInputRef.current?.click()}
            />
            <TopAction
              compactOnMobile
              disabled={
                !canManagePayments || !billingQuery.data.transactions.length
              }
              icon="payment"
              label="Review recent transaction"
              onClick={() => setIsModalOpen(true)}
            />
            <TopAction
              compactOnMobile
              icon="plus"
              label="New invoice"
              disabled={!canManagePayments}
              onClick={() => setIsNewInvoiceOpen(true)}
              tone="primary"
            />
          </>
        }
      />
      <input
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importBankFile(file);
          event.target.value = "";
        }}
        ref={importInputRef}
        type="file"
      />
      {importMessage ? (
        <div className="mx-3 mt-2 rounded-lg bg-[#eef4fa] px-3 py-2 text-sm font-bold text-[#1f4d73]">
          {importMessage}
        </div>
      ) : null}
      <NewInvoiceDialog
        events={billingQuery.data.events}
        onClose={() => setIsNewInvoiceOpen(false)}
        onSave={saveInvoice}
        open={canManagePayments && isNewInvoiceOpen}
      />
      <section className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-hidden bg-[#fbfcfd]">
        <div className="flex h-full min-w-0 flex-col">
          <BillingHeader activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            <BillingContent
              activeTab={activeTab}
              canManagePayments={canManagePayments}
              data={billingQuery.data}
              searchQuery={pageSearchQuery}
              setActiveTab={setActiveTab}
              setSearchQuery={setPageSearchQuery}
              openNewInvoice={() => setIsNewInvoiceOpen(true)}
              refreshBilling={billingQuery.refetch}
            />
          </div>
        </div>
      </section>
      {isModalOpen && billingQuery.data.transactions[0] ? (
        <PendingTransactionModal
          onClose={() => setIsModalOpen(false)}
          onSaved={billingQuery.refetch}
          transaction={billingQuery.data.transactions[0]}
        />
      ) : null}
    </div>
  );
}
