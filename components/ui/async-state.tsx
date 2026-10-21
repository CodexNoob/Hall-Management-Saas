"use client";

import { DashboardLoadingIndicator } from "@/components/ui/dashboard-loading-indicator";
import { useAppLanguage } from "@/components/providers/app-language-provider";

type AsyncStateProps = {
  error?: string | null;
  isEmpty?: boolean;
  isLoading?: boolean;
  /** Overrides the generic empty copy. Callers pass text already translated. */
  emptyTitle?: string;
  emptyMessage?: string;
  onRetry?: () => void;
};

export function AsyncState({
  error,
  isEmpty,
  isLoading,
  emptyTitle,
  emptyMessage,
  onRetry
}: AsyncStateProps) {
  const { t } = useAppLanguage();
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="inline-flex items-center justify-center"
      >
        <DashboardLoadingIndicator />
        <span className="sr-only">{t("common.loadingData")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-[#efb7bb] bg-[#fff7f7] p-6 text-center"
      >
        <p className="text-sm font-black text-[#9f2929]">
          {t("common.unableToLoad")}
        </p>
        <p className="mt-2 text-xs text-[#6a7483]">{error}</p>
        {onRetry ? (
          <button
            className="mt-4 h-9 rounded-lg border border-[#c7d0dc] bg-white px-4 text-xs font-black"
            onClick={onRetry}
            type="button"
          >
            {t("common.tryAgain")}
          </button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-dashed border-[#c7d0dc] bg-[#fbfcfd] p-8 text-center">
        <p className="text-sm font-black text-[#17202a]">
          {emptyTitle ?? t("common.noRecords")}
        </p>
        <p className="mt-2 text-xs text-[#6a7483]">
          {emptyMessage ?? t("common.createFirstRecord")}
        </p>
      </div>
    );
  }

  return null;
}
