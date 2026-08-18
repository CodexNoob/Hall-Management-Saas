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
