import "server-only";

import type {
  Prisma,
  Organization,
  OrganizationMembership,
  User,
  UserAccess
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accessForRole } from "@/lib/auth/permissions";
import { createOrganizationSlug } from "@/lib/auth/organization-slug";
import { createActivityLog } from "@/lib/audit/activity-log";
import {
  isTesterBypassEmail,
  newOrganizationSubscription
} from "@/lib/subscription/trial";
import {
  AccountDeactivatedError,
  InvitationRequiredError
} from "@/lib/auth/errors";
import type { SupabaseProfile } from "@/lib/auth/supabase-profile";

/**
 * Layer 2 of the auth stack: given a verified Supabase identity, make sure our
 * own database has a user, a membership and an access row to match - and hand
 * back what it found.
 *
 * Two rules shape everything below.
 *
 * 1. Provisioning heals what is MISSING, never what is REVOKED. Creating an
 *    absent row is convenience; flipping an `isActive` flag back on is undoing
 *    an administrator's decision. The old code did the second one, so a staff
 *    member removed through DELETE /api/staff reinstated themselves - with
 *    their old role - just by signing in again.
 *
 * 2. The common call is a no-op and must cost one query. The browser re-fetches its session
 *    on every cache miss, not only at sign-in, so the old unconditional
 *    transaction wrote a user row, a membership, and an activity log every few
 *    minutes per active session.
 */

type MembershipWithOrganization = OrganizationMembership & {
  organization: Organization;
};

export type ProvisionedContext = {
  user: User;
  access: UserAccess;
  /** Active memberships in active organizations, oldest first. */
  memberships: MembershipWithOrganization[];
};

type LoadedUser = User & {
  access: UserAccess[];
  memberships: MembershipWithOrganization[];
};

/**
 * A membership provisioning has to invent gets the lowest privilege there is,
 * never a role read off `users.role`. Inventing one is already a guess; an
 * administrator raises it deliberately from the staff screen.
 */
const PROVISIONED_MEMBERSHIP_ROLE = "viewer" as const;

const userGraph = {
  access: true,
  memberships: { include: { organization: true } }
} as const;

export async function ensureProvisionedUser(
  profile: SupabaseProfile
): Promise<ProvisionedContext> {
  const existing = await findUserForProfile(profile);

  if (!existing) {
    return provisionOwner(profile);
  }

  // Before any write. A deactivated account must not be able to reactivate
  // itself, and it must not get a repaired membership on the way out either.
  if (!existing.isActive) {
    throw new AccountDeactivatedError();
  }

  const context = await reconcile(existing, profile);

  if (context.memberships.length === 0) {
    throw new AccountDeactivatedError(
      "Your access to this organization has been removed. Ask your organization administrator to restore it."
    );
  }

  return context;
}

/**
 * Both lookups the old code did sequentially, in one round trip.
 *
 * The precedence is load-bearing and preserved exactly: a row already claimed
 * by this Supabase account wins over a row that merely shares the email
 * address. Doing it as a single `findFirst` with an OR would let the database
 * pick, which is only stable while no two rows can match.
 */
async function findUserForProfile(
  profile: SupabaseProfile
): Promise<LoadedUser | null> {
  const candidates = await prisma.user.findMany({
    where: {
      OR: [{ supabaseAuthId: profile.authUserId }, { email: profile.email }]
    },
    include: userGraph
  });

  return (
    candidates.find(
      (candidate) => candidate.supabaseAuthId === profile.authUserId
    ) ??
    candidates.find((candidate) => candidate.email === profile.email) ??
    null
  );
}

