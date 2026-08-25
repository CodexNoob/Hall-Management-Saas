import { AuthorizationError } from "@/lib/auth/errors";
import { normalizeStaffRole, type StaffRoleValue } from "@/lib/auth/permissions";
import { isAdministrativeRole, normalizeRole } from "@/lib/auth/roles";

/**
 * Who may act on whom, and who may hand out which role.
 *
 * `requirePermission` answers "may this caller edit staff at all". It cannot
 * answer "may this caller make themselves an owner", because `canEditStaff` is
 * a single boolean and the role being assigned arrives in the request body.
 * That gap is what let any holder of the permission PATCH their own id to
 * `owner`, and it is what these guards close.
 *
 * Deliberately free of `server-only`: the unit tests import this module
 * directly, and `server-only` throws under vitest.
 */

/**
 * Sparse on purpose. P1 seeds `Role.rank` from these numbers, and tenant-authored
 * roles have to interleave between the built-ins without renumbering them.
 *
 * `kitchen` and `billing` share a rank because they are lateral peers - neither
 * supervises the other. Every comparison below is strict, so an equal rank
 * denies, which is the behaviour that makes sharing a number safe.
 */
export const roleRank: Record<StaffRoleValue, number> = {
  owner: 0,
  admin: 10,
  manager: 20,
  kitchen: 30,
  billing: 30,
  viewer: 40
};

/**
 * The two normalizers in this codebase disagree, and the disagreement is
 * exploitable if it is not bridged here.
 *
 * `normalizeStaffRole` matches the unspaced `"superadmin"` only, so
 * `"Super Admin"` falls through to `viewer`. `isAdministrativeRole` strips all
 * punctuation before comparing, so it calls the same string administrative -
 * and `requirePermission` trusts *that* one. Ranking such a membership as
 * viewer would wave it past the permission gate and then deny every edit it
 * attempted, which reads as a broken product rather than a denied one.
 */
export function rankOfRole(role: string | null | undefined): number {
  const normalized = normalizeStaffRole(role);

  if (normalized === "viewer" && isAdministrativeRole(role)) {
    const stripped = normalizeRole(role);

    return stripped === "owner" || stripped === "superadmin"
      ? roleRank.owner
      : roleRank.admin;
  }

  return roleRank[normalized];
}

/** Strictly above. Equal rank never outranks - see `roleRank`. */
export function outranks(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined
) {
  return rankOfRole(actorRole) < rankOfRole(targetRole);
}

/**
 * An actor may never assign a role at or above their own rank.
 *
 * This makes Administrator owner-only until P4 introduces real role
 * management: `roleAccess.admin` is byte-identical to `roleAccess.owner`, so
 * letting an admin mint co-equal admins is most of a lateral takeover. If an
 * organization's only owner is a dormant sign-up account, creating the first
 * admin needs a direct database fix in the interim.
 */
export function assertAssignableRole(
  actorRole: string | null | undefined,
  nextRole: string | null | undefined
) {
  if (!outranks(actorRole, nextRole)) {
    throw new AuthorizationError(
      403,
      "You cannot assign a role at or above your own."
    );
  }
}

/** An actor may never act on a member at or above their own rank. */
export function assertCanManageMember(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined
) {
  if (!outranks(actorRole, targetRole)) {
    throw new AuthorizationError(
      403,
      "You cannot change a staff member at or above your own role."
    );
  }
}

/**
 * Covers role and status transitions only - it is not a general "owners are
 * unmanageable" rule, and nothing here stops an actor editing their own name
 * or phone number.
 */
export function assertNotSelfRoleChange(actorId: string, targetId: string) {
  if (actorId === targetId) {
    throw new AuthorizationError(403, "You cannot change your own role.");
  }
}
