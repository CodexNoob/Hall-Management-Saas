"use client";

import { MenuItemCard } from "@/features/menu/components/menu-cards";
import type { MenuLibraryItem } from "@/features/menu/components/menu-shared";

type PackageIncludedItemsProps = {
  includedItems: MenuLibraryItem[];
  /** Set when the viewer may not edit the menu. */
  isDisabled?: boolean;
  /** Ticks exactly these ids, for "Select all". */
  onReplaceSelection: (itemIds: string[]) => void;
  onToggle: (itemId: string) => void;
  /** The items with a write still out, so only those cards read as busy. */
  pendingItemIds: ReadonlySet<string>;
  selectedItemIds: ReadonlySet<string>;
};

/**
 * What the open package holds.
 *
 * Ticking rather than a three-dot menu per card. The menu's one entry removed
 * on the tap that chose it - a destructive action with no pause and no way to
 * take back the wrong row - where a tick shows what is about to go and the
 * panel's bar names the count before anything happens. It also costs the same
 * two taps as before for one item, and far fewer for eight.
 */
export function PackageIncludedItems({
  includedItems,
  isDisabled = false,
  onReplaceSelection,
  onToggle,
  pendingItemIds,
  selectedItemIds
}: PackageIncludedItemsProps) {
  if (includedItems.length === 0) {
    return (
      <p className="m-3 rounded-lg border border-dashed border-[#d8dde5] bg-[#fbfcfd] px-3 py-6 text-center text-xs text-[#516174]">
        No items in this package yet. Pick them from the library below.
      </p>
    );
  }

  const areAllTicked = includedItems.every((item) =>
    selectedItemIds.has(item.id)
  );

  return (
    <>
      {!isDisabled ? (
        <div className="flex items-center justify-end px-3 pt-3">
          <button
            className="inline-flex h-8 shrink-0 items-center rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
            onClick={() =>
              onReplaceSelection(
                areAllTicked ? [] : includedItems.map((item) => item.id)
              )
            }
            type="button"
          >
            {areAllTicked ? "Select none" : "Select all"}
          </button>
        </div>
      ) : null}

      {/* The same card as the Menu Library grid, so an item looks like itself -
          picture included - wherever it is shown. */}
      <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 md:grid-cols-4 2xl:grid-cols-6">
        {includedItems.map((item) => (
          <MenuItemCard
            key={item.id}
            category={item.category}
            isSelectDisabled={isDisabled}
            isTicked={selectedItemIds.has(item.id)}
            name={item.name}
            onToggleTick={() => onToggle(item.id)}
            pendingLabel={pendingItemIds.has(item.id) ? "Saving…" : null}
            pictureUrl={item.pictureUrl}
          />
        ))}
      </div>
    </>
  );
}
