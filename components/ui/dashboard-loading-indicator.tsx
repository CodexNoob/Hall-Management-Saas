type DashboardLoadingIndicatorProps = {
  className?: string;
};

export function DashboardLoadingIndicator({
  className = "h-20 w-20"
}: DashboardLoadingIndicatorProps) {
  return (
    <svg
      aria-hidden="true"
      className={`${className} dashboard-loading-motion text-[#1f4d73] motion-reduce:animate-none`}
      fill="none"
      viewBox="0 0 100 100"
    >
      <circle cx="50" cy="50" fill="currentColor" r="20" />

      <rect fill="currentColor" height="15" rx="3" width="6" x="47" y="13" />
      <circle cx="50" cy="9" fill="currentColor" r="7" />

      <rect fill="currentColor" height="6" rx="3" width="15" x="72" y="47" />
      <circle cx="91" cy="50" fill="currentColor" r="7" />

      <rect fill="currentColor" height="15" rx="3" width="6" x="47" y="72" />
      <circle cx="50" cy="91" fill="currentColor" r="7" />

      <rect fill="currentColor" height="6" rx="3" width="15" x="13" y="47" />
      <circle cx="9" cy="50" fill="currentColor" r="7" />
    </svg>
  );
}
