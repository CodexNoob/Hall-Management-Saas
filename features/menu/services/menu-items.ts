"use client";

import { invalidateAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import type { MenuItemServiceRule } from "@/features/menu/lib/service-style";
import { readApiError } from "@/lib/http/api-request-error";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

const MENU_URL = "/api/menu";

export type MenuItemChanges = {
  name?: string;
  category?: string;
  /** School | Simcha | Both; the server rejects anything else. */
  usageType?: string;
  kind?: string;
  /**
   * Omitted leaves the stored rules alone; `[]` clears them, which is how an
   * item moves back to library-only. Same distinction `picturePath` draws.
   */
  services?: MenuItemServiceRule[];
  kosherType?: string;
  /**
   * `null` unsays it, which is what an item re-filed from a drink to a dish
   * sends: only the drink form asks this, so a dish carrying an answer would be
   * holding one from a question it no longer gets put. Omitted leaves it alone.
   */
  containsAlcohol?: boolean | null;
  allergens?: string[];
  notes?: string;
  /** `null` clears the stored picture; omitted leaves it as it is. */
  picturePath?: string | null;
};

/**
 * `useAuthenticatedMutation` is bound to one URL for its lifetime, which a
 * per-item route cannot be. These two go through `authenticatedFetch` directly
 * and do by hand the one thing that hook would otherwise have done: invalidate
 * the cached list. It is `/api/menu` that has to be dropped, not the item URL -
 * that is the key the grid reads from.
 */
async function requestMenuItem(itemId: string, init: RequestInit) {
  const response = await authenticatedFetch(
    `${MENU_URL}/items/${itemId}`,
    init
  );

  if (!response.ok) {
    throw await readApiError(response);
  }

  invalidateAuthenticatedQuery(MENU_URL);
}

export async function updateMenuItem(itemId: string, changes: MenuItemChanges) {
  await requestMenuItem(itemId, {
    method: "PATCH",
    body: JSON.stringify(changes)
  });
}

export async function deleteMenuItem(itemId: string) {
  await requestMenuItem(itemId, { method: "DELETE" });
}

/** One row of a CSV import, already parsed and reviewed by the operator. */
export type MenuItemImportInput = {
  name: string;
  category?: string;
  usageType: string;
  kind: string;
  kosherType?: string;
  allergens: string[];
  notes?: string;
  /** The one rule the whole file is imported with, or `[]` for library-only. */
  services: MenuItemServiceRule[];
};

/**
 * Writes a whole reviewed file in one request.
 *
 * Not `mutate` per row: the endpoint imports the batch in a transaction, and a
 * request per dish would turn one refusal into a half-imported menu with no
 * bulk delete to undo it. Returns the count the server actually wrote rather
 * than the count that was sent.
 */
export async function importMenuItems(items: MenuItemImportInput[]) {
  const response = await authenticatedFetch(`${MENU_URL}/import`, {
    method: "POST",
    body: JSON.stringify({ items })
  });

  if (!response.ok) {
    throw await readApiError(response);
  }

  const payload = (await response.json().catch(() => null)) as {
    imported?: number;
  } | null;

  // The grid reads `/api/menu`, so that is the key to drop - the same reason
  // `requestMenuItem` above invalidates it rather than the URL it called.
  invalidateAuthenticatedQuery(MENU_URL);

  return payload?.imported ?? items.length;
}
