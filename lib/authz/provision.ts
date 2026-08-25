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
  const catalog = permissionIds ?? (await permissionIdsByKey(client));

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

  for (const starter of starterRoles) {
    if (ids.has(starter.key)) continue;

    const created = await client.role.create({
      data: {
        organizationId,
        key: starter.key,
        name: starter.name,
        description: starter.description,
        rank: starter.rank,
        isSystem: true
      },
      select: { id: true }
    });

    await client.rolePermission.createMany({
      data: starter.permissions
        .map((key) => catalog.get(key))
        .filter((permissionId): permissionId is string => Boolean(permissionId))
        .map((permissionId) => ({ roleId: created.id, permissionId })),
      skipDuplicates: true
    });

    ids.set(starter.key, created.id);
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
