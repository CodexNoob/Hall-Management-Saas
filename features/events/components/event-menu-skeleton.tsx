import { Skeleton } from "@/components/ui/skeleton";
import { MENU_SECTIONS } from "@/features/events/components/menu-item-selector-drawer";

/**
 * The menu tab's body while the event's menu is on its way.
 *
 * The card boxes carry the same height, border and grid classes as the real
 * MenuDishCard and AddMenuCard, so the panel is already the size it will be
 * when the rows land and nothing under it jumps. Only the picture and the name
 * inside each card are drawn as placeholders - the frame is real.
 *
 * The card counts are a guess at a typical menu, which is all a skeleton can be.
 * They are deliberately modest: a skeleton that is shorter than the content is
 * a panel that grows, and a skeleton that is much taller is a page that
 * collapses.
 */
const PLACEHOLDER_CARDS: Record<string, number> = {
  Buffet: 4,
  Plated: 2,
  Drink: 2,
  AddOn: 2
};

function MenuCardSkeleton() {
  return (
    <div className="flex h-28 min-w-0 flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-[0_1px_2px_rgba(23,32,42,0.04)] sm:h-40 lg:h-44">
      <div className="flex flex-1 items-center justify-center bg-[#fbfcfd]">
        {/* The rounded tile the real card draws when a line has no picture. */}
        <Skeleton className="h-11 w-11 rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl" />
      </div>
      {/* Two rows, the same two the real card's footer has: the name, and the
          quantity stepper under it. Kept in step with `MenuDishCard` - a
          skeleton a row short is a panel that jumps when the menu lands, and
          the `lg` step is where the real footer grows for a two-line name. */}
      <div className="flex h-14 flex-col items-center justify-center gap-1.5 border-t border-[#d8dde5] px-1 sm:h-16 sm:px-2 lg:h-20">
        <Skeleton className="h-2 w-4/5 sm:h-2.5" />
        <Skeleton className="h-5 w-14 rounded-full sm:h-6 sm:w-16" />
      </div>
    </div>
  );
}

export function EventMenuSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading this event&rsquo;s menu…</span>
      {MENU_SECTIONS.map((section) => (
        <section
          className="border-b border-[#d8dde5] last:border-b-0"
          key={section.id}
        >
          <div className="px-3 pt-3 sm:px-4">
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 sm:gap-3">
            {Array.from({ length: PLACEHOLDER_CARDS[section.id] ?? 2 }).map(
              (_, index) => (
                <MenuCardSkeleton key={index} />
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
