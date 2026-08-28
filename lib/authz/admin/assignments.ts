import "server-only";

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
import {
  PRIVILEGE_TRANSACTION_OPTIONS,
  loadActorFacts,
  rankOfPrincipal
} from "@/lib/authz/admin/context";
import { writeAudit } from "@/lib/authz/admin/audit";
import { assertEpochAgainstOrganization } from "@/lib/authz/admin/roles";
import type { ScopeType } from "@/lib/authz/types";

/**
 * Putting people into roles.
 *
 * AN ASSIGNMENT IS A RESOURCE, with its own id, scope, expiry and provenance -
 * which is why it is created and deleted rather than "set", and why the delete
 * is addressed by the assignment's own id rather than nested under the
 * principal. Nesting would put redundant identity in the URL and make "revoke
 * the Hall A one, keep the Hall B one" unexpressible.
 */

export type AssignmentInput = {
  principalId: string;
  roleId: string;
  scope: { type: ScopeType; id?: string };
  expiresAt?: Date | null;
  expectedEpoch: number | null;
};

export type AssignmentSummary = {
  id: string;
  roleId: string;
  roleName: string;
  roleKey: string;
  rank: number;
  scopeType: ScopeType;
  scopeId: string;
  scopeLabel: string | null;
  expiresAt: string | null;
  grantedByName: string | null;
  source: string;
  createdAt: string;
};

/**
 * The scope target has to exist, in this tenant.
 *
 * Without this a scoped assignment can name any uuid at all: the composite
 * foreign keys cover the principal and the role, but `scope_id` points at two
 * different tables depending on `scope_type`, which no single key can express.
 * An assignment scoped to a hall that does not exist grants nothing and is
 * invisible until somebody wonders why the new starter can see no events.
 */
async function resolveScope(
  organizationId: string,
  scope: { type: ScopeType; id?: string }
): Promise<{ scopeType: ScopeType; scopeId: string; label: string | null }> {
  if (scope.type === "org") {
    // 'org' stores the organization's own id rather than a null. A CHECK
    // constraint enforces it, so this is the only value that can be written.
    return { scopeType: "org", scopeId: organizationId, label: null };
  }

  if (!scope.id) {
    throw new AuthorizationError(
      422,
      `A ${scope.type} scope needs the id of the ${scope.type} it applies to.`,
      "invalid_permission_key"
    );
  }

  if (scope.type === "hall") {
    const hall = await prisma.hall.findFirst({
      where: { id: scope.id, organizationId },
      select: { id: true, name: true }
    });

    if (!hall) throw notFound("That hall");

    return { scopeType: "hall", scopeId: hall.id, label: hall.name };
  }

  const eventType = await prisma.eventType.findFirst({
    where: { id: scope.id, organizationId },
    select: { id: true, name: true }
  });

  if (!eventType) throw notFound("That event type");

  return {
    scopeType: "event_type",
    scopeId: eventType.id,
    label: eventType.name
  };
}

export async function createAssignment(
  actor: AuthzContext,
  input: AssignmentInput
): Promise<AssignmentSummary> {
  const scope = await resolveScope(actor.organizationId, input.scope);

  return prisma.$transaction(async (transaction) => {
    const facts = await loadActorFacts(transaction, actor);

    await assertEpochAgainstOrganization(
      transaction,
      actor.organizationId,
      input.expectedEpoch
    );

    // Raising your own privileges is the one thing no amount of permission
    // justifies, because the check that would stop it is the one you are about
    // to change.
    assertNotSelfElevation(facts.principalId, input.principalId);

    const principal = await transaction.principal.findFirst({
      where: { id: input.principalId, organizationId: actor.organizationId },
      select: {
        id: true,
        membership: { select: { user: { select: { name: true } } } },
        serviceAccount: { select: { name: true } }
      }
    });

    if (!principal) throw notFound("That person");

    const role = await transaction.role.findFirst({
      where: { id: input.roleId, organizationId: actor.organizationId },
      select: {
        id: true,
        key: true,
        name: true,
        rank: true,
        rolePermissions: { select: { permission: { select: { key: true } } } }
      }
    });

    if (!role) throw notFound("That role");

    // The two halves of the escalation guard, and they answer different
    // questions. Rank says whether this actor may act on this target at all;
    // subset says whether the CONTENTS of the role are theirs to hand out. Rank
    // alone is not enough - a custom role at rank 400 can contain
    // `payment.refund`, and an actor at 300 outranks it while holding no such
    // key themselves.
    assertRankCeiling(facts.rank, role.rank, "assign");
    assertSubset(
      facts.permissions,
      role.rolePermissions.map(
        (rolePermission) => rolePermission.permission.key as PermissionKey
      )
    );

    const targetRank = await rankOfPrincipal(
      transaction,
      input.principalId,
      actor.organizationId
    );
    assertRankCeiling(facts.rank, targetRank, "act");

    const subjectName =
      principal.membership?.user.name ?? principal.serviceAccount?.name ?? null;

    const existing = await transaction.principalRole.findUnique({
      where: {
        principalId_roleId_scopeType_scopeId: {
          principalId: input.principalId,
          roleId: role.id,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId
        }
      },
      select: { id: true }
    });

    // Re-assigning what somebody already holds at that scope is a no-op, not an
    // error - the button that does it lives in a dialog people double-click.
    const assignment = existing
      ? await transaction.principalRole.update({
          where: { id: existing.id },
          data: { expiresAt: input.expiresAt ?? null },
          select: { id: true, createdAt: true }
        })
      : await transaction.principalRole.create({
          data: {
            principalId: input.principalId,
            organizationId: actor.organizationId,
            roleId: role.id,
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
            expiresAt: input.expiresAt ?? null,
            grantedBy: facts.userId,
            source: "manual"
          },
          select: { id: true, createdAt: true }
        });

    await writeAudit(transaction, facts, {
      action: "assignment.created",
      subjectPrincipalId: principal.id,
      subjectName,
      detail: {
        assignmentId: assignment.id,
        roleId: role.id,
        roleKey: role.key,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expiresAt: input.expiresAt?.toISOString() ?? null
      }
    });

    return {
      id: assignment.id,
      roleId: role.id,
      roleName: role.name,
      roleKey: role.key,
      rank: role.rank,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      scopeLabel: scope.label,
      expiresAt: input.expiresAt?.toISOString() ?? null,
      grantedByName: facts.actorName,
      source: "manual",
      createdAt: assignment.createdAt.toISOString()
    };
  }, PRIVILEGE_TRANSACTION_OPTIONS);
}

