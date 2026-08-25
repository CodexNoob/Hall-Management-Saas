import "server-only";

import { prisma } from "@/lib/prisma";
import { permissionCatalog, type PermissionKey } from "@/lib/authz/catalog";
import { loadEffectiveAccess } from "@/lib/authz/decide";
import { notFound } from "@/lib/authz/guards";
import type { ScopeFilter, ScopeType } from "@/lib/authz/types";

/**
 * "Why can they do that?", answered.
 *
 * This is the screen that makes an authorization system operable. Without it,
 * the only way to explain a permission is to read four tables and do the union
 * by hand - which is exactly when somebody decides it is easier to just give the
 * person Owner.
 *
 * It reads the SAME fold the resolver enforces with, so what this screen says
 * and what a route does cannot disagree.
 */

export type PermissionProvenance = {
  key: PermissionKey;
  label: string;
  group: string;
  isDangerous: boolean;
  held: boolean;
  /** Which of the principal's roles carry this key. Empty when only an override does. */
  viaRoles: Array<{ roleId: string; roleName: string; scopeLabel: string }>;
  /** True when an individual GRANT row is what produced it. */
  viaGrantOverride: boolean;
  /** True when an individual DENY row took it away - and nothing overrides that. */
  deniedByOverride: boolean;
  /** True when the only assignment that carried it has lapsed. */
  expiredOnly: boolean;
  scope: ScopeFilter | null;
};

export type EffectiveReport = {
  principalId: string;
  subjectName: string | null;
  permissions: PermissionProvenance[];
  heldCount: number;
};

function scopeLabelFor(
  scopeType: ScopeType,
  scopeId: string,
  labels: Map<string, string>
): string {
  if (scopeType === "org") return "Whole organization";

  return labels.get(scopeId) ?? "(deleted)";
}

export async function effectiveReport(
  organizationId: string,
  principalId: string
): Promise<EffectiveReport> {
  const principal = await prisma.principal.findFirst({
    where: { id: principalId, organizationId },
    select: {
      id: true,
      membership: { select: { user: { select: { name: true } } } },
      serviceAccount: { select: { name: true } }
    }
  });

  if (!principal) throw notFound("That person");

  const [access, assignments, halls, eventTypes] = await Promise.all([
    loadEffectiveAccess(principalId, organizationId),
    prisma.principalRole.findMany({
      where: { principalId, organizationId },
      select: {
        scopeType: true,
        scopeId: true,
        expiresAt: true,
        role: {
          select: {
            id: true,
            name: true,
            rolePermissions: { select: { permission: { select: { key: true } } } }
          }
        }
      }
    }),
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

  const now = new Date();
  const rolesByKey = new Map<
    string,
    Array<{ roleId: string; roleName: string; scopeLabel: string }>
  >();

  for (const assignment of assignments) {
    // A lapsed assignment is not provenance for a key somebody currently holds.
    // Listing it would make an expired elevation look live on the one screen
    // whose job is to be believed.
    if (assignment.expiresAt && assignment.expiresAt <= now) continue;

    const scopeLabel = scopeLabelFor(
      assignment.scopeType as ScopeType,
      assignment.scopeId,
      labels
    );

    for (const rolePermission of assignment.role.rolePermissions) {
      const entry = {
        roleId: assignment.role.id,
        roleName: assignment.role.name,
        scopeLabel
      };
      const existing = rolesByKey.get(rolePermission.permission.key);

      if (existing) existing.push(entry);
      else rolesByKey.set(rolePermission.permission.key, [entry]);
    }
  }

  const permissions = permissionCatalog.map<PermissionProvenance>((entry) => {
    const scope = access.permissions.get(entry.key) ?? null;

    return {
      key: entry.key,
      label: entry.label,
      group: entry.group,
      isDangerous: entry.isDangerous,
      held: scope !== null,
      viaRoles: rolesByKey.get(entry.key) ?? [],
      viaGrantOverride: access.overridden.has(entry.key),
      deniedByOverride: access.denied.has(entry.key),
      expiredOnly: access.expired.has(entry.key) && scope === null,
      scope
    };
  });

  return {
    principalId: principal.id,
    subjectName:
      principal.membership?.user.name ?? principal.serviceAccount?.name ?? null,
    permissions,
    heldCount: permissions.filter((permission) => permission.held).length
  };
}
