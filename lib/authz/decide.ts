import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPermissionKey, type PermissionKey } from "@/lib/authz/catalog";
import { isEntitled } from "@/lib/authz/entitlement";
import {
  UNSCOPED,
  type Decision,
  type DecisionInput,
  type DenialReason,
  type PrincipalRef,
  type ScopeFilter,
  type ScopeType
} from "@/lib/authz/types";

/**
 * THE ONLY MODULE IN THE CODEBASE THAT READS THE PRIVILEGE TABLES (INV-2).
 *
 * `principals`, `principal_roles`, `principal_permissions` and
 * `role_permissions` are touched here and in `lib/authz/admin/*` (which writes
 * them) and nowhere else. There is no second decision path, no "administrator
 * shortcut", and no per-route re-derivation - those are how an authorization
 * system acquires a hole that no single file review can find.
 *
 * tests/unit/authz-single-reader.test.ts is the control.
 */

// ---------------------------------------------------------------------------
// Scope arithmetic
// ---------------------------------------------------------------------------

/**
 * The scope one assignment contributes.
 *
 * An assignment scoped to a hall does NOT narrow event types, and vice versa -
 * it narrows its own dimension and leaves the other alone. That is what makes
 * assignments union rather than intersect, and it is the reason "kitchen at Hall
 * A, but only for school events" is not expressible: it would need two
 * dimensions on one row, which is the deferred `principal_role_scopes` seam.
 */
function scopeOfAssignment(scopeType: ScopeType, scopeId: string): ScopeFilter {
  if (scopeType === "hall") {
    return { hallIds: [scopeId], eventTypeIds: "all" };
  }

  if (scopeType === "event_type") {
    return { hallIds: "all", eventTypeIds: [scopeId] };
  }

  return UNSCOPED;
}

function unionDimension(
  left: string[] | "all",
  right: string[] | "all"
): string[] | "all" {
  // Any org-scoped contributor collapses the dimension to "all". Union, not
  // intersection: two Kitchen Staff rows at Hall A and Hall B means both halls.
  if (left === "all" || right === "all") return "all";

  return [...new Set([...left, ...right])];
}

export function unionScope(left: ScopeFilter, right: ScopeFilter): ScopeFilter {
  return {
    hallIds: unionDimension(left.hallIds, right.hallIds),
    eventTypeIds: unionDimension(left.eventTypeIds, right.eventTypeIds)
  };
}

// ---------------------------------------------------------------------------
// The effective set
// ---------------------------------------------------------------------------

export type EffectiveAccess = {
  /**
   * Every key the principal holds, each mapped to the scope that the assignments
   * carrying THAT key resolve to.
   *
   * SCOPE RESOLVES PER PERMISSION, NOT PER PRINCIPAL, and this is the subtle
   * part - get it wrong and it is invisible. Someone who is Kitchen Staff at
   * Hall A and Viewer organization-wide has `kitchen.status.update` scoped to
   * Hall A and `event.read` scoped to everything, because the union is taken
   * over the assignments that actually granted the key being asked about, not
   * over all of the principal's assignments.
   *
   * The naive implementation unions every assignment's scope once and applies it
   * to every question, silently widening the narrow permission to the union of
   * both. It passes every test that only checks allow/deny.
   */
  permissions: ReadonlyMap<PermissionKey, ScopeFilter>;
  /** Keys removed by a DENY override. Kept for provenance, not for deciding. */
  denied: ReadonlySet<PermissionKey>;
  /** Keys whose only carrier has lapsed. Distinguishes `expired` from `no-permission`. */
  expired: ReadonlySet<PermissionKey>;
  /** Keys added by a GRANT override. Provenance for the "why can they do that?" screen. */
  overridden: ReadonlySet<PermissionKey>;
};

const EMPTY_ACCESS: EffectiveAccess = {
  permissions: new Map(),
  denied: new Set(),
  expired: new Set(),
  overridden: new Set()
};

type PrivilegeClient = Pick<
  Prisma.TransactionClient,
  "principalRole" | "principalPermission"
>;

