"use client";

import { useState } from "react";
import { MenuItemCard } from "@/features/menu/components/menu-cards";
import type { MenuLibraryItem } from "@/features/menu/components/menu-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

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
  /** Ticks exactly these ids, for "Select all". */
  onReplaceSelection: (itemIds: string[]) => void;
  onToggle: (itemId: string) => void;
  /** The items with a write still out, so only those cards read as busy. */
  pendingItemIds: ReadonlySet<string>;
  selectedItemIds: ReadonlySet<string>;
};

// One package panel is open at a time, so a constant is unique on the page.
const HEADING_ID = "package-item-picker-heading";

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
 * A click ticks rather than adds, and the bar the panel floats over the page is
 * what acts on the ticks. Adding on the click cost one request per item and,
 * before the write became a delta, quietly lost one of any two that overlapped;
 * the greater part of the reason is that building a package means choosing a
 * dozen dishes in a row, and "Add 12 items" is both one request and one place to
 * notice you ticked something by mistake.
 *
 * The search box is local state and deliberately not the page's search query -
 * that one filters the library grid on another tab, and reusing it would mean
 * typing here quietly narrowed a list the user cannot see.
 */
export function PackageItemPicker({
  availableItems,
  isDisabled = false,
  libraryItemCount,
  onReplaceSelection,
  onToggle,
  pendingItemIds,
  selectedItemIds
}: PackageItemPickerProps) {
  const { t } = useAppLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleItems = availableItems.filter(
    (item) =>
      !normalizedSearch ||
      `${item.name} ${item.category}`.toLowerCase().includes(normalizedSearch)
  );
  // Over what the search has left on screen, not over the whole library. A
  // button that also ticks the forty cards a search just hid is not the one
  // anybody meant to press.
  const areAllVisibleTicked =
    visibleItems.length > 0 &&
    visibleItems.every((item) => selectedItemIds.has(item.id));

  return (
    // Named by its own heading rather than by a repeated `aria-label`, which is
    // what makes this half of the panel addressable: the included grid above
    // draws the same card for the same item, so "Select Roast beef" means two
    // different things depending on which region it was found in.
    <section
      aria-labelledby={HEADING_ID}
      className="mx-3 mb-3 overflow-hidden rounded-lg border border-[#d8dde5] bg-white"
    >
      <header className="flex min-h-11 flex-col gap-2 border-b border-[#d8dde5] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-black text-[#17202a]" id={HEADING_ID}>
          {t("menu.addFromLibrary")}
        </h3>
        {availableItems.length > 0 ? (
          <div className="flex items-center gap-2">
            {!isDisabled && visibleItems.length > 0 ? (
              <button
                className="inline-flex h-8 shrink-0 items-center rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
                onClick={() =>
                  onReplaceSelection(
                    areAllVisibleTicked ? [] : visibleItems.map((item) => item.id)
                  )
                }
                type="button"
              >
                {areAllVisibleTicked ? t("menu.selectNone") : t("menu.selectAll")}
              </button>
            ) : null}
            <input
              aria-label={t("menu.searchLibraryToAdd")}
              className="h-8 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none placeholder:text-[#6a7483] focus:border-[#1f4d73] sm:w-56"
              name="packageItemSearch"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("menu.searchItems")}
              type="search"
              value={searchQuery}
            />
          </div>
        ) : null}
      </header>

      {availableItems.length === 0 ? (
        <EmptyState>
          {libraryItemCount === 0
            ? t("menu.libraryEmpty")
            : t("menu.everyItemInPackage")}
        </EmptyState>
      ) : visibleItems.length === 0 ? (
        <EmptyState>{t("menu.noLibraryMatches")}</EmptyState>
      ) : (
        // The same grid and the same card as the included list above it, so an
        // item looks like itself on both sides of the panel and the two halves
        // line up column for column.
        <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 md:grid-cols-4 2xl:grid-cols-6">
          {visibleItems.map((item) => (
            <MenuItemCard
              key={item.id}
              category={item.category}
              isSelectDisabled={isDisabled}
              isTicked={selectedItemIds.has(item.id)}
              name={item.name}
              onToggleTick={() => onToggle(item.id)}
              pendingLabel={pendingItemIds.has(item.id) ? t("common.savingChar") : null}
              pictureUrl={item.pictureUrl}
            />
          ))}
        </div>
      )}
    </section>
  );
}
