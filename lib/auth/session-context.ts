/**
 * The wire contract for POST /api/auth/session.
 *
 * This module owns the shape outright: the route serializes through
 * `serializeAuthSession`, `lib/auth/client.ts` re-exports these types rather
 * than restating them, and `isAuthSessionResponse` guards what comes back out of
 * the browser cache. Before this existed the same object was written by hand in
 * four places - the route, the client type, the client's runtime guard and the
 * test fixture - and nothing made them agree.
 *
 * THE BROWSER READS KEYS, NEVER ROLES (INV-1).
 *
 * There is no `role` field anywhere in this response and no administrator
 * concept on the client, because there is no administrator concept anywhere.
 * `useAccess("event.create")` is the whole client-side API.
 *
 * Client hints are FOR RENDERING ONLY. Every mutation re-decides server-side. A
 * hidden button is a courtesy; the 403 is the control.
 *
 * Kept free of Prisma and of `server-only` on purpose. The inputs are declared
 * structurally, so the serializer stays a pure function of plain data, is
 * importable from either side of the network boundary, and can be tested without
 * a database.
 */

import type { PermissionKey } from "@/lib/authz/catalog";
import type { ScopeFilter } from "@/lib/authz/types";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  venueName: string | null;
  /** Job title. Not a privilege - see the RBAC migration. */
  title: string | null;
  organizationId: string;
};

export type SessionOrganization = {
  id: string;
  name: string;
  slug: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  subscriptionStartedAt: string | null;
  subscriptionEndsAt: string | null;
  onboardingCompletedAt: string | null;
};

export type AuthSessionResponse = {
  user: SessionUser;
  /** Every key the signed-in principal holds in the active organization. */
  permissions: PermissionKey[];
  /**
   * A RENDERING HINT, and deliberately lossy: the widest set of halls and event
   * types that ANY held permission reaches.
   *
   * Scope resolves per permission on the server, so a principal who is Kitchen
   * Staff at Hall A and Viewer organization-wide has different scopes for
   * different keys. Collapsing that into one filter is fine for deciding what to
   * put in a hall picker and wrong for deciding whether a write will succeed -
   * which is why the server never consults this and re-decides every mutation.
   */
  scope: ScopeFilter;
  /**
   * The permissions epoch these keys were computed under.
   *
   * Any API response carrying a higher one triggers a session refetch. That is
   * how a revoked permission takes effect without a sign-out, and it costs one
   * comparison in the fetch wrapper.
   */
  epoch: number;
  mustSetPassword: boolean;
  /**
   * True when the signed-in owner still has to name their organization and pick
   * a plan on /dashboard/new. The dashboard layout holds them there until they
   * do.
   */
  mustCompleteOnboarding: boolean;
  activeOrganizationId: string;
  organizations: SessionOrganization[];
};

type Timestamp = Date | string | null | undefined;

/** Rows as Prisma hands them over, before JSON turns the dates into strings. */
type UserRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  venueName: string | null;
  title: string | null;
  organizationId: string;
  passwordSetAt: Timestamp;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  trialStartedAt: Timestamp;
  trialEndsAt: Timestamp;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  subscriptionStartedAt: Timestamp;
  subscriptionEndsAt: Timestamp;
  onboardingCompletedAt: Timestamp;
};

type MembershipRow = {
  organizationId: string;
  organization: OrganizationRow;
};

/**
 * The key that gates naming the organization and choosing its plan.
 *
 * This used to read `normalizeStaffRole(membership.role) === "owner"`, which is
 * exactly the shape INV-1 forbids. Asking for the permission instead means a
 * tenant who invents a "Founder" role and gives it `settings.update` gets the
 * onboarding form, with no code change.
 */
const ONBOARDING_PERMISSION: PermissionKey = "settings.update";

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toNullableIsoString(value: Timestamp): string | null {
  if (!value) return null;

  return toIsoString(value);
}

function serializeOrganization(membership: MembershipRow): SessionOrganization {
  const { organization } = membership;

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    trialStartedAt: toNullableIsoString(organization.trialStartedAt),
    trialEndsAt: toNullableIsoString(organization.trialEndsAt),
    subscriptionStatus: organization.subscriptionStatus,
    subscriptionPlan: organization.subscriptionPlan,
    subscriptionStartedAt: toNullableIsoString(
      organization.subscriptionStartedAt
    ),
    subscriptionEndsAt: toNullableIsoString(organization.subscriptionEndsAt),
    onboardingCompletedAt: toNullableIsoString(
      organization.onboardingCompletedAt
    )
  };
}

function unionDimension(
  left: string[] | "all",
  right: string[] | "all"
): string[] | "all" {
  if (left === "all" || right === "all") return "all";

  return [...new Set([...left, ...right])];
}

/** The widest scope any held permission reaches. See `AuthSessionResponse.scope`. */
export function widestScope(
  scopes: Iterable<ScopeFilter>
): ScopeFilter {
  let hallIds: string[] | "all" = [];
  let eventTypeIds: string[] | "all" = [];

  for (const scope of scopes) {
    hallIds = unionDimension(hallIds, scope.hallIds);
    eventTypeIds = unionDimension(eventTypeIds, scope.eventTypeIds);
  }

  return { hallIds, eventTypeIds };
}

export function serializeAuthSession(input: {
  user: UserRow;
  /** Sorted by the caller, so the cached payload is stable between fetches. */
  permissions: PermissionKey[];
  scope: ScopeFilter;
  epoch: number;
  /** Active memberships only - the caller has already filtered them. */
  memberships: MembershipRow[];
  /**
   * Whether the account can sign in with a password at all. An OAuth-only user
   * has no password to be missing, so they must never be sent to password setup.
   */
  usesEmailPassword: boolean;
}): AuthSessionResponse {
  const { user, permissions, scope, epoch, memberships, usesEmailPassword } =
    input;

  // Deliberately the user's primary organization rather than the request-scoped
  // resolver's header/cookie precedence: this response tells the client where to
  // *start*, and switching organizations is a later, explicit act. Reusing the
  // resolver here would make a stale cookie decide what a fresh sign-in returns.
  const activeMembership = memberships.find(
    (membership) => membership.organizationId === user.organizationId
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      venueName: user.venueName,
      title: user.title,
      organizationId: user.organizationId
    },
    permissions,
    scope,
    epoch,
    mustSetPassword: usesEmailPassword && !user.passwordSetAt,
    mustCompleteOnboarding:
      permissions.includes(ONBOARDING_PERMISSION) &&
      !activeMembership?.organization.onboardingCompletedAt,
    activeOrganizationId: user.organizationId,
    organizations: memberships.map(serializeOrganization)
  };
}

export function isAuthSessionResponse(
  value: unknown
): value is AuthSessionResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<AuthSessionResponse>;

  // `permissions` and `epoch` are checked so a payload cached before the RBAC
  // cutover - which carried a 23-boolean `access` object and no keys at all - is
  // rejected and refetched rather than read as "holds nothing".
  return Boolean(
    payload.user &&
      typeof payload.user === "object" &&
      Array.isArray(payload.permissions) &&
      payload.scope &&
      typeof payload.scope === "object" &&
      typeof payload.epoch === "number" &&
      typeof payload.mustSetPassword === "boolean" &&
      typeof payload.mustCompleteOnboarding === "boolean" &&
      typeof payload.activeOrganizationId === "string" &&
      Array.isArray(payload.organizations)
  );
}