/**
 * The resolver query, and the fold that turns rows into a verdict.
 *
 * Two selects rather than one hand-written union: they are issued concurrently,
 * so the cost is one round trip's latency, and each stays legible enough that a
 * schema change cannot silently invalidate it the way a raw string would.
 *
 * `client` exists so a privilege WRITE can resolve the actor's own effective set
 * inside its own transaction, uncached. The subset check (INV-6) has to read
 * what is true at commit time, not what was true when the cache was filled.
 */
export async function loadEffectiveAccess(
  principalId: string,
  organizationId: string,
  client: PrivilegeClient = prisma,
  now: Date = new Date()
): Promise<EffectiveAccess> {
  const [assignments, overrides] = await Promise.all([
    client.principalRole.findMany({
      where: { principalId, organizationId },
      select: {
        scopeType: true,
        scopeId: true,
        expiresAt: true,
        role: {
          select: {
            rolePermissions: {
              select: { permission: { select: { key: true } } }
            }
          }
        }
      }
    }),
    client.principalPermission.findMany({
      where: { principalId, organizationId },
      select: { effect: true, permission: { select: { key: true } } }
    })
  ]);

  const permissions = new Map<PermissionKey, ScopeFilter>();
  const expired = new Set<PermissionKey>();
  const denied = new Set<PermissionKey>();
  const overridden = new Set<PermissionKey>();

  for (const assignment of assignments) {
    // Expiry is evaluated HERE rather than by a sweep job, so a lapsed
    // assignment stops granting at the moment it lapses even if nothing has
    // cleaned it up. That is the whole of time-boxed elevation.
    const live = !assignment.expiresAt || assignment.expiresAt > now;
    const contributed = scopeOfAssignment(
      assignment.scopeType as ScopeType,
      assignment.scopeId
    );

    for (const rolePermission of assignment.role.rolePermissions) {
      const key = rolePermission.permission.key;

      // A row whose key has no union member is unreachable by any call site.
      // Skipping it is the safe direction, and a catalog test fails the build
      // long before this can matter in production.
      if (!isPermissionKey(key)) continue;

      if (!live) {
        expired.add(key);
        continue;
      }

      const existing = permissions.get(key);
      permissions.set(
        key,
        existing ? unionScope(existing, contributed) : contributed
      );
    }
  }

  // Overrides are ORG-SCOPED. A scoped individual grant is a role of one, and
  // roles are already that mechanism.
  for (const override of overrides) {
    const key = override.permission.key;
    if (!isPermissionKey(key) || override.effect !== "GRANT") continue;

    overridden.add(key);
    expired.delete(key);
    permissions.set(key, UNSCOPED);
  }

  // DENY IS APPLIED LAST AND NOTHING OVERRIDES IT (INV-4). No priorities, no
  // specificity rules, no "most specific wins" - those are how policy engines
  // become unreadable. A principal holding Owner plus a DENY on payment.refund
  // is refused payment.refund.
  for (const override of overrides) {
    const key = override.permission.key;
    if (!isPermissionKey(key) || override.effect !== "DENY") continue;

    denied.add(key);
    overridden.delete(key);
    expired.delete(key);
    permissions.delete(key);
  }

  return { permissions, denied, expired, overridden };
}

/**
 * Everyone in one organization who holds one key. The inverse question.
 *
 * Two things need it, and both would otherwise be answered by a role name:
 *
 *   * "Who is eligible to be a kitchen worker?" - which is not "who has the
 *     Kitchen Staff role" but "who may advance production status", and stays
 *     correct for a tenant who invented a Head Chef role (INV-1).
 *   * "Would this change leave nobody able to manage roles?" - the last-owner
 *     guard, asked against `role.manage` rather than against a role called
 *     Owner.
 *
 * Same three-part semantics as `loadEffectiveAccess`: live assignments, plus
 * GRANT overrides, minus DENY overrides applied last (INV-4). Deliberately NOT
 * cached - both callers are on write paths that need what is true right now.
 */
