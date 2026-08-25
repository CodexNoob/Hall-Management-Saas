import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth/errors";
import type { AuthzContext } from "@/lib/authz/authorize";
import type { PermissionKey } from "@/lib/authz/catalog";
import { principalIdsHolding } from "@/lib/authz/decide";
import {
  assertNotLastOwner,
  assertNotSelfElevation,
  assertRankCeiling,
  assertSubset,
  notFound
} from "@/lib/authz/guards";
import { loadActorFacts, rankOfPrincipal } from "@/lib/authz/admin/context";
import { diffPermissionSets, writeAudit } from "@/lib/authz/admin/audit";
import { assertEpochAgainstOrganization } from "@/lib/authz/admin/roles";

/**
 * Individual exceptions: "this one person, this one key".
 *
 * FULL REPLACEMENT, not a patch. The screen is two lists of checkboxes and the
 * caller sends the state it wants to end up in, which makes the operation
 * idempotent and makes "I unticked it and it came back" impossible.
 *
 * ORG-SCOPED, DELIBERATELY. A scoped individual grant is a role of one, and
 * roles are already that mechanism - adding a second scoped-grant path would
 * mean two places to look when answering "why can they do that?".
 */

export type OverrideState = {
  grants: PermissionKey[];
  denies: PermissionKey[];
};

export async function readOverrides(
  organizationId: string,
  principalId: string
): Promise<OverrideState> {
  const rows = await prisma.principalPermission.findMany({
    where: { organizationId, principalId },
    select: { effect: true, permission: { select: { key: true } } }
  });

  return {
    grants: rows
      .filter((row) => row.effect === "GRANT")
      .map((row) => row.permission.key as PermissionKey)
      .sort(),
    denies: rows
      .filter((row) => row.effect === "DENY")
      .map((row) => row.permission.key as PermissionKey)
      .sort()
  };
}

export async function replaceOverrides(
  actor: AuthzContext,
  principalId: string,
  next: OverrideState,
  expectedEpoch: number | null
): Promise<OverrideState> {
  const overlap = next.grants.filter((key) => next.denies.includes(key));

  if (overlap.length > 0) {
    // DENY would win anyway (INV-4), so accepting both would silently discard
    // the grant the administrator just ticked. Refusing says which one they got.
    throw new AuthorizationError(
      422,
      `A permission cannot be granted and denied at the same time: ${overlap.join(", ")}.`,
      "invalid_permission_key",
      { overlap }
    );
  }

  return prisma.$transaction(async (transaction) => {
    const facts = await loadActorFacts(transaction, actor);

    await assertEpochAgainstOrganization(
      transaction,
      actor.organizationId,
      expectedEpoch
    );

    assertNotSelfElevation(facts.principalId, principalId);

    const principal = await transaction.principal.findFirst({
      where: { id: principalId, organizationId: actor.organizationId },
      select: {
        id: true,
        membership: { select: { user: { select: { name: true } } } },
        serviceAccount: { select: { name: true } }
      }
    });

    if (!principal) throw notFound("That person");

    assertRankCeiling(
      facts.rank,
      await rankOfPrincipal(transaction, principalId, actor.organizationId),
      "act"
    );

    // Only GRANTS are subset-checked. Denying somebody a key you do not hold
    // yourself takes privilege away, which no escalation guard needs to stop.
    assertSubset(facts.permissions, next.grants);

    const before = await readOverridesIn(
      transaction,
      actor.organizationId,
      principalId
    );

    const catalog = await transaction.permission.findMany({
      where: { key: { in: [...next.grants, ...next.denies] } },
      select: { id: true, key: true }
    });
    const idByKey = new Map(catalog.map((row) => [row.key, row.id] as const));

    const desired = [
      ...next.grants.map((key) => ({ key, effect: "GRANT" as const })),
      ...next.denies.map((key) => ({ key, effect: "DENY" as const }))
    ];

    await transaction.principalPermission.deleteMany({
      where: {
        principalId,
        organizationId: actor.organizationId,
        permissionId: { notIn: desired.map((row) => idByKey.get(row.key)!) }
      }
    });

    for (const row of desired) {
      const permissionId = idByKey.get(row.key);
      if (!permissionId) continue;

      await transaction.principalPermission.upsert({
        where: {
          principalId_permissionId: { principalId, permissionId }
        },
        update: { effect: row.effect, grantedBy: facts.userId },
        create: {
          principalId,
          organizationId: actor.organizationId,
          permissionId,
          effect: row.effect,
          grantedBy: facts.userId
        }
      });
    }

    // A DENY on `role.manage` removes it just as thoroughly as a revoke does.
    if (
      next.denies.includes("role.manage") ||
      before.grants.includes("role.manage")
    ) {
      assertNotLastOwner(
        (
          await principalIdsHolding(
            actor.organizationId,
            "role.manage",
            transaction
          )
        ).size
      );
    }

    await writeAudit(transaction, facts, {
      action: "override.replaced",
      subjectPrincipalId: principal.id,
      subjectName:
        principal.membership?.user.name ??
        principal.serviceAccount?.name ??
        null,
      detail: {
        grants: diffPermissionSets(before.grants, next.grants),
        denies: diffPermissionSets(before.denies, next.denies)
      }
    });

    return { grants: [...next.grants].sort(), denies: [...next.denies].sort() };
  });
}

async function readOverridesIn(
  client: Prisma.TransactionClient,
  organizationId: string,
  principalId: string
): Promise<OverrideState> {
  const rows = await client.principalPermission.findMany({
    where: { organizationId, principalId },
    select: { effect: true, permission: { select: { key: true } } }
  });

  return {
    grants: rows
      .filter((row) => row.effect === "GRANT")
      .map((row) => row.permission.key as PermissionKey),
    denies: rows
      .filter((row) => row.effect === "DENY")
      .map((row) => row.permission.key as PermissionKey)
  };
}
