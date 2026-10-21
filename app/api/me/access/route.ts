import { NextResponse } from "next/server";

import { listAssignments } from "@/lib/authz/admin/assignments";
import {
  authorizeMember,
  effectiveAccessOf,
  requireUserActor
} from "@/lib/authz/authorize";
import { groupedPermissionCatalog } from "@/lib/authz/catalog";
import { isEntitled } from "@/lib/authz/entitlement";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";

/**
 * "What am I allowed to do here?" - read-only, for the My Account page.
 *
 * The same two sources the Staff screens read for an administrator: the role
 * assignments, and the effective permission set they resolve to. Answered for
 * the CALLER'S principal only, which comes from the verified session. There is
 * no parameter that could name anybody else, and nothing here writes.
 *
 * Entitlement is applied as it is everywhere else, so a key the plan does not
 * include is not listed as something the person can do.
 */
export const GET = withRoute("GET /api/me/access", async (request: Request) => {
  try {
    const actor = await authorizeMember(request);
    requireUserActor(actor);

    const [assignments, access] = await Promise.all([
      listAssignments(actor.organizationId, [actor.principalId]),
      effectiveAccessOf(actor)
    ]);

    const roles = (assignments.get(actor.principalId) ?? []).map(
      (assignment) => ({
        id: assignment.id,
        roleName: assignment.roleName,
        scopeType: assignment.scopeType,
        scopeLabel: assignment.scopeLabel,
        expiresAt: assignment.expiresAt
      })
    );

    const permissionGroups = groupedPermissionCatalog()
      .map(({ group, permissions }) => ({
        group,
        permissions: permissions
          .filter(
            (entry) =>
              access.permissions.has(entry.key) &&
              isEntitled(actor.organization, entry.key)
          )
          .map((entry) => ({ key: entry.key, label: entry.label }))
      }))
      .filter((group) => group.permissions.length > 0);

    return NextResponse.json({ roles, permissionGroups });
  } catch (error) {
    return createApiErrorResponse(error);
  }
});
