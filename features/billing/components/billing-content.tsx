"use client";

import { BillingDashboardTab } from "@/features/billing/components/billing-dashboard-tab";
import { EventBillingTab } from "@/features/billing/components/event-billing-tab";
import { InvoicesTab } from "@/features/billing/components/invoices-tab";
import { SettingsTab } from "@/features/billing/components/billing-settings-tab";
import { TransactionsTab } from "@/features/billing/components/transactions-tab";
import {
  type BillingResponse,
  type BillingTab
} from "@/features/billing/components/billing-shared";

export function BillingContent({
  activeTab,
  setActiveTab,
  openModal,
  data,
  searchQuery,
  setSearchQuery,
  openNewInvoice
}: {
  activeTab: BillingTab;
  setActiveTab: (tab: BillingTab) => void;
  openModal: () => void;
  data: BillingResponse;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  openNewInvoice: () => void;
}) {
  if (activeTab === "Transactions")
    return (
      <TransactionsTab
        data={data}
        openModal={openModal}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    );
  if (activeTab === "Invoices")
    return (
      <InvoicesTab
        data={data}
        onNewInvoice={openNewInvoice}
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
  return <BillingDashboardTab data={data} setActiveTab={setActiveTab} />;
}
