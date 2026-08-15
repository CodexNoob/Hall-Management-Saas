import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/supabase/cookie-policy";
import { isAdministrativeRole } from "@/lib/auth/roles";
import { resolveAuthIdentity } from "@/lib/auth/identity";
import { AuthorizationError } from "@/lib/auth/errors";

/**
 * Layer 3 of the auth stack: what this request is allowed to do.
 *
 * Credential verification lives in `lib/auth/identity.ts` and provisioning in
 * `lib/auth/provisioning.ts`; this module assumes both have happened and
 * answers only "who is acting, on which organization, with what permissions".
 *
 * The exported names here are the app's authorization surface - 39 routes call
 * them - so they are kept stable on purpose.
 */

export { AuthorizationError };

export type Permission =
  | "canViewCalendar"
  | "canCreateBooking"
  | "canViewEventManager"
  | "canViewKitchenDashboard"
  | "canViewMenu"
  | "canEditMenu"
  | "canViewSettings"
  | "canEditSettings"
  | "canEditStaff"
  | "canEditVendors"
  | "canEditClients"
  | "canEditFiles"
  | "canAssignWorkers"
  | "canUpdateKitchenStatus"
  | "canAddKitchenEvents"
  | "canManageSchoolSchedule"
  | "canViewPaymentInfo"
  | "canManagePayments"
  | "canSendPaymentEmail";

/**
 * Which organization this request acts on.
 *
 * An explicit `x-organization-id` header naming an organization the user is not
 * a member of is a hard 403 - the caller asked for something specific and got
 * it wrong.
 *
 * The cookie is ambient state, so a stale one degrades to the default instead.
 * It goes stale the moment an administrator revokes a membership, and 403-ing
 * every request with no way for the user to clear it is a worse outcome than
 * quietly falling back. POST /api/auth/session re-stamps it, so it heals.
 */
function resolveMembership<
  T extends { organizationId: string }
>(
  activeMemberships: T[],
  defaultOrganizationId: string,
  requestedOrganizationId: string | null,
  hintedOrganizationId: string | null
): T {
  const find = (organizationId: string) =>
    activeMemberships.find(
      (candidate) => candidate.organizationId === organizationId
    );

  if (requestedOrganizationId) {
    const requested = find(requestedOrganizationId);

    if (!requested) {
      throw new AuthorizationError(
        403,
        "You do not have access to the requested organization."
      );
    }

    return requested;
  }

  const hinted = hintedOrganizationId ? find(hintedOrganizationId) : undefined;

  if (hinted) return hinted;

  const fallback = find(defaultOrganizationId) ?? activeMemberships[0];

  if (!fallback) {
    throw new AuthorizationError(
      403,
      "You do not have access to the requested organization."
    );
  }

  return fallback;
}

/**
 * The caller, their organization and their permissions - or a thrown
 * `AuthorizationError`.
 *
 * This reads; it does not provision. Claiming a legacy row by email used to
 * happen here as a fallback, and it was a write on the hot path of all 39
 * routes that duplicated what POST /api/auth/session already does properly,
 * inside a transaction, with an audit entry. Every browser session calls that
 * route before it can reach a protected one (`fetchAuthSession` runs on the
 * sign-in path and the Playwright fixtures sign in through the UI), so the
 * fallback could only ever fire for a caller that had never fetched a session at all.
 */
export async function requireAuthenticatedUser(request?: Request) {
  const identity = await resolveAuthIdentity(request);

  const user = await prisma.user.findUnique({
    where: { supabaseAuthId: identity.id },
    include: {
      access: true,
      memberships: { include: { organization: true } }
    }
  });

  if (!user) {
    throw new AuthorizationError(403, "User account is not provisioned.");
  }

  if (!user.isActive) {
    throw new AuthorizationError(403, "User account is inactive.");
  }

  const activeMemberships = user.memberships.filter(
    (membership) => membership.isActive && membership.organization.isActive
  );
  const membership = resolveMembership(
    activeMemberships,
    user.organizationId,
    request?.headers.get("x-organization-id") ?? null,
    (await cookies()).get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null
  );

  const access = user.access.find(
    (candidate) => candidate.organizationId === membership.organizationId
  );

  return {
    ...user,
    organizationId: membership.organizationId,
    organization: membership.organization,
    membership,
    access
  };
}

export async function requirePermission(
  request: Request | undefined,
  permission: Permission
) {
  const user = await requireAuthenticatedUser(request);

  if (
    !isAdministrativeRole(user.membership.role) &&
    !user.access?.[permission]
  ) {
    throw new AuthorizationError(
      403,
      "You do not have permission to perform this action."
    );
  }

  return user;
}

export async function requireAnyPermission(
  request: Request | undefined,
  permissions: Permission[]
) {
  const user = await requireAuthenticatedUser(request);

  if (
    !isAdministrativeRole(user.membership.role) &&
    !permissions.some((permission) => user.access?.[permission])
  ) {
    throw new AuthorizationError(
      403,
      "You do not have permission to perform this action."
    );
  }

  return user;
}

export function assertHallAccess(
  user: Awaited<ReturnType<typeof requireAuthenticatedUser>>,
  hallId: string
) {
  const allowedHallIds = user.access?.allowedHallIds ?? [];

  // Organization scoping is mandatory in every query. An empty list means the
  // member may access every hall inside the already-validated organization.
  if (
    !isAdministrativeRole(user.membership.role) &&
    allowedHallIds.length > 0 &&
    !allowedHallIds.includes(hallId)
  ) {
    throw new AuthorizationError(403, "You do not have access to this hall.");
  }
}
