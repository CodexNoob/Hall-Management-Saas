import "server-only";

import { prisma } from "@/lib/prisma";
import { createSupabaseTokenVerifier } from "@/lib/supabase/server";
import { isAdministrativeRole } from "@/lib/auth/roles";

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

export class AuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export async function requireAuthenticatedUser(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    throw new AuthorizationError(401, "Authentication required.");
  }

  const supabase = createSupabaseTokenVerifier();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user?.email) {
    throw new AuthorizationError(401, "Invalid or expired session.");
  }

  let user = await prisma.user.findUnique({
    where: { supabaseAuthId: data.user.id },
    include: {
      access: true,
      memberships: { include: { organization: true } }
    }
  });

  // Backfill users created before supabaseAuthId was introduced. Supabase has
  // already verified ownership of the email address above.
  if (!user) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.user.email },
      select: { id: true }
    });

    if (existingUser) {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { supabaseAuthId: data.user.id },
        include: {
          access: true,
          memberships: { include: { organization: true } }
        }
      });
    }
  }

  if (!user) {
    throw new AuthorizationError(403, "User account is not provisioned.");
  }

  if (!user.isActive) {
    throw new AuthorizationError(403, "User account is inactive.");
  }

  const requestedOrganizationId = request.headers.get("x-organization-id");
  const activeMemberships = user.memberships.filter(
    (membership) => membership.isActive && membership.organization.isActive
  );
  const membership = requestedOrganizationId
    ? activeMemberships.find(
        (candidate) => candidate.organizationId === requestedOrganizationId
      )
    : (activeMemberships.find(
        (candidate) => candidate.organizationId === user.organizationId
      ) ?? activeMemberships[0]);

  if (!membership) {
    throw new AuthorizationError(
      403,
      "You do not have access to the requested organization."
    );
  }

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
  request: Request,
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
  request: Request,
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
