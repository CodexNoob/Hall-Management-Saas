import type { PermissionKey } from "@/lib/authz/catalog";

/**
 * The verdict contract.
 *
 * A verdict is never a bare boolean (INV-3). It is `{ allow, scope }`, and the
 * scope is a filter the query layer applies. A caller that has to reconstruct
 * "which halls" from the verdict will get it wrong in at least one of the eight
 * places it has to do it - which is exactly what `allowedHallIds` did before
 * this existed.
 *
 * Kept free of Prisma and of `server-only` so the browser hint layer can import
 * `ScopeFilter` without pulling the resolver in behind it.
 */

/**
 * A tenant-scoped subject that a human membership or a machine account points
 * at. Grants attach here rather than to a person's membership, so revocation,
 * expiry, scope and audit are written once instead of once per kind of caller.
 */
export type PrincipalRef =
  | { kind: "user"; userId: string }
  | { kind: "service"; serviceAccountId: string };

/**
 * The two scope dimensions. Both are existing models with real ids, so a scope
 * is a foreign key rather than a string convention.
 *
 * Adding a third is the one genuinely structural change left in this design: a
 * CHECK constraint, a `scoped()` branch, and a join in the resolver.
 */
export const SCOPE_DIMENSIONS = ["hall", "event_type"] as const;
export type ScopeDimension = (typeof SCOPE_DIMENSIONS)[number];

/** `'org'` means everything in the tenant. */
export const SCOPE_TYPES = ["org", ...SCOPE_DIMENSIONS] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

/**
 * `"all"` is not the same as an empty array. `"all"` means the dimension does
 * not narrow anything; `[]` means the principal was scoped to nothing, and a
 * query filtered by it must return no rows.
 *
 * That distinction is why this is a union rather than a `string[]` where empty
 * happens to mean unrestricted - the old `allowedHallIds` used the second
 * convention and every one of its eight readers had to remember it.
 */
export type ScopeFilter = {
  hallIds: string[] | "all";
  eventTypeIds: string[] | "all";
};

export const UNSCOPED: ScopeFilter = {
  hallIds: "all",
  eventTypeIds: "all"
};

export type DenialReason =
  /** The principal or its user account is switched off. */
  | "inactive"
  /** No active membership of this organization. */
  | "no-membership"
  /** The organization's plan does not include the feature this key belongs to. */
  | "not-entitled"
  /** Nothing grants this key - or a DENY override takes it away. */
  | "no-permission"
  /** The only assignment that carried this key has lapsed. */
  | "expired";

export type Decision =
  | { allow: true; scope: ScopeFilter }
  | { allow: false; reason: DenialReason };

export type DecisionInput = {
  principal: PrincipalRef;
  organizationId: string;
  permission: PermissionKey;
};

/**
 * Every key the principal effectively holds, each with the scope that the
 * assignments carrying THAT key resolve to.
 *
 * Scope resolves per permission, not per principal, and this map is the shape
 * that makes the distinction impossible to lose. Someone who is Kitchen Staff at
 * Hall A and Viewer organization-wide has `kitchen.status.update` scoped to Hall
 * A and `event.read` scoped to everything. The naive implementation unions every
 * assignment's scope once and applies it to every question, silently widening
 * the narrow permission - and it passes every test that only checks allow/deny.
 */
export type EffectivePermissions = ReadonlyMap<PermissionKey, ScopeFilter>;

export function scopeDimensionKey(
  dimension: ScopeDimension
): keyof ScopeFilter {
  return dimension === "hall" ? "hallIds" : "eventTypeIds";
}