function activeMemberships(memberships: MembershipWithOrganization[]) {
  return memberships
    .filter(
      (membership) => membership.isActive && membership.organization.isActive
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function isNewSignIn(
  user: Pick<User, "lastSignInAt">,
  profile: SupabaseProfile
) {
  if (!profile.lastSignInAt) return false;
  if (!user.lastSignInAt) return true;

  return profile.lastSignInAt.getTime() > user.lastSignInAt.getTime();
}

/**
 * A tester organization is pinned to a paid state. Comparing before writing
 * keeps testers on the fast path too - the old code re-stamped
 * `subscriptionStartedAt` on every single sync.
 */
function needsTesterSubscription(organization: Organization | undefined) {
  if (!organization) return true;

  return (
    organization.subscriptionStatus !== "active" ||
    organization.trialStartedAt !== null ||
    organization.trialEndsAt !== null ||
    organization.subscriptionStartedAt === null
  );
}

/**
 * Bring an existing user's rows up to date - and only if any of them are
 * actually out of date.
 */
async function reconcile(
  existing: LoadedUser,
  profile: SupabaseProfile
): Promise<ProvisionedContext> {
  const primaryMembership = existing.memberships.find(
    (membership) => membership.organizationId === existing.organizationId
  );
  const primaryAccess = existing.access.find(
    (access) => access.organizationId === existing.organizationId
  );
  const signedIn = isNewSignIn(existing, profile);

  // Only fields Supabase actually supplied, and only when they differ. Invited
  // staff carry no auth metadata at all, so a plain `!==` against a null would
  // mark every one of them dirty forever and write on every sync.
  const userData: Prisma.UserUpdateInput = {
    ...(existing.supabaseAuthId !== profile.authUserId
      ? { supabaseAuthId: profile.authUserId }
      : {}),
    ...(profile.metadataName && profile.metadataName !== existing.name
      ? { name: profile.metadataName }
      : {}),
    ...(profile.phone && profile.phone !== existing.phone
      ? { phone: profile.phone }
      : {}),
    ...(profile.venueName && profile.venueName !== existing.venueName
      ? { venueName: profile.venueName }
      : {}),
    ...(signedIn ? { lastSignInAt: profile.lastSignInAt } : {})
  };

  // Absent rows get created. An inactive membership is left exactly as the
  // administrator left it - see rule 1 at the top of this file.
  //
  // There used to be a third branch here that repaired an active membership's
  // role from `users.role` whenever the two disagreed. That is what made the
  // global column dangerous: POST /api/staff wrote an invite's role onto the
  // shared user row, and this copied it back into the invitee's PRIMARY
  // organization at their next sign-in - so anyone able to create their own
  // tenant could invite their own address at "owner" and be promoted inside
  // somebody else's. A membership's role is now only ever what an administrator
  // of that organization set.
  const createMembership = !primaryMembership;
  const createAccess = !primaryAccess;
  const pinTesterSubscription =
    isTesterBypassEmail(profile.email) &&
    needsTesterSubscription(primaryMembership?.organization);

  const hasWork =
    Object.keys(userData).length > 0 ||
    createMembership ||
    createAccess ||
    pinTesterSubscription ||
    signedIn;

  // The overwhelmingly common case: one query, no transaction, no writes.
  // `primaryAccess` is necessarily present here - its absence sets
  // `createAccess`, which is part of `hasWork`.
  if (!hasWork && primaryAccess) {
    return {
      user: existing,
      access: primaryAccess,
      memberships: activeMemberships(existing.memberships)
    };
  }

  return prisma.$transaction(async (transaction) => {
    const user =
      Object.keys(userData).length > 0
        ? await transaction.user.update({
            where: { id: existing.id },
            data: userData
          })
        : existing;

    if (createMembership) {
      await transaction.organizationMembership.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          role: PROVISIONED_MEMBERSHIP_ROLE
        }
      });
    }

    if (pinTesterSubscription) {
      await transaction.organization.update({
        where: { id: user.organizationId },
        data: {
          subscriptionStatus: "active",
          trialStartedAt: null,
          trialEndsAt: null,
          subscriptionStartedAt: new Date()
        }
      });
    }

    // Seed access from the role on first sign-in only. Re-deriving it on every
    // login discarded any per-user permissions an administrator customized
    // through PATCH /api/staff. Role changes still update access there.
    const access =
      primaryAccess ??
      (await transaction.userAccess.findUnique({
        where: {
          organizationId_userId: {
            organizationId: user.organizationId,
            userId: user.id
          }
        }
      })) ??
      (await transaction.userAccess.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          ...accessForRole(PROVISIONED_MEMBERSHIP_ROLE)
        }
      }));

    if (signedIn) {
      await logSignIn(transaction, user);
    }

    return {
      user,
      access,
      memberships: await loadActiveMemberships(transaction, user.id)
    };
  });
}

/**
 * The one path that may create an organization from nothing.
 *
 * Everyone else has to exist already, which is what stops a stranger with a
 * valid Supabase account from minting themselves a tenant.
 */
async function provisionOwner(
  profile: SupabaseProfile
): Promise<ProvisionedContext> {
  if (!profile.isOwnerSignUp) {
    throw new InvitationRequiredError();
  }

  // Sign-up only collects an email and a password, so `venue_name` is absent
  // and this is a placeholder the owner replaces on /dashboard/new.
  // `onboardingCompletedAt` stays NULL until they do, which is what sends them
  // there. (Organizations created by the older trial form carried a real venue
  // name, hence the fallback.)
  const organizationName =
    profile.venueName ?? `${profile.name}'s Organization`;

  return prisma.$transaction(async (transaction) => {
    const organization = await transaction.organization.create({
      data: {
        name: organizationName,
        slug: createOrganizationSlug(organizationName, profile.authUserId),
        ...newOrganizationSubscription(profile.email)
      }
    });

    const user = await transaction.user.create({
      data: {
        organizationId: organization.id,
        supabaseAuthId: profile.authUserId,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        venueName: profile.venueName,
        role: "owner",
        // This branch is only reachable from the owner sign-up, which calls
        // supabase.auth.signUp with a password the user just chose.
        passwordSetAt: new Date(),
        lastSignInAt: profile.lastSignInAt
      }
    });

    await transaction.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: "owner"
      }
    });

    const access = await transaction.userAccess.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        ...accessForRole("owner")
      }
    });

    await logSignIn(transaction, user);

    return {
      user,
      access,
      memberships: await loadActiveMemberships(transaction, user.id)
    };
  });
}

function loadActiveMemberships(
  transaction: Prisma.TransactionClient,
  userId: string
) {
  return transaction.organizationMembership.findMany({
    where: {
      userId,
      isActive: true,
      organization: { isActive: true }
    },
    include: { organization: true },
    orderBy: { createdAt: "asc" }
  });
}

/**
 * Written once per Supabase session rather than once per sync. The browser
 * re-fetches its session whenever the five-minute cache lapses, so logging unconditionally
 * turned the audit trail into a heartbeat and made a genuine sign-in
 * indistinguishable from a page refresh.
 */
function logSignIn(transaction: Prisma.TransactionClient, user: User) {
  return createActivityLog(transaction, {
    organizationId: user.organizationId,
    userId: user.id,
    userName: user.name,
    actionType: "auth.login.success",
    message: `User signed in successfully as ${user.email}.`,
    newValue: {
      email: user.email,
      organizationId: user.organizationId
    }
  });
}
