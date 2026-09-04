import "server-only";

import type {
  Prisma,
  Organization,
  OrganizationMembership,
  User
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MEMBERSHIP_ROLE_KEY,
  FOUNDING_OWNER_ROLE_KEY
} from "@/lib/authz/starter-roles";
import {
  createUserPrincipal,
  provisionOrganizationAuthorization
} from "@/lib/authz/provision";
import { createOrganizationSlug } from "@/lib/auth/organization-slug";
import { createActivityLog } from "@/lib/audit/activity-log";
import {
  isTesterBypassEmail,
  newOrganizationSubscription
} from "@/lib/subscription/trial";
import {
  AccountDeactivatedError,
  BetaAccessPendingError,
  BetaAccessRejectedError,
  InvitationRequiredError
} from "@/lib/auth/errors";
import { recordAndNotifyBetaAccessRequest } from "@/features/beta-access/server/beta-access";
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

/**
 * Room for a remote database, rather than Prisma's five-second default.
 *
 * Provisioning an owner writes an organization, a user, a principal, a
 * membership, the five starter roles with their grants, the founding assignment
 * and a sign-in log - and every one of those is a round trip to a Supabase
 * instance that is not in the same building. The work was batched down to about
 * ten statements in lib/authz/provision.ts, which is comfortably inside five
 * seconds on a good connection and not on a bad one. Timing out here rolls back
 * a whole tenant, so the ceiling is set where a slow network costs latency
 * instead of an account that can never finish being created.
 */
const PROVISIONING_TRANSACTION = { maxWait: 10_000, timeout: 20_000 } as const;

export type ProvisionedContext = {
  user: User;
  /** Active memberships in active organizations, oldest first. */
  memberships: MembershipWithOrganization[];
};

type LoadedUser = User & {
  memberships: MembershipWithOrganization[];
};

const userGraph = {
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
  // There used to be a branch here that repaired an active membership's role
  // from `users.role` whenever the two disagreed. That is what made the global
  // column dangerous: POST /api/staff wrote an invite's role onto the shared
  // user row, and this copied it back into the invitee's PRIMARY organization at
  // their next sign-in - so anyone able to create their own tenant could invite
  // their own address at "owner" and be promoted inside somebody else's. The
  // column no longer exists, and what anyone may do is `principal_roles`.
  const createMembership = !primaryMembership;
  const pinTesterSubscription =
    isTesterBypassEmail(profile.email) &&
    needsTesterSubscription(primaryMembership?.organization);

  const hasWork =
    Object.keys(userData).length > 0 ||
    createMembership ||
    pinTesterSubscription ||
    signedIn;

  // The overwhelmingly common case: one query, no transaction, no writes.
  if (!hasWork) {
    return {
      user: existing,
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
      // The principal and the membership are written together, because a
      // membership without a principal is a seat that silently denies
      // everything. The starter roles are materialized here too: an
      // organization that predates the RBAC migration and has never been seeded
      // would otherwise have nothing to assign.
      const principalId = await createUserPrincipal(
        transaction,
        user.organizationId
      );

      await transaction.organizationMembership.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          principalId
        }
      });

      // A membership provisioning has to invent gets the lowest privilege there
      // is. Inventing one is already a guess; an administrator raises it
      // deliberately from the access screen.
      await provisionOrganizationAuthorization(transaction, {
        organizationId: user.organizationId,
        principalId,
        roleKey: DEFAULT_MEMBERSHIP_ROLE_KEY
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

    if (signedIn) {
      await logSignIn(transaction, user);
    }

    return {
      user,
      memberships: await loadActiveMemberships(transaction, user.id)
    };
  }, PROVISIONING_TRANSACTION);
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

  /*
   * THE BETA GATE.
   *
   * Here rather than in the proxy, a layout or each route, because this
   * function is the only code in the application that may create an
   * organization from nothing - and everything else needs a `users` row that
   * only this function writes. So one refusal closes every door at once: the
   * confirmation link, password sign-in, the Google button, a typed dashboard
   * URL, and a direct API call carrying a perfectly valid Supabase JWT (which
   * `resolveUserActor` refuses with "User account is not provisioned").
   *
   * IT IS ALSO WHERE THE REQUEST IS RECORDED, and the only place. Reaching
   * here needs a session, so the queue holds only addresses somebody has
   * actually confirmed - by opening the link, or through Google, which verifies
   * the address itself. The sign-up form used to post /api/beta-access/requests
   * at the moment of registration, which announced an address to the approval
   * inbox before anyone had proven they could read mail at it. Recording here
   * means a request exists for every identity that ever reached this point, by
   * whatever route, and for no address that never got this far.
   *
   * INVITED STAFF NEVER ARRIVE HERE. POST /api/staff writes their `users` row
   * at invite time, so `findUserForProfile` matches them and `reconcile` runs
   * instead. That is what leaves the invitation flow untouched by all of this.
   */
  const betaAccess = await recordAndNotifyBetaAccessRequest({
    email: profile.email,
    supabaseAuthId: profile.authUserId,
    signupMethod: profile.providers.includes("google")
      ? "google"
      : "email_password"
  });

  if (betaAccess.status === "REJECTED") {
    throw new BetaAccessRejectedError();
  }

  if (betaAccess.status !== "APPROVED") {
    throw new BetaAccessPendingError();
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
        // Only when a password is part of this account at all. The email
        // sign-up calls supabase.auth.signUp with one the owner just chose; a
        // Google sign-up has none, and stamping it there would tell the security
        // panel a password exists that its owner could never have set - and that
        // /set-password had already been completed.
        passwordSetAt: profile.usesEmailPassword ? new Date() : null,
        lastSignInAt: profile.lastSignInAt
      }
    });

    const principalId = await createUserPrincipal(transaction, organization.id);

    await transaction.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        principalId
      }
    });

    // The starter five, and the founder holding the top one organization-wide.
    // Without this the sign-up completes and the new owner can do nothing at
    // all - deny by default is right, but not before anyone has had a chance to
    // grant anything.
    await provisionOrganizationAuthorization(transaction, {
      organizationId: organization.id,
      principalId,
      roleKey: FOUNDING_OWNER_ROLE_KEY
    });

    await logSignIn(transaction, user);

    return {
      user,
      memberships: await loadActiveMemberships(transaction, user.id)
    };
  }, PROVISIONING_TRANSACTION);
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
