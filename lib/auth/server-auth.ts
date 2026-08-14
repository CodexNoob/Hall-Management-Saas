import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  createSupabaseServerClient,
  createSupabaseTokenVerifier
} from "@/lib/supabase/server";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  isSupabaseAuthCookieName
} from "@/lib/supabase/cookie-policy";
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

type AuthIdentity = { id: string; email: string };

/**
 * Resolves the caller from either transport.
 *
 * Bearer is tried first and kept deliberately: the Playwright mutation fixture
 * and any non-browser caller still send one, and an explicit credential should
 * win over whatever the ambient cookie jar happens to hold.
 *
 * The cookie path is what lets a Server Component call these helpers at all -
 * it has no Request to hand in, which is why `request` is optional.
 *
 * Uses getClaims() rather than getUser(): it verifies the JWT signature locally
 * against the project's public signing key, so this costs no round trip to the
 * Auth server on a path that every one of the API routes runs. (With a legacy
 * HS256 secret it falls back to getUser() internally, so it is never weaker
 * than what it replaced.) The one thing local verification cannot see is a
 * Supabase-side ban issued mid-token, and that is covered a few lines below by
 * the `isActive` check against our own database, which is the flag this app
 * actually deactivates people with.
 */
async function resolveAuthUser(request?: Request): Promise<AuthIdentity> {
  const token = request ? getBearerToken(request) : null;

  if (token) {
    const supabase = createSupabaseTokenVerifier();
    const { data, error } = await supabase.auth.getClaims(token);
    const claims = data?.claims;

    if (error || typeof claims?.sub !== "string" || typeof claims.email !== "string") {
      throw new AuthorizationError(401, "Invalid or expired session.");
    }

    return { id: claims.sub, email: claims.email };
  }

  // Checked before building a client so that "no credential at all" and
  // "credential present but unusable" stay distinguishable. All 39 protected
  // routes surface these two strings, and collapsing them would report an
  // expired session as a missing one.
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((cookie) => isSupabaseAuthCookieName(cookie.name));

  if (!hasAuthCookie) {
    throw new AuthorizationError(401, "Authentication required.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || typeof claims?.sub !== "string" || typeof claims.email !== "string") {
    throw new AuthorizationError(401, "Invalid or expired session.");
  }

  return { id: claims.sub, email: claims.email };
}

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
 * quietly falling back. POST /api/auth/sync-user re-stamps it, so it heals.
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

export async function requireAuthenticatedUser(request?: Request) {
  const identity = await resolveAuthUser(request);

  let user = await prisma.user.findUnique({
    where: { supabaseAuthId: identity.id },
    include: {
      access: true,
      memberships: { include: { organization: true } }
    }
  });

  // Backfill users created before supabaseAuthId was introduced. Supabase has
  // already verified ownership of the email address above.
  if (!user) {
    const existingUser = await prisma.user.findUnique({
      where: { email: identity.email },
      select: { id: true }
    });

    if (existingUser) {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { supabaseAuthId: identity.id },
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
