"use client";

import { centerMobileTab } from "@/lib/ui/center-mobile-tab";
import {
  billingTabIcons,
  billingTabLabels,
  LineIcon,
  tabs,
  type BillingTab
} from "@/features/billing/components/billing-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export function BillingHeader({
  activeTab,
  setActiveTab
}: {
  activeTab: BillingTab;
  setActiveTab: (tab: BillingTab) => void;
}) {
  const { t } = useAppLanguage();

  return (
    <div className="shrink-0 bg-white">
      <nav className="scrollbar-none mt-2 flex min-h-12 shrink-0 flex-nowrap gap-2 overflow-x-auto border-b border-t border-[#d8dde5] px-3 [&::-webkit-scrollbar]:hidden sm:px-4 lg:mt-0 lg:border-t-0">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`inline-flex h-12 shrink-0 items-center gap-2 border-b-3 px-2 text-sm font-black ${
              activeTab === tab
                ? "border-[#1f4d73] text-[#17202a]"
                : "border-transparent text-[#17202a] hover:bg-[#eef4fa]"
            }`}
            type="button"
            onClick={(event) => {
              setActiveTab(tab);
              centerMobileTab(event.currentTarget);
            }}
          >
            <LineIcon
              name={billingTabIcons[tab]}
              className="h-4 w-4 text-[#516174]"
            />
            {t(billingTabLabels[tab])}
          </button>
        ))}
      </nav>
    </div>
  );
}
