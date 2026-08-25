import { AuthorizationError } from "@/lib/auth/errors";
import { isPermissionKey, type PermissionKey } from "@/lib/authz/catalog";

/**
 * The guardrails on every privilege write. All server-side, all with a
 * machine-readable code.
 *
 * Deliberately free of `server-only` and of Prisma: these are pure functions
 * over already-loaded facts, so the escalation suite can exercise every one of
 * them without a database.
 *
 * WHY SUBSET, NOT RANK
 * --------------------
 * Rank answers WHO MAY ACT ON WHOM. It cannot answer WHAT MAY BE HANDED OUT,
 * because the moment a tenant authors a custom role, rank stops implying
 * anything about content - an Event Manager at rank 300 could be given a role
 * containing `payment.refund` by anyone who outranks them, whether or not that
 * person holds it.
 *
 * The subset check is the only guard that survives custom roles, and it is why
 * `role.manage` exists as a key separate from `role.assign`.
 */

/** Lower outranks higher. A principal with no assignments outranks nobody. */
export const UNRANKED = Number.POSITIVE_INFINITY;

/**
 * Nothing grants more than the granter holds (INV-6).
 *
 * Every privilege write - creating a role, editing what one grants, assigning
 * one, writing an individual override - passes through here. An actor without
 * `payment.refund` is refused when creating OR assigning any role containing it.
 */
export function assertSubset(
  actorPermissions: ReadonlySet<PermissionKey>,
  granting: Iterable<PermissionKey>
): void {
  const excess = [...granting].filter((key) => !actorPermissions.has(key));

  if (excess.length === 0) return;

  throw new AuthorizationError(
    403,
    excess.length === 1
      ? `You cannot grant "${excess[0]}", because you do not hold it yourself.`
      : `You cannot grant ${excess.length} permissions you do not hold yourself.`,
    "amplification",
    { permissions: excess.sort() }
  );
}

/**
 * An actor may never act on, or hand out, a role at or above their own rank.
 *
 * STRICT, so equal rank denies. That is what makes it safe for two lateral peers
 * to share a rank number: neither supervises the other.
 */
export function assertRankCeiling(
  actorRank: number,
  targetRank: number,
  what: "assign" | "act"
): void {
  if (actorRank < targetRank) return;

  throw new AuthorizationError(
    403,
    what === "assign"
      ? "You cannot assign a role at or above your own."
      : "You cannot change someone at or above your own role.",
    "rank_ceiling",
    { actorRank, targetRank }
  );
}

/**
 * The actor may not be the subject of a privilege-increasing change.
 *
 * Covers privilege only. Nothing here stops anyone editing their own name or
 * phone number - that is `staff.update`, on a handler with no branch that can
 * reach a privilege table.
 */
export function assertNotSelfElevation(
  actorPrincipalId: string,
  subjectPrincipalId: string
): void {
  if (actorPrincipalId !== subjectPrincipalId) return;

  throw new AuthorizationError(
    403,
    "You cannot change your own permissions.",
    "self_elevation"
  );
}

/**
 * The organization must never be left with nobody who can hand out privileges.
 *
 * Checked against `role.manage` rather than against a role named "owner",
 * because there is no such thing as a role named owner as far as this code is
 * concerned (INV-1). A tenant that renames Owner to "Principal" is still covered.
 */
export function assertNotLastOwner(remainingRoleManagers: number): void {
  if (remainingRoleManagers > 0) return;

  throw new AuthorizationError(
    409,
    "That change would leave this organization with nobody able to manage roles.",
    "last_owner"
  );
}

/** A starter role's key is immutable and it cannot be deleted. Its grants are not. */
export function assertRoleMutable(
  role: { isSystem: boolean },
  change: "rename" | "delete"
): void {
  if (!role.isSystem) return;

  throw new AuthorizationError(
    409,
    change === "delete"
      ? "Starter roles cannot be deleted. Edit what this one grants instead, or remove everyone from it."
      : "A starter role's key cannot be changed. Its name, description and permissions can.",
    "system_role_immutable"
  );
}

export function assertRoleNotInUse(holderCount: number): void {
  if (holderCount === 0) return;

  throw new AuthorizationError(
    409,
    holderCount === 1
      ? "One person still holds this role. Reassign them first."
      : `${holderCount} people still hold this role. Reassign them first.`,
    "role_in_use",
    { holderCount }
  );
}

/**
 * Never 404-by-silence and never a 403 either: a valid id in another tenant
 * answers "not found", because existence is information.
 */
export function notFound(what: string): AuthorizationError {
  return new AuthorizationError(404, `${what} was not found.`, "not_found");
}

/**
 * A key not in the catalog is refused, never silently dropped. Dropping it means
 * an administrator ticks a box, sees it save, and finds it unticked next time -
 * with no message explaining which of the two views was lying.
 */
export function parsePermissionKeys(input: unknown): PermissionKey[] {
  if (!Array.isArray(input)) {
    throw new AuthorizationError(
      422,
      "permissions must be an array of permission keys.",
      "invalid_permission_key"
    );
  }

  const invalid = input.filter((key) => !isPermissionKey(key));

  if (invalid.length > 0) {
    throw new AuthorizationError(
      422,
      `Unknown permission ${invalid.length === 1 ? "key" : "keys"}: ${invalid
        .map((key) => JSON.stringify(key))
        .join(", ")}.`,
      "invalid_permission_key",
      { invalid }
    );
  }

  return [...new Set(input as PermissionKey[])];
}

/**
 * Optimistic concurrency, because the role editor is a checkbox grid.
 *
 * Two administrators with the same screen open will overwrite each other, and a
 * permissions matrix is precisely the screen where a silent lost update is
 * dangerous. Every mutating /api/access call carries the epoch it was composed
 * against, and a stale one is REFUSED rather than merged - the client refetches
 * and re-presents, because the user's intent may no longer apply.
 *
 * The header is `If-Match: "epoch:41"`. A request with no header is accepted:
 * server-to-server callers and the assignment dialog (which composes against one
 * principal, not the grid) have nothing to collide with.
 */
export function parseEpochPrecondition(request: Request): number | null {
  const header = request.headers.get("if-match");

  if (!header) return null;

  const match = /^(?:W\/)?"?epoch:(\d+)"?$/.exec(header.trim());

  if (!match) {
    throw new AuthorizationError(
      422,
      'If-Match must look like "epoch:41".',
      "invalid_permission_key"
    );
  }

  return Number(match[1]);
}

export function assertEpochCurrent(
  expected: number | null,
  currentEpoch: number
): void {
  if (expected === null || expected === currentEpoch) return;

  throw new AuthorizationError(
    409,
    "Someone else changed permissions while you were editing.",
    "epoch_stale",
    { currentEpoch }
  );
}
