import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth/errors";
import type { AuthzContext } from "@/lib/authz/authorize";
import type { PermissionKey } from "@/lib/authz/catalog";
import { principalIdsHolding } from "@/lib/authz/decide";
import {
  assertEpochCurrent,
  assertNotLastOwner,
  assertRankCeiling,
  assertRoleMutable,
  assertRoleNotInUse,
  assertSubset,
  notFound
} from "@/lib/authz/guards";
import { loadActorFacts } from "@/lib/authz/admin/context";
import { diffPermissionSets, writeAudit } from "@/lib/authz/admin/audit";

/**
 * Authoring roles. Everything a tenant needs to make "add a role" an INSERT.
 *
 * Every function here takes the epoch the caller composed against and refuses a
 * stale one rather than merging it: two administrators with the same checkbox
 * grid open WILL overwrite each other, and a permissions matrix is precisely the
 * screen where a silent lost update is dangerous.
 */

export type RoleSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  rank: number;
  isSystem: boolean;
  permissions: PermissionKey[];
  /** So the UI can warn before a delete, and grey out the ones in use. */
  holderCount: number;
};

function toSummary(role: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  rank: number;
  isSystem: boolean;
  rolePermissions: Array<{ permission: { key: string } }>;
  _count: { principalRoles: number };
}): RoleSummary {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    rank: role.rank,
    isSystem: role.isSystem,
    permissions: role.rolePermissions
      .map((rolePermission) => rolePermission.permission.key as PermissionKey)
      .sort(),
    holderCount: role._count.principalRoles
  };
}

const ROLE_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  rank: true,
  isSystem: true,
  rolePermissions: { select: { permission: { select: { key: true } } } },
  _count: { select: { principalRoles: true } }
} as const;

export async function listRoles(actor: AuthzContext): Promise<RoleSummary[]> {
  const roles = await prisma.role.findMany({
    where: { organizationId: actor.organizationId },
    select: ROLE_SELECT,
    orderBy: [{ rank: "asc" }, { name: "asc" }]
  });

  return roles.map(toSummary);
}

/**
 * A role key, derived from its name when the caller does not supply one.
 *
 * Keys are stable identity within a tenant and nothing in application code ever
 * branches on one, so they exist for humans reading an audit row and for the
 * seed to find its own rows again.
 */
export function slugifyRoleKey(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "role"
  );
}

export type CreateRoleInput = {
  key?: string;
  name: string;
  description?: string | null;
  rank: number;
  permissions: PermissionKey[];
  expectedEpoch: number | null;
};

export async function createRole(
  actor: AuthzContext,
  input: CreateRoleInput
): Promise<RoleSummary> {
  return prisma.$transaction(async (transaction) => {
    const facts = await loadActorFacts(transaction, actor);

    await assertEpochAgainstOrganization(
      transaction,
      actor.organizationId,
      input.expectedEpoch
    );

    // A role nobody may hold is one thing; a role that hands out more than its
    // author holds is an escalation dressed as a feature (INV-6).
    assertSubset(facts.permissions, input.permissions);
    // And a role that outranks its author is a takeover on a two-minute delay.
    assertRankCeiling(facts.rank, input.rank, "assign");

    const key = input.key?.trim() || slugifyRoleKey(input.name);

    const existing = await transaction.role.findUnique({
      where: { organizationId_key: { organizationId: actor.organizationId, key } },
      select: { id: true }
    });

    if (existing) {
      throw new AuthorizationError(
        409,
        `A role keyed "${key}" already exists here. Pick a different name.`,
        "role_in_use"
      );
    }

    const created = await transaction.role.create({
      data: {
        organizationId: actor.organizationId,
        key,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        rank: input.rank,
        isSystem: false
      },
      select: { id: true }
    });

    await writeRolePermissions(
      transaction,
      created.id,
      input.permissions
    );

    await writeAudit(transaction, facts, {
      action: "role.created",
      detail: {
        roleId: created.id,
        key,
        name: input.name.trim(),
        rank: input.rank,
        permissions: [...input.permissions].sort()
      }
    });

    return loadRoleOrThrow(transaction, created.id, actor.organizationId);
  });
}

export type UpdateRoleInput = {
  name?: string;
  description?: string | null;
  rank?: number;
  /** Replaces the whole set. Idempotent, and the DIFF is what the audit records. */
  permissions?: PermissionKey[];
  expectedEpoch: number | null;
};

export async function updateRole(
  actor: AuthzContext,
  roleId: string,
  input: UpdateRoleInput
): Promise<RoleSummary> {
  return prisma.$transaction(async (transaction) => {
    const facts = await loadActorFacts(transaction, actor);

    await assertEpochAgainstOrganization(
      transaction,
      actor.organizationId,
      input.expectedEpoch
    );

    const role = await transaction.role.findFirst({
      // Scoped to the tenant, so an id from another organization is a 404 rather
      // than a 403 - existence is information.
      where: { id: roleId, organizationId: actor.organizationId },
      select: {
        id: true,
        rank: true,
        isSystem: true,
        rolePermissions: { select: { permission: { select: { key: true } } } }
      }
    });

    if (!role) throw notFound("That role");

    // Acting on a role at or above your own rank is acting above your station,
    // whether or not the edit itself would grant you anything.
    assertRankCeiling(facts.rank, role.rank, "act");

    if (input.rank !== undefined && input.rank !== role.rank) {
      assertRankCeiling(facts.rank, input.rank, "assign");
    }

    const before = role.rolePermissions.map(
      (rolePermission) => rolePermission.permission.key
    );

    if (input.permissions) {
      // Only the ADDITIONS are checked against the actor's own set. Taking a key
      // away from a role is always allowed - you may not need to hold something
      // in order to stop handing it out, and requiring it would strand a role
      // whose author has since lost one of its keys.
      const { added, removed } = diffPermissionSets(before, input.permissions);
      assertSubset(facts.permissions, added as PermissionKey[]);

      await writeRolePermissions(
        transaction,
        role.id,
        input.permissions
      );

      // Removing `role.manage` from the last role that carries it would leave
      // nobody able to hand out privileges, with no way back short of SQL.
      if (removed.includes("role.manage")) {
        await assertRoleManagersRemain(transaction, actor.organizationId);
      }
    }

    await transaction.role.update({
      where: { id: role.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.rank !== undefined ? { rank: input.rank } : {})
      }
    });

    await writeAudit(transaction, facts, {
      action: "role.updated",
      detail: {
        roleId: role.id,
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.rank !== undefined ? { rank: input.rank } : {}),
        ...(input.permissions
          ? diffPermissionSets(before, input.permissions)
          : {})
      }
    });

    return loadRoleOrThrow(transaction, role.id, actor.organizationId);
  });
}

