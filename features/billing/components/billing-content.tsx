"use client";

import { BillingDashboardTab } from "@/features/billing/components/billing-dashboard-tab";
import { EventBillingTab } from "@/features/billing/components/event-billing-tab";
import { InvoicesTab } from "@/features/billing/components/invoices-tab";
import { SettingsTab } from "@/features/billing/components/billing-settings-tab";
import { TransactionsTab } from "@/features/billing/components/transactions-tab";
import { BillingReportsTab } from "@/features/billing/components/billing-reports-tab";
import {
  type BillingResponse,
  type BillingTab
} from "@/features/billing/components/billing-shared";

export function BillingContent({
  activeTab,
  canManagePayments,
  setActiveTab,
  data,
  searchQuery,
  setSearchQuery,
  openNewInvoice,
  refreshBilling
}: {
  activeTab: BillingTab;
  canManagePayments: boolean;
  setActiveTab: (tab: BillingTab) => void;
  data: BillingResponse;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  openNewInvoice: () => void;
  refreshBilling: () => Promise<BillingResponse | null>;
}) {
  if (activeTab === "Transactions")
    return (
      <TransactionsTab
        data={data}
        onRefresh={refreshBilling}
        searchQuery={searchQuery}
      />
    );
  if (activeTab === "Invoices")
    return (
      <InvoicesTab
        data={data}
        canManagePayments={canManagePayments}
        onNewInvoice={openNewInvoice}
        onRefresh={refreshBilling}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    );
  if (activeTab === "Event Billing")
    return (
      <EventBillingTab
        data={data}
        onCreateInvoice={openNewInvoice}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    );
  if (activeTab === "Settings") return <SettingsTab />;
  if (activeTab === "Reports") return <BillingReportsTab />;
  return <BillingDashboardTab data={data} setActiveTab={setActiveTab} />;
}
