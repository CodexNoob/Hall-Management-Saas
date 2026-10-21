import { Skeleton } from "@/components/ui/skeleton";
import { useAppLanguage } from "@/components/providers/app-language-provider";

/**
 * The kitchen tab's body while the event's sheet is on its way.
 *
 * Same discipline as the menu tab's skeleton: the tiles and rows carry the real
 * frame classes and only their text is drawn as placeholders, so the panel is
 * already the size it will be and nothing under it jumps when the data lands.
 */
function StatTileSkeleton() {
  return (
    <div className="rounded-lg border border-[#d8dde5] bg-white p-3">
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="mt-3 h-4 w-12" />
      <Skeleton className="mt-3 h-2 w-24" />
    </div>
  );
}

export function EventKitchenSkeleton() {
  const { t } = useAppLanguage();

  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{t("events.loadingKitchenSheet")}</span>
      <div className="grid grid-cols-2 gap-2 p-3 sm:gap-3 lg:grid-cols-4 sm:px-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatTileSkeleton key={index} />
        ))}
      </div>
      <div className="border-t border-[#d8dde5]">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            className="flex items-center gap-3 border-b border-[#d8dde5] px-3 py-3 last:border-b-0 sm:px-4"
            key={index}
          >
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <Skeleton className="h-3 w-40 max-w-[40%]" />
            <Skeleton className="ml-auto h-3 w-16" />
            <Skeleton className="hidden h-3 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
