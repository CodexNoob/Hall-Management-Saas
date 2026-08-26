"use client";

import { invalidateAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { readApiError } from "@/lib/http/api-request-error";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

const MENU_URL = "/api/menu";

export type MenuPackageChanges = {
  name?: string;
  regularPrice?: number;
  /**
   * The whole list, replacing what is stored. Omit it to leave the package's
   * items alone.
   *
   * Only for a caller that genuinely holds the complete list - a form with
   * every item on screen at once. Anything editing one item at a time wants the
   * two fields below instead: a whole list is built from whatever was last
   * fetched, so two of them racing means the later one undoes the earlier.
   */
  includedMenuItemIds?: string[];
  /** One end of the change, applied to whatever the server has stored. */
  addMenuItemIds?: string[];
  removeMenuItemIds?: string[];
};

export type UpdatedMenuPackage = {
  id: string;
  includedMenuItemIds?: string[];
};

/**
 * Edits one package.
 *
 * The same shape as `services/menu-items.ts`, and for the same reason:
 * `useAuthenticatedMutation` is bound to a single URL for its lifetime, which a
 * per-package route cannot be. So the one thing that hook would have done is
 * done by hand here - dropping the cached `/api/menu` list, which is the key the
 * page reads packages and items from, not this URL.
 *
 * Rejections are left to the caller. The page turns them into a message beside
 * the package; swallowing one here would leave the list showing a change the
 * server never accepted.
 *
 * Answers with the saved package. What callers want off it is
 * `includedMenuItemIds`, which an add or remove comes back holding: it is the
 * list as the database has it after the write, which is the only copy that
 * accounts for whatever else landed in between.
 */
export async function updateMenuPackage(
  packageId: string,
  changes: MenuPackageChanges
): Promise<UpdatedMenuPackage | null> {
  const response = await authenticatedFetch(
    `${MENU_URL}/packages/${packageId}`,
    {
      method: "PATCH",
      body: JSON.stringify(changes)
    }
  );

  if (!response.ok) {
    throw await readApiError(response);
  }

  const payload = (await response.json().catch(() => null)) as {
    package?: UpdatedMenuPackage;
  } | null;

  invalidateAuthenticatedQuery(MENU_URL);

  return payload?.package ?? null;
}
