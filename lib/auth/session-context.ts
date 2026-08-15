/**
 * The wire contract for POST /api/auth/session.
 *
 * This module owns the shape outright: the route serializes through
 * `serializeAuthSession`, `lib/auth/client.ts` re-exports these types rather
 * than restating them, and `isAuthSessionResponse` guards what comes back
 * out of the browser cache. Before this existed the same object was written by
 * hand in four places - the route, the client type, the client's runtime guard
 * and the test fixture - and nothing made them agree.
 *
 * Kept free of Prisma and of `server-only` on purpose. The inputs are declared
 * structurally, so the serializer stays a pure function of plain data, is
 * importable from either side of the network boundary, and can be tested
 * without a database.
 */

import { normalizeStaffRole } from "@/lib/auth/permissions";

export type SessionUserAccess = {
  id: string;
  userId: string;
  canViewHome: boolean;
  canViewCalendar: boolean;
  canCreateBooking: boolean;
  canViewEventManager: boolean;
  canViewKitchenDashboard: boolean;
  canViewMenu: boolean;
  canEditMenu: boolean;
  canViewSettings: boolean;
  canEditSettings: boolean;
  canEditStaff: boolean;
  canEditVendors: boolean;
  canEditClients: boolean;
  canEditFiles: boolean;
  canAssignWorkers: boolean;
  canUpdateKitchenStatus: boolean;
  canAddKitchenEvents: boolean;
  canManageSchoolSchedule: boolean;
  canSeeSchoolEvents: boolean;
  canSeeSimchaEvents: boolean;
  canViewPaymentInfo: boolean;
  canManagePayments: boolean;
  canSendPaymentEmail: boolean;
  canUseNiceHomeBackground: boolean;
  allowedHallIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  venueName: string | null;
  role: string;
  organizationId: string;
};

export type SessionOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
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
  access: SessionUserAccess;
  mustSetPassword: boolean;
  /**
   * True when the signed-in owner still has to name their organization and pick a
   * plan on /dashboard/new. The dashboard layout holds them there until they do.
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
  role: string;
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
  role: string;
  organization: OrganizationRow;
};

type AccessRow = Omit<SessionUserAccess, "createdAt" | "updatedAt"> & {
  createdAt: Date | string;
  updatedAt: Date | string;
};

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
    role: membership.role,
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

export function serializeAuthSession(input: {
  user: UserRow;
  access: AccessRow;
  /** Active memberships only - the caller has already filtered them. */
  memberships: MembershipRow[];
  /**
   * Whether the account can sign in with a password at all. An OAuth-only user
   * has no password to be missing, so they must never be sent to password setup.
   */
  usesEmailPassword: boolean;
}): AuthSessionResponse {
  const { user, access, memberships, usesEmailPassword } = input;

  // Deliberately the user's primary organization rather than
  // `resolveMembership`'s header/cookie precedence: this response tells the
  // client where to *start*, and switching organizations is a later, explicit
  // act. Reusing the request-scoped resolver here would make a stale cookie
  // decide what a fresh sign-in returns.
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
      role: user.role,
      organizationId: user.organizationId
    },
    access: {
      ...access,
      createdAt: toIsoString(access.createdAt),
      updatedAt: toIsoString(access.updatedAt)
    },
    mustSetPassword: usesEmailPassword && !user.passwordSetAt,
    // Only an owner can name the organization and pick its plan, so invited
    // staff never see the setup form even if they happen to be the first one in.
    mustCompleteOnboarding:
      normalizeStaffRole(activeMembership?.role) === "owner" &&
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
  // `mustCompleteOnboarding` is checked too, so a cache written before the
  // onboarding gate existed is rejected and re-fetched rather than silently
  // reading as "already onboarded".
  return Boolean(
    payload.user &&
    payload.access &&
    typeof payload.user === "object" &&
    typeof payload.access === "object" &&
    typeof payload.mustSetPassword === "boolean" &&
    typeof payload.mustCompleteOnboarding === "boolean" &&
    typeof payload.activeOrganizationId === "string" &&
    Array.isArray(payload.organizations)
  );
}
