"use client";

import { useCallback, useState } from "react";
import type { MenuLibraryItem } from "@/features/menu/components/menu-shared";
import type {
  LibraryItemSeedValues,
  NewLibraryItemFormValues
} from "@/features/menu/forms/new-library-item-dialog";
import { uploadMenuPicture } from "@/features/menu/lib/upload-menu-picture";
import {
  deleteMenuItem,
  updateMenuItem
} from "@/features/menu/services/menu-items";

type UseMenuItemActionsInput = {
  items: MenuLibraryItem[];
  /** Refetches the list once the server has accepted a change. */
  onChanged: () => Promise<unknown> | void;
};

/**
 * The update and remove flows for a library item, kept out of the page.
 *
 * The page keeps the ids it is acting on and nothing else - which item is being
 * edited, which one is waiting on a confirmation - so the grid stays a list of
 * cards and the dialogs stay presentational. Errors are deliberately not
 * swallowed: the dialogs already render what they catch, and doing it here as
 * well would show the same failure twice.
 */
export function useMenuItemActions({
  items,
  onChanged
}: UseMenuItemActionsInput) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  // Resolved from the live list rather than copied into state, so a card that
  // is refetched away cannot leave a dialog open over a row that is gone.
  const editingItem = items.find((item) => item.id === editingItemId) ?? null;
  const removingItem = items.find((item) => item.id === removingItemId) ?? null;

  const editingValues: LibraryItemSeedValues | undefined = editingItem
    ? {
        name: editingItem.name,
        category: editingItem.category,
        kashrutType: editingItem.kosherType ?? "Parve",
        // Not a column on menu_items - there is nothing to seed it from, and
        // nothing stores it on the way back out either.
        allergies: "",
        description: editingItem.notes ?? ""
      }
    : undefined;

  const saveEdit = useCallback(
    async (values: NewLibraryItemFormValues) => {
      if (!editingItemId) return;

      // Same order as a create: upload first, so a failure leaves an unused
      // object in the bucket rather than a row pointing at nothing. An untouched
      // file input sends no path at all, which is what keeps the current picture.
      const picturePath = values.picture
        ? await uploadMenuPicture(values.picture)
        : undefined;

      await updateMenuItem(editingItemId, {
        name: values.name,
        category: values.category,
        kosherType: values.kashrutType,
        notes: values.description,
        picturePath
      });

      await onChanged();
      setEditingItemId(null);
    },
    [editingItemId, onChanged]
  );

  const confirmRemove = useCallback(async () => {
    if (!removingItemId) return;

    await deleteMenuItem(removingItemId);
    await onChanged();
    setRemovingItemId(null);
  }, [onChanged, removingItemId]);

  return {
    editingItem,
    editingValues,
    startEdit: useCallback((itemId: string) => setEditingItemId(itemId), []),
    cancelEdit: useCallback(() => setEditingItemId(null), []),
    saveEdit,
    removingItem,
    startRemove: useCallback((itemId: string) => setRemovingItemId(itemId), []),
    cancelRemove: useCallback(() => setRemovingItemId(null), []),
    confirmRemove
  };
}