export async function revokeAssignment(
  actor: AuthzContext,
  assignmentId: string,
  expectedEpoch: number | null
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const facts = await loadActorFacts(transaction, actor);

    await assertEpochAgainstOrganization(
      transaction,
      actor.organizationId,
      expectedEpoch
    );

    const assignment = await transaction.principalRole.findFirst({
      where: { id: assignmentId, organizationId: actor.organizationId },
      select: {
        id: true,
        principalId: true,
        scopeType: true,
        scopeId: true,
        role: { select: { id: true, key: true, rank: true } },
        principal: {
          select: {
            membership: { select: { user: { select: { name: true } } } },
            serviceAccount: { select: { name: true } }
          }
        }
      }
    });

    if (!assignment) throw notFound("That assignment");

    // Removing your own last role is a foot-gun rather than an escalation, but
    // it is the same shape of mistake and the same answer: change somebody
    // else's privileges, or have somebody else change yours.
    assertNotSelfElevation(facts.principalId, assignment.principalId);
    assertRankCeiling(facts.rank, assignment.role.rank, "act");

    await transaction.principalRole.delete({ where: { id: assignment.id } });

    // A revoke can strand the organization just as easily as an edit can, and
    // this reads the same three-part effective set the resolver does - so a
    // colleague whose `role.manage` comes from a GRANT override still counts,
    // and one carrying a DENY correctly does not.
    assertNotLastOwner(
      (
        await principalIdsHolding(
          actor.organizationId,
          "role.manage",
          transaction
        )
      ).size
    );

    await writeAudit(transaction, facts, {
      action: "assignment.revoked",
      subjectPrincipalId: assignment.principalId,
      subjectName:
        assignment.principal.membership?.user.name ??
        assignment.principal.serviceAccount?.name ??
        null,
      detail: {
        assignmentId: assignment.id,
        roleId: assignment.role.id,
        roleKey: assignment.role.key,
        scopeType: assignment.scopeType,
        scopeId: assignment.scopeId
      }
    });
  }, PRIVILEGE_TRANSACTION_OPTIONS);
}

/** Every assignment a principal holds, with the labels the UI renders. */
export async function listAssignments(
  organizationId: string,
  principalIds?: string[]
): Promise<Map<string, AssignmentSummary[]>> {
  const rows = await prisma.principalRole.findMany({
    where: {
      organizationId,
      ...(principalIds ? { principalId: { in: principalIds } } : {})
    },
    select: {
      id: true,
      principalId: true,
      scopeType: true,
      scopeId: true,
      expiresAt: true,
      source: true,
      createdAt: true,
      role: { select: { id: true, key: true, name: true, rank: true } },
      grantedByUser: { select: { name: true } }
    },
    orderBy: [{ role: { rank: "asc" } }, { createdAt: "asc" }]
  });

  // One lookup for every scope label rather than one per row. Both tables are
  // small and tenant-scoped, so this is two queries regardless of how many
  // assignments there are.
  const [halls, eventTypes] = await Promise.all([
    prisma.hall.findMany({
      where: { organizationId },
      select: { id: true, name: true }
    }),
    prisma.eventType.findMany({
      where: { organizationId },
      select: { id: true, name: true }
    })
  ]);

  const labels = new Map<string, string>([
    ...halls.map((hall) => [hall.id, hall.name] as const),
    ...eventTypes.map((eventType) => [eventType.id, eventType.name] as const)
  ]);

  const byPrincipal = new Map<string, AssignmentSummary[]>();

  for (const row of rows) {
    const summary: AssignmentSummary = {
      id: row.id,
      roleId: row.role.id,
      roleName: row.role.name,
      roleKey: row.role.key,
      rank: row.role.rank,
      scopeType: row.scopeType as ScopeType,
      scopeId: row.scopeId,
      scopeLabel:
        row.scopeType === "org" ? null : (labels.get(row.scopeId) ?? null),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      grantedByName: row.grantedByUser?.name ?? null,
      source: row.source,
      createdAt: row.createdAt.toISOString()
    };

    const existing = byPrincipal.get(row.principalId);
    if (existing) existing.push(summary);
    else byPrincipal.set(row.principalId, [summary]);
  }

  return byPrincipal;
}
