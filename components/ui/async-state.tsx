type AsyncStateProps = {
  error?: string | null;
  isEmpty?: boolean;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  onRetry?: () => void;
};

export function AsyncState({
  error,
  isEmpty,
  isLoading,
  emptyTitle = "No records yet",
  emptyMessage = "Create the first record to get started.",
  onRetry
}: AsyncStateProps) {
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="inline-flex items-center gap-3 rounded-xl border border-[#d8dde5] bg-white px-6 py-4 text-center text-sm font-semibold text-[#6a7483] shadow-sm"
      >
        <span
          aria-hidden="true"
          className="h-5 w-5 animate-spin rounded-full border-2 border-[#c7d0dc] border-t-[#1f4d73]"
        />
        <span>Loading data…</span>
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
          Unable to load this section
        </p>
        <p className="mt-2 text-xs text-[#6a7483]">{error}</p>
        {onRetry ? (
          <button
            className="mt-4 h-9 rounded-lg border border-[#c7d0dc] bg-white px-4 text-xs font-black"
            onClick={onRetry}
            type="button"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-dashed border-[#c7d0dc] bg-[#fbfcfd] p-8 text-center">
        <p className="text-sm font-black text-[#17202a]">{emptyTitle}</p>
        <p className="mt-2 text-xs text-[#6a7483]">{emptyMessage}</p>
      </div>
    );
  }

  return null;
}
