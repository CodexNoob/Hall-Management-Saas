import type { Prisma } from "@prisma/client";
import { permissionKeys, type PermissionKey } from "@/lib/authz/catalog";
import { starterRoles } from "@/lib/authz/starter-roles";
import type { ScopeType } from "@/lib/authz/types";

/**
 * Materializing the starter set: what a brand-new organization arrives with, and
 * what `npm run db:seed-authorization` converges an existing one on.
 *
 * Free of `server-only` because the seed script imports it outside a Next.js
 * server context. Every function takes an explicit transaction client rather
 * than reaching for the singleton, so the caller decides the transaction
 * boundary - which matters, since every privilege write has to commit with its
 * audit row and its epoch bump or not at all (INV-7).
 */

type Client = Prisma.TransactionClient;

/**
 * Catalog key -> `permissions.id`.
 *
 * The catalog is global, so this is a handful of rows shared by every tenant.
 * Callers that write many roles resolve it once and pass it down.
 */
export async function permissionIdsByKey(
  client: Client
): Promise<Map<PermissionKey, string>> {
  const rows = await client.permission.findMany({
    where: { key: { in: [...permissionKeys] } },
    select: { id: true, key: true }
  });

  return new Map(
    rows.map((row) => [row.key as PermissionKey, row.id] as const)
  );
}

export type StarterRoleIds = Map<string, string>;

/**
 * Create any missing starter roles for one organization, and return every
 * starter role's id.
 *
 * IDEMPOTENT, AND CREATE-ONLY FOR PERMISSIONS. A role that already exists is
 * left exactly as the tenant left it - re-running the seed must never re-grant a
 * key an owner deliberately unticked, and must never hand an existing role a key
 * that was added to the catalog after they last looked. Both would be a
 * privilege change delivered by a deploy rather than by a person, which is the
 * one way a grant can appear with no audit row behind it.
 */
export async function ensureStarterRoles(
  client: Client,
  organizationId: string,
  permissionIds?: Map<PermissionKey, string>
): Promise<StarterRoleIds> {
  const existing = await client.role.findMany({
    where: {
      organizationId,
      key: { in: starterRoles.map((role) => role.key) }
    },
    select: { id: true, key: true }
  });

  const ids: StarterRoleIds = new Map(
    existing.map((role) => [role.key, role.id] as const)
  );
  const missing = starterRoles.filter((starter) => !ids.has(starter.key));

  // The overwhelmingly common call - an organization that already has its
  // starter set - costs one query and no writes. Resolving the catalog is left
  // until it is known to be needed, for the same reason.
  if (missing.length === 0) {
    return ids;
  }

  const catalog = permissionIds ?? (await permissionIdsByKey(client));

  // FOUR ROUND TRIPS, NOT TWELVE. This runs inside the sign-up transaction, and
  // a role-at-a-time loop made a new organization eleven sequential statements
  // against a remote database - about four seconds, against Prisma's five-second
  // interactive-transaction ceiling. Owner sign-up is not a place to leave that
  // little headroom: the failure is a rolled-back tenant and an account that can
  // never finish creating one.
  const created = await client.role.createManyAndReturn({
    data: missing.map((starter) => ({
      organizationId,
      key: starter.key,
      name: starter.name,
      description: starter.description,
      rank: starter.rank,
      isSystem: true
    })),
    select: { id: true, key: true }
  });

  for (const role of created) {
    ids.set(role.key, role.id);
  }

  const grants = missing.flatMap((starter) => {
    const roleId = ids.get(starter.key);
    if (!roleId) return [];

    return starter.permissions
      .map((key) => catalog.get(key))
      .filter((permissionId): permissionId is string => Boolean(permissionId))
      .map((permissionId) => ({ roleId, permissionId }));
  });

  // Guarded rather than assumed non-empty: a database whose catalog has not been
  // seeded yet resolves nothing, and that has to leave the roles in place for
  // the seed to fill rather than fail the sign-up that created them.
  if (grants.length > 0) {
    await client.rolePermission.createMany({
      data: grants,
      skipDuplicates: true
    });
  }

  return ids;
}

/**
 * A principal, for a membership that is about to be created.
 *
 * Returned rather than wired up here, so the caller can pass it straight into
 * the membership row it is already writing - a membership without a principal is
 * a seat that silently denies everything, so the two must be written together.
 */
export async function createUserPrincipal(
  client: Client,
  organizationId: string
): Promise<string> {
  const principal = await client.principal.create({
    data: { organizationId, kind: "user" },
    select: { id: true }
  });

  return principal.id;
}

export type AssignmentInput = {
  principalId: string;
  organizationId: string;
  roleId: string;
  /** 'org' stores the organization's own id - a CHECK constraint enforces it. */
  scopeType?: ScopeType;
  scopeId?: string;
  expiresAt?: Date | null;
  grantedBy?: string | null;
  source?: "manual" | "scim" | "idp_group";
};

/**
 * One assignment. Idempotent on (principal, role, scope), because re-assigning a
 * role somebody already holds at that scope is a no-op, not an error - the
 * button that does it is in a dialog people double-click.
 */
export async function assignRole(
  client: Client,
  input: AssignmentInput
): Promise<void> {
  const scopeType = input.scopeType ?? "org";
  const scopeId =
    scopeType === "org" ? input.organizationId : (input.scopeId as string);

  await client.principalRole.createMany({
    data: [
      {
        principalId: input.principalId,
        organizationId: input.organizationId,
        roleId: input.roleId,
        scopeType,
        scopeId,
        expiresAt: input.expiresAt ?? null,
        grantedBy: input.grantedBy ?? null,
        source: input.source ?? "manual"
      }
    ],
    skipDuplicates: true
  });
}

/**
 * Everything a new organization needs to be usable: the starter roles, and the
 * founding member holding one of them organization-wide.
 */
export async function provisionOrganizationAuthorization(
  client: Client,
  input: {
    organizationId: string;
    principalId: string;
    roleKey: string;
    grantedBy?: string | null;
  }
): Promise<void> {
  const roleIds = await ensureStarterRoles(client, input.organizationId);
  const roleId = roleIds.get(input.roleKey);

  if (!roleId) {
    // Unreachable unless the catalog and the starter set have drifted, which a
    // unit test fails the build over. Throwing beats assigning nothing, which
    // would silently produce an organization whose owner can do nothing.
    throw new Error(
      `Starter role "${input.roleKey}" was not materialized for organization ${input.organizationId}.`
    );
  }

  await assignRole(client, {
    principalId: input.principalId,
    organizationId: input.organizationId,
    roleId,
    grantedBy: input.grantedBy ?? null
  });
}
