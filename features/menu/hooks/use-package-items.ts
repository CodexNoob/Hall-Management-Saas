"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  updateMenuPackage,
  type MenuPackageChanges
} from "@/features/menu/services/menu-packages";
import { ambientTranslate } from "@/lib/i18n/ambient";
import type { MessageKey } from "@/lib/i18n/messages";

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

const FALLBACK_ERROR: MessageKey = "menu.packageUpdateFailed";

// A stable reference for "no package is open", so the effect below is not woken
// by a fresh empty array on every render.
const NO_ITEM_IDS: string[] = [];

/** Order is not compared: the server does not preserve it and nothing reads it. */
function haveSameItems(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

/**
 * Adding and removing the library items a package includes.
 *
 * Two things are going on here, and they solve different halves of the same
 * problem.
 *
 * Each write sends only the items it touched - `addMenuItemIds` or
 * `removeMenuItemIds` - and the server applies them to whatever is stored. It
 * used to send the whole list, rebuilt from the last fetch, which meant two
 * quick clicks both started from the same copy and the second one landed
 * without the first one's item in it. That is a lost write, and no amount of
 * client-side care fixes it, because the other click may be on someone else's
 * screen.
 *
 * Both take a list rather than one id, which is what lets a selection of ten
 * items cost one request instead of ten. The single-item case is just a list of
 * one; there is no separate path for it.
 *
 * The list is then held here as a draft and updated the instant a card is
 * clicked, rather than after a write and a refetch have both come back. The
 * card moves between the two grids immediately; the request follows it. Each
 * response carries the stored list back, which the draft is reset to, so a
 * guess never outlives the answer. The draft is dropped once no write is in
 * flight and the refetched package agrees with it - not on the write returning,
 * which would flash the pre-refetch list back for a frame.
 *
 * Writes are queued rather than fired in parallel. The server would cope
 * either way; it is `pendingItemIds` and the draft that want them ordered, so
 * a response cannot arrive describing a state two clicks stale.
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
  const packageId = activePackage?.id ?? null;
  const storedItemIds = activePackage?.includedMenuItemIds ?? NO_ITEM_IDS;

  // Tagged with the package it belongs to: switching packages while a write is
  // in the air must not draw one package's items under another's name.
  const [draft, setDraft] = useState<{
    packageId: string;
    itemIds: string[];
  } | null>(null);
  // A set, not a single id: a second card can be clicked while the first is
  // still saving, and both should read as busy.
  const [pendingItemIds, setPendingItemIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());

  const itemIds =
    draft && draft.packageId === packageId ? draft.itemIds : storedItemIds;

  const queueWrite = useCallback(
    (
      writingItemIds: string[],
      applyToDraft: (current: string[]) => string[],
      changes: MenuPackageChanges
    ) => {
      if (!packageId || writingItemIds.length === 0) return;

      setDraft((current) =>
        current && current.packageId === packageId
          ? { packageId, itemIds: applyToDraft(current.itemIds) }
          : { packageId, itemIds: applyToDraft(storedItemIds) }
      );
      setPendingItemIds((current) => {
        const next = new Set(current);
        for (const itemId of writingItemIds) next.add(itemId);

        return next;
      });
      setErrorMessage(null);

      writeQueue.current = writeQueue.current
        .then(() => updateMenuPackage(packageId, changes))
        .then(async (saved) => {
          // The stored list, which accounts for anything that landed from
          // another tab or another person between the click and the answer.
          if (saved?.includedMenuItemIds) {
            setDraft({ packageId, itemIds: saved.includedMenuItemIds });
          }

          await onChanged();
        })
        .catch(async (error: unknown) => {
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : ambientTranslate(FALLBACK_ERROR)
          );
          // The whole draft goes, not just this item's part of it. Earlier
          // writes in the queue already landed, so the refetch below is the
          // honest answer about what the package holds - reverting one item by
          // hand would be a second guess on top of the one that just failed.
          setDraft(null);

          // Wrapped because `onChanged` may hand back nothing at all, and a
          // refetch that fails here must not replace the message above with
          // its own.
          await Promise.resolve(onChanged()).catch(() => undefined);
        })
        .finally(() => {
          setPendingItemIds((current) => {
            const next = new Set(current);
            for (const itemId of writingItemIds) next.delete(itemId);

            return next;
          });
        });
    },
    [onChanged, packageId, storedItemIds]
  );

  const addItems = useCallback(
    (addedItemIds: string[]) => {
      queueWrite(
        addedItemIds,
        (current) => [
          ...current,
          ...addedItemIds.filter((itemId) => !current.includes(itemId))
        ],
        { addMenuItemIds: addedItemIds }
      );
    },
    [queueWrite]
  );

  const removeItems = useCallback(
    (removedItemIds: string[]) => {
      queueWrite(
        removedItemIds,
        (current) => current.filter((itemId) => !removedItemIds.includes(itemId)),
        { removeMenuItemIds: removedItemIds }
      );
    },
    [queueWrite]
  );

  // Hands the list back to the server copy once the two say the same thing.
  // Held until then rather than cleared when the write returns, so the panel
  // never drops back to the pre-refetch list for a frame.
  useEffect(() => {
    if (!draft) return;

    if (draft.packageId !== packageId) {
      setDraft(null);

      return;
    }

    if (pendingItemIds.size > 0) return;

    if (haveSameItems(draft.itemIds, storedItemIds)) setDraft(null);
  }, [draft, packageId, pendingItemIds, storedItemIds]);

  return {
    addItems,
    removeItems,
    /** What to draw: the optimistic list while one is held, the stored one otherwise. */
    itemIds,
    pendingItemIds,
    errorMessage,
    dismissError: useCallback(() => setErrorMessage(null), [])
  };
}
