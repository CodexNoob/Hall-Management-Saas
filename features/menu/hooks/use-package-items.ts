"use client";

import { useCallback, useState } from "react";
import { updateMenuPackage } from "@/features/menu/services/menu-packages";

type ActivePackage = {
  id: string;
  includedMenuItemIds: string[];
};

type UsePackageItemsInput = {
  /** The package being edited, or `null` while none is selected. */
  activePackage: ActivePackage | null;
  /** Refetches the list once the server has accepted a change. */
  onChanged: () => Promise<unknown> | void;
};

const FALLBACK_ERROR =
  "The package could not be updated. Please try again.";

/**
 * Adding and removing the library items a package includes.
 *
 * Every write sends the whole list, because that is what the column is - one
 * array, replaced as a unit. The list it edits is read from the freshly fetched
 * package on each call rather than kept in state, so two quick clicks cannot
 * both build their new array from the same stale copy and have the second one
 * undo the first.
 *
 * Unlike `useMenuItemActions`, this one holds onto the failure. That hook lets
 * rejections through because a dialog is already showing and renders them;
 * adding an item is a single click with no dialog behind it, so there would be
 * nowhere for the message to land.
 */
export function usePackageItems({
  activePackage,
  onChanged
}: UsePackageItemsInput) {
  // The id being written, not a boolean: it is what lets the one card that was
  // clicked show as busy instead of the whole grid going dead.
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const writeItems = useCallback(
    async (itemId: string, includedMenuItemIds: string[]) => {
      if (!activePackage) return;

      setPendingItemId(itemId);
      setErrorMessage(null);

      try {
        await updateMenuPackage(activePackage.id, { includedMenuItemIds });
        await onChanged();
      } catch (error) {
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : FALLBACK_ERROR
        );
      } finally {
        setPendingItemId(null);
      }
    },
    [activePackage, onChanged]
  );

  const addItem = useCallback(
    async (itemId: string) => {
      if (!activePackage) return;
      // Already there: the picker hides included items, so this can only be a
      // second click on a card that has not been refetched away yet.
      if (activePackage.includedMenuItemIds.includes(itemId)) return;

      await writeItems(itemId, [...activePackage.includedMenuItemIds, itemId]);
    },
    [activePackage, writeItems]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!activePackage) return;

      await writeItems(
        itemId,
        activePackage.includedMenuItemIds.filter((id) => id !== itemId)
      );
    },
    [activePackage, writeItems]
  );

  return {
    addItem,
    removeItem,
    pendingItemId,
    errorMessage,
    dismissError: useCallback(() => setErrorMessage(null), [])
  };
}
