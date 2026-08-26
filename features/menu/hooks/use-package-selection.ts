"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Which of the package panel's two grids a selection belongs to.
 *
 * "included" is what the package holds and "library" is what it could hold, and
 * the same item can appear in either - never both, but it moves between them.
 */
export type PackageGrid = "included" | "library";

const NO_SELECTION: ReadonlySet<string> = new Set();

/**
 * Which cards are ticked in the package panel, and in which of its two grids.
 *
 * One selection between them rather than one each. The two grids sit above and
 * below one another with an action bar apiece, so allowing both to hold a
 * selection at once would put two bars on screen offering opposite verbs -
 * and leave the reader to work out which of them the next tap belongs to.
 * Ticking a card in one grid drops whatever was ticked in the other.
 *
 * Nothing here writes. The panel hands the ids to `usePackageItems` and clears
 * the selection itself, which is what makes a failed write leave the cards
 * where they are instead of ticked against a list that never changed.
 */
export function usePackageSelection(packageId: string | null) {
  const [selection, setSelection] = useState<{
    grid: PackageGrid;
    itemIds: ReadonlySet<string>;
  } | null>(null);

  // A selection is a set of ids in one package's panel. Carrying it to the next
  // package would tick cards the reader never touched, and in the picker those
  // ids may not even be on offer.
  useEffect(() => {
    setSelection(null);
  }, [packageId]);

  const selectedIn = useCallback(
    (grid: PackageGrid) =>
      selection && selection.grid === grid ? selection.itemIds : NO_SELECTION,
    [selection]
  );

  const toggle = useCallback((grid: PackageGrid, itemId: string) => {
    setSelection((current) => {
      const itemIds =
        current && current.grid === grid
          ? new Set(current.itemIds)
          : new Set<string>();

      if (itemIds.has(itemId)) itemIds.delete(itemId);
      else itemIds.add(itemId);

      return itemIds.size ? { grid, itemIds } : null;
    });
  }, []);

  /** Ticks exactly these ids, for the "select all" the grid headers offer. */
  const replace = useCallback((grid: PackageGrid, itemIds: string[]) => {
    setSelection(itemIds.length ? { grid, itemIds: new Set(itemIds) } : null);
  }, []);

  const clear = useCallback(() => setSelection(null), []);

  return { selectedIn, toggle, replace, clear };
}
