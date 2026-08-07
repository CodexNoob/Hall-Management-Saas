import { DashboardLoadingIndicator } from "@/components/ui/dashboard-loading-indicator";

export default function DashboardLoading() {
  return (
    <div
      aria-label="Loading page"
      className="flex min-h-[45vh] items-center justify-center"
      role="status"
    >
      <DashboardLoadingIndicator />
      <span className="sr-only">Loading page…</span>
    </div>
  );
}
