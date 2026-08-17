"use client";

import { invalidateAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { readApiError } from "@/lib/http/api-request-error";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

const MENU_URL = "/api/menu";

export type MenuPackageChanges = {
  name?: string;
  regularPrice?: number;
  /**
   * The whole list, not a delta - the column is replaced wholesale. Omit it to
   * leave the package's items alone.
   */
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
 */
export async function updateMenuPackage(
  packageId: string,
  changes: MenuPackageChanges
) {
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

  invalidateAuthenticatedQuery(MENU_URL);
}