export async function principalIdsHolding(
  organizationId: string,
  permission: PermissionKey,
  client: PrivilegeClient = prisma,
  now: Date = new Date()
): Promise<Set<string>> {
  const [assigned, overrides] = await Promise.all([
    client.principalRole.findMany({
      where: {
        organizationId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        role: {
          rolePermissions: { some: { permission: { key: permission } } }
        }
      },
      select: { principalId: true }
    }),
    client.principalPermission.findMany({
      where: { organizationId, permission: { key: permission } },
      select: { principalId: true, effect: true }
    })
  ]);

  const holders = new Set(assigned.map((row) => row.principalId));

  for (const override of overrides) {
    if (override.effect === "GRANT") holders.add(override.principalId);
  }

  for (const override of overrides) {
    if (override.effect === "DENY") holders.delete(override.principalId);
  }

  return holders;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * Process-local, keyed on (principalId, organizationId, permissionsEpoch).
 *
 * Because the epoch is part of the key, a privilege edit invalidates every
 * cached decision instantly: the next lookup composes a key nothing has ever
 * written. No TTL, no cross-instance invalidation protocol, no stale window to
 * reason about - and the epoch is bumped by a database trigger, so no write path
 * can forget to do it.
 *
 * Entries for superseded epochs are unreachable rather than deleted, so the map
 * is bounded by eviction rather than by invalidation.
 */
const MAX_CACHE_ENTRIES = 2_000;

const accessCache = new Map<string, EffectiveAccess>();
const inFlight = new Map<string, Promise<EffectiveAccess>>();

function cacheKey(principalId: string, organizationId: string, epoch: bigint) {
  return `${principalId}:${organizationId}:${epoch}`;
}

function readCache(key: string): EffectiveAccess | undefined {
  const hit = accessCache.get(key);

  if (hit) {
    // Re-insert to mark recently used - Map iterates in insertion order, which
    // is all the LRU this needs.
    accessCache.delete(key);
    accessCache.set(key, hit);
  }

  return hit;
}

function writeCache(key: string, value: EffectiveAccess) {
  accessCache.set(key, value);

  while (accessCache.size > MAX_CACHE_ENTRIES) {
    const oldest = accessCache.keys().next();
    if (oldest.done) break;
    accessCache.delete(oldest.value);
  }
}

/** Exported for tests and for the seed, which rewrites rows behind the cache. */
export function clearAccessCache() {
  accessCache.clear();
  inFlight.clear();
}

/**
 * Cached, with in-flight coalescing: a burst of parallel route handlers on one
 * request issues one query between them rather than one each.
 */
export function effectiveAccessByPrincipal(
  principalId: string,
  organizationId: string,
  epoch: bigint
): Promise<EffectiveAccess> {
  const key = cacheKey(principalId, organizationId, epoch);
  const hit = readCache(key);

  if (hit) return Promise.resolve(hit);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = loadEffectiveAccess(principalId, organizationId)
    .then((access) => {
      writeCache(key, access);
      return access;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);

  return promise;
}

// ---------------------------------------------------------------------------
// Principal resolution
// ---------------------------------------------------------------------------

export type ResolvedPrincipal = {
  principalId: string;
  organizationId: string;
  /** Present for human callers; absent for service accounts. */
  userId: string | null;
  /** Present for human callers; absent for service accounts. */
  userEmail: string | null;
  /** The display name the audit trail snapshots. */
  displayName: string;
  permissionsEpoch: bigint;
  organization: {
    id: string;
    name: string;
    slug: string;
    subscriptionPlan: string | null;
    subscriptionStatus: string;
  };
};

type PrincipalResolution =
  | { ok: true; principal: ResolvedPrincipal }
  | { ok: false; reason: DenialReason };

/**
 * Gates 1 and 2 of the five, in one query.
 *
 * These are deliberately NOT cached. `is_active` on either side is a kill
 * switch, and a kill switch that takes effect on the next cache epoch is not a
 * kill switch. The permission MAP is what gets cached; who is asking is
 * re-established every time.
 */
export async function resolvePrincipal(
  principal: PrincipalRef,
  organizationId: string,
  now: Date = new Date()
): Promise<PrincipalResolution> {
  if (principal.kind === "user") {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: principal.userId }
      },
      select: {
        isActive: true,
        principalId: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            permissionsEpoch: true
          }
        },
        principal: { select: { isActive: true } },
        user: {
          select: { id: true, name: true, email: true, isActive: true }
        }
      }
    });

    if (!membership) return { ok: false, reason: "no-membership" };

    if (!membership.user.isActive || !membership.principal.isActive) {
      return { ok: false, reason: "inactive" };
    }

    if (!membership.isActive || !membership.organization.isActive) {
      return { ok: false, reason: "no-membership" };
    }

    return {
      ok: true,
      principal: {
        principalId: membership.principalId,
        organizationId: membership.organization.id,
        userId: membership.user.id,
        userEmail: membership.user.email,
        displayName: membership.user.name,
        permissionsEpoch: membership.organization.permissionsEpoch,
        organization: {
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
          subscriptionPlan: membership.organization.subscriptionPlan,
          subscriptionStatus: membership.organization.subscriptionStatus
        }
      }
    };
  }

  const account = await prisma.serviceAccount.findUnique({
    where: { id: principal.serviceAccountId },
    select: {
      name: true,
      expiresAt: true,
      principalId: true,
      organizationId: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          permissionsEpoch: true
        }
      },
      principal: { select: { isActive: true } }
    }
  });

  // A valid token for another tenant reads as "no membership here", never as a
  // hint that the account exists somewhere - existence is information.
  if (!account || account.organizationId !== organizationId) {
    return { ok: false, reason: "no-membership" };
  }

  if (!account.principal.isActive) return { ok: false, reason: "inactive" };

  if (account.expiresAt && account.expiresAt <= now) {
    return { ok: false, reason: "expired" };
  }

  if (!account.organization.isActive) {
    return { ok: false, reason: "no-membership" };
  }

  return {
    ok: true,
    principal: {
      principalId: account.principalId,
      organizationId: account.organization.id,
      userId: null,
      userEmail: null,
      displayName: account.name,
      permissionsEpoch: account.organization.permissionsEpoch,
      organization: {
        id: account.organization.id,
        name: account.organization.name,
        slug: account.organization.slug,
        subscriptionPlan: account.organization.subscriptionPlan,
        subscriptionStatus: account.organization.subscriptionStatus
      }
    }
  };
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

