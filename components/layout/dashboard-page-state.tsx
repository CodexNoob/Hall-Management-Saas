"use client";

import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { AsyncState } from "@/components/ui/async-state";

type DashboardPageStateProps = {
  emptyMessage?: string;
  emptyTitle?: string;
  error?: string | null;
  isEmpty?: boolean;
  isLoading?: boolean;
  onRetry?: () => void;
  showSearch?: boolean;
  subtitle: string;
  title: string;
};

export function DashboardPageState({
  emptyMessage,
  emptyTitle,
  error,
  isEmpty,
  isLoading,
  onRetry,
  showSearch = true,
  subtitle,
  title
}: DashboardPageStateProps) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        compactMobileActions
        showSearch={showSearch}
        subtitle={subtitle}
        title={title}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center p-4">
        <AsyncState
          emptyMessage={emptyMessage}
          emptyTitle={emptyTitle}
          error={error}
          isEmpty={isEmpty}
          isLoading={isLoading}
          onRetry={onRetry}
        />
      </main>
    </div>
  );
}
