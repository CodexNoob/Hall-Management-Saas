"use client";

import { useState } from "react";
import { PackageAddCard } from "@/features/menu/components/menu-cards";
import type { MenuLibraryItem } from "@/features/menu/components/menu-shared";

type PackageItemPickerProps = {
  /** Library items not already in the package. */
  availableItems: MenuLibraryItem[];
  /** Set when the viewer may not edit the menu. */
  isDisabled?: boolean;
  /**
   * How many items the library holds in total. It is the difference between
   * "there is nothing to add" and "everything has already been added", which
   * need opposite advice.
   */
  libraryItemCount: number;
  onAdd: (itemId: string) => void;
  /** The item currently being written, so only its card reads as busy. */
  pendingItemId: string | null;
};

function EmptyState({ children }: { children: string }) {
  return <p className="px-3 py-6 text-xs text-[#516174]">{children}</p>;
}

/**
 * The Menu Library, offered to the package that is open.
 *
 * Items already in the package are filtered out by the caller rather than shown
 * greyed out: the list beside it is the record of what is included, and a card
 * that appears in both places invites a click that cannot do anything.
 *
 * The search box is local state and deliberately not the page's search query -
 * that one filters the library grid on another tab, and reusing it would mean
 * typing here quietly narrowed a list the user cannot see.
 */
export function PackageItemPicker({
  availableItems,
  isDisabled = false,
  libraryItemCount,
  onAdd,
  pendingItemId
}: PackageItemPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleItems = availableItems.filter(
    (item) =>
      !normalizedSearch ||
      `${item.name} ${item.category}`.toLowerCase().includes(normalizedSearch)
  );

  return (
    <section className="mx-3 mb-3 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex min-h-11 flex-col gap-2 border-b border-[#d8dde5] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-black text-[#17202a]">
          Add items from the Menu Library
        </h3>
        {availableItems.length > 0 ? (
          <input
            aria-label="Search library items to add"
            className="h-8 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none placeholder:text-[#6a7483] focus:border-[#1f4d73] sm:w-56"
            name="packageItemSearch"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search items"
            type="search"
            value={searchQuery}
          />
        ) : null}
      </header>

      {availableItems.length === 0 ? (
        <EmptyState>
          {libraryItemCount === 0
            ? "The Menu Library is empty. Create an item there first, then add it here."
            : "Every library item is already in this package."}
        </EmptyState>
      ) : visibleItems.length === 0 ? (
        <EmptyState>No library items match that search.</EmptyState>
      ) : (
        // The same grid as the included list above it, so the two halves of the
        // panel line up column for column instead of drifting apart.
        <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 md:grid-cols-4 2xl:grid-cols-6">
          {visibleItems.map((item) => (
            <PackageAddCard
              key={item.id}
              category={item.category}
              isDisabled={isDisabled}
              isPending={pendingItemId === item.id}
              name={item.name}
              onAdd={() => onAdd(item.id)}
              pictureUrl={item.pictureUrl}
            />
          ))}
        </div>
      )}
    </section>
  );
}