/**
 * Five gates. The first four can deny; the fifth only narrows.
 *
 *   1. The principal exists and is active            -> else `inactive`
 *   2. It belongs here and the membership is active  -> else `no-membership`
 *   3. The plan includes the feature the key is in   -> else `not-entitled`
 *   4. The effective set carries the key             -> else `no-permission`
 *   5. Scope = union of the scopes of the assignments that carried THIS key
 *
 * That asymmetry is why the verdict is a record rather than a boolean: the scope
 * stage produces information no boolean can carry (INV-3).
 *
 * Deny by default. Every path that is not an explicit allow returns a denial,
 * and an unexpected error throws rather than falling through to allow.
 */
export async function decide(input: DecisionInput): Promise<Decision> {
  const resolution = await resolvePrincipal(
    input.principal,
    input.organizationId
  );

  if (!resolution.ok) return { allow: false, reason: resolution.reason };

  return decideForPrincipal(resolution.principal, input.permission);
}

/**
 * The half of `decide` that runs once the caller is already known.
 *
 * `authorize()` resolves the principal itself - it needs the user row and the
 * organization for the request context regardless - so it calls this rather than
 * paying for the same query twice.
 */
export async function decideForPrincipal(
  principal: ResolvedPrincipal,
  permission: PermissionKey
): Promise<Decision> {
  if (!isEntitled(principal.organization, permission)) {
    return { allow: false, reason: "not-entitled" };
  }

  const access = await effectiveAccessByPrincipal(
    principal.principalId,
    principal.organizationId,
    principal.permissionsEpoch
  );

  const scope = access.permissions.get(permission);

  if (scope) return { allow: true, scope };

  // A DENY override and a key nobody ever granted are both `no-permission`. The
  // distinction is provenance, not authorization, and it belongs on the
  // effective-permissions screen rather than in a status code that leaks which
  // of the two it was.
  if (access.expired.has(permission) && !access.denied.has(permission)) {
    return { allow: false, reason: "expired" };
  }

  return { allow: false, reason: "no-permission" };
}

/**
 * The whole effective set for one principal, for the session response and the
 * "why can they do that?" screen. Same cache, same rows, same fold - so what the
 * browser is told and what the server enforces cannot disagree.
 */
export async function effectiveAccessFor(
  principal: ResolvedPrincipal
): Promise<EffectiveAccess> {
  return effectiveAccessByPrincipal(
    principal.principalId,
    principal.organizationId,
    principal.permissionsEpoch
  );
}

export { EMPTY_ACCESS };
