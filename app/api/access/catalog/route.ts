import { NextResponse } from "next/server";
import { authorize } from "@/lib/authz/authorize";
import { groupedPermissionCatalog } from "@/lib/authz/catalog";
import { createApiErrorResponse } from "@/lib/http/api-error";

/**
 * The permission catalog, grouped and sorted.
 *
 * The role editor renders THIS - it does not ship its own copy. A second list in
 * the client is a second place to forget a key, and the failure mode is a
 * permission that exists, is enforced, and cannot be granted by anyone because
 * no checkbox draws it.
 *
 * Served from the compile-time catalog rather than the table: the two are pinned
 * to each other by a test, and reading the file avoids a query on a screen that
 * already makes several.
 */
export async function GET(request: Request) {
  try {
    const actor = await authorize(request, "role.read");

    return NextResponse.json({
      groups: groupedPermissionCatalog(),
      epoch: actor.epoch
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