export async function deleteRole(
  actor: AuthzContext,
  roleId: string,
  expectedEpoch: number | null
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const facts = await loadActorFacts(transaction, actor);

    await assertEpochAgainstOrganization(
      transaction,
      actor.organizationId,
      expectedEpoch
    );

    const role = await transaction.role.findFirst({
      where: { id: roleId, organizationId: actor.organizationId },
      select: {
        id: true,
        key: true,
        name: true,
        rank: true,
        isSystem: true,
        rolePermissions: { select: { permission: { select: { key: true } } } },
        _count: { select: { principalRoles: true } }
      }
    });

    if (!role) throw notFound("That role");

    assertRoleMutable(role, "delete");
    assertRankCeiling(facts.rank, role.rank, "act");
    // Checked here for the message; the foreign key is RESTRICT, so the database
    // refuses even if this check is somehow bypassed.
    assertRoleNotInUse(role._count.principalRoles);

    await transaction.role.delete({ where: { id: role.id } });

    if (
      role.rolePermissions.some(
        (rolePermission) => rolePermission.permission.key === "role.manage"
      )
    ) {
      await assertRoleManagersRemain(transaction, actor.organizationId);
    }

    await writeAudit(transaction, facts, {
      action: "role.deleted",
      detail: {
        roleId: role.id,
        key: role.key,
        name: role.name,
        permissions: role.rolePermissions
          .map((rolePermission) => rolePermission.permission.key)
          .sort()
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Replace a role's grants.
 *
 * Delete-then-insert rather than a diff, because the epoch trigger fires per row
 * either way and the resulting set is what matters. The `notIn` narrows the
 * delete so a row that is staying does not churn its `created_at`.
 */
async function writeRolePermissions(
  client: Prisma.TransactionClient,
  roleId: string,
  permissions: readonly PermissionKey[]
): Promise<void> {
  const rows = await client.permission.findMany({
    where: { key: { in: [...permissions] } },
    select: { id: true, key: true }
  });

  if (rows.length !== new Set(permissions).size) {
    // Unreachable through the API - `parsePermissionKeys` rejects unknown keys
    // with a 422 first - so this can only mean the catalog table is behind the
    // catalog file. Failing loudly beats writing a role that is missing grants
    // its author ticked.
    throw new Error(
      `Catalog table is missing ${new Set(permissions).size - rows.length} of the requested keys. Run db:seed-authorization.`
    );
  }

  const keep = rows.map((row) => row.id);

  await client.rolePermission.deleteMany({
    where: { roleId, permissionId: { notIn: keep } }
  });

  await client.rolePermission.createMany({
    data: keep.map((permissionId) => ({ roleId, permissionId })),
    skipDuplicates: true
  });

}

async function loadRoleOrThrow(
  client: Prisma.TransactionClient,
  roleId: string,
  organizationId: string
): Promise<RoleSummary> {
  const role = await client.role.findFirst({
    where: { id: roleId, organizationId },
    select: ROLE_SELECT
  });

  if (!role) throw notFound("That role");

  return toSummary(role);
}

/**
 * Refuse a change that would leave nobody able to manage roles.
 *
 * Asked against `role.manage`, never against a role called "Owner" (INV-1). A
 * tenant who renames Owner to "Principal" is still covered, and one who spreads
 * the key across three custom roles is correctly told they still have two.
 */
async function assertRoleManagersRemain(
  client: Prisma.TransactionClient,
  organizationId: string
): Promise<void> {
  const holders = await principalIdsHolding(
    organizationId,
    "role.manage",
    client
  );

  assertNotLastOwner(holders.size);
}

/**
 * The epoch as it stands now, for the response body after a write.
 *
 * It is NOT `previous + 1`. The bump is a per-row AFTER trigger, so replacing a
 * role's grants advances it once per permission row touched - creating a
 * 40-key role moves it by 40-something. Guessing would hand the client a stale
 * precondition that fails its very next save, which is a worse experience than
 * the lost update the mechanism exists to prevent.
 */
export async function readEpoch(organizationId: string): Promise<number> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { permissionsEpoch: true }
  });

  return Number(organization.permissionsEpoch);
}

/**
 * The epoch precondition, read inside the transaction.
 *
 * The trigger that bumps the epoch takes a row lock on `organizations`, so by
 * the time a concurrent writer reaches this line the earlier transaction has
 * either committed a higher epoch (and this one is refused) or rolled back.
 */
export async function assertEpochAgainstOrganization(
  client: Prisma.TransactionClient,
  organizationId: string,
  expectedEpoch: number | null
): Promise<number> {
  const organization = await client.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { permissionsEpoch: true }
  });

  const current = Number(organization.permissionsEpoch);
  assertEpochCurrent(expectedEpoch, current);

  return current;
}

