"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { DashboardPageState } from "@/components/layout/dashboard-page-state";
import { NewInvoiceDialog } from "@/features/billing/forms/new-invoice-dialog";
import {
  clearCachedSyncedUser,
  getCachedSyncedUser,
  syncSignedInUser,
  type SyncSignedInUserResponse
} from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { useDashboardPermission } from "@/features/dashboard/hooks/use-dashboard-permission";

import { BillingContent } from "@/features/billing/components/billing-content";
import { BillingHeader } from "@/features/billing/components/billing-header";
import { PendingTransactionModal } from "@/features/billing/components/pending-transaction-modal";
import { TopAction, type BillingResponse, type BillingTab } from "@/features/billing/components/billing-shared";
export function BillingPage() {
  const [pageSearchQuery, setPageSearchQuery] =
    useDashboardPageSearch("Billing");
  const router = useRouter();
  const canManagePayments = useDashboardPermission("canManagePayments");
  const billingQuery = useAuthenticatedQuery<BillingResponse>("/api/billing");
  const [syncData, setSyncData] = useState<SyncSignedInUserResponse | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<BillingTab>("Dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);

  const saveInvoice = () => {
    setIsNewInvoiceOpen(false);
    setActiveTab("Invoices");
  };

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

  if (
    !syncData ||
    billingQuery.isLoading ||
    billingQuery.error ||
    !billingQuery.data
  ) {
    return (
      <DashboardPageState
        error={billingQuery.error}
        isLoading={!syncData || billingQuery.isLoading}
        onRetry={billingQuery.refetch}
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
            />
            <TopAction
              compactOnMobile
              disabled={!canManagePayments}
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
      <NewInvoiceDialog
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
              data={billingQuery.data}
              openModal={() => setIsModalOpen(true)}
              searchQuery={pageSearchQuery}
              setActiveTab={setActiveTab}
              setSearchQuery={setPageSearchQuery}
            />
          </div>
        </div>
      </section>
      {isModalOpen ? (
        <PendingTransactionModal onClose={() => setIsModalOpen(false)} />
      ) : null}
    </div>
  );
} 
