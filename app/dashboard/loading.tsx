"use client";

import { DashboardLoadingIndicator } from "@/components/ui/dashboard-loading-indicator";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export default function DashboardLoading() {
  const { t } = useAppLanguage();

  return (
    <div
      aria-label={t("shell.loadingPage")}
      className="flex min-h-[45vh] items-center justify-center"
      role="status"
    >
      <DashboardLoadingIndicator />
      <span className="sr-only">{t("shell.loadingPageEllipsis")}</span>
    </div>
  );
}
