import "server-only";

import type { Prisma } from "@prisma/client";
import type { ActorFacts } from "@/lib/authz/admin/context";

/**
 * The audit trail for privilege changes.
 *
 * EVERY PRIVILEGE WRITE APPENDS ONE, IN THE SAME TRANSACTION AS THE CHANGE AND
 * THE EPOCH BUMP (INV-7). A change that is visible but unaudited, or audited but
 * not applied, is worse than either failure alone - the first is a privilege
 * nobody can explain, the second is a report of something that never happened.
 *
 * The epoch bump comes free: it is a database trigger on the three privilege
 * tables, so it is inside whatever transaction the write is in without any
 * caller having to remember it.
 *
 * `writeAudit` takes a transaction client and nothing else. There is deliberately
 * no variant that takes the singleton - one would eventually be called outside a
 * transaction, and the invariant would be gone with no diff to point at.
 */

export const AUDIT_ACTIONS = [
  "role.created",
  "role.updated",
  "role.deleted",
  "assignment.created",
  "assignment.revoked",
  "override.replaced",
  "staff.invited",
  "staff.deactivated",
  "staff.restored",
  /**
   * An administrator ended somebody else's device session.
   *
   * Its own action rather than folded into `staff.deactivated`: the account is
   * still active and the person still works here, so recording it as a
   * deactivation would be wrong twice over - it would overstate what happened
   * and it would make the trail unreadable for the case it exists to explain,
   * which is "their phone was stolen on Tuesday".
   */
  "staff.session.revoked",
  /**
   * An administrator sent somebody a password-reset link, by email or as a
   * link to hand over. Recorded because it is a way into another person's
   * account: "who reset my password?" must always have an answer.
   */
  "staff.password.reset"
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
  action: AuditAction;
  /** The principal the change was made TO. Absent for org-level changes. */
  subjectPrincipalId?: string | null;
  /** Snapshot, because the foreign key is SET NULL and a deleted subject still matters. */
  subjectName?: string | null;
  /** Before/after. Shape is the writer's business. */
  detail?: Prisma.InputJsonValue;
};

export async function writeAudit(
  client: Prisma.TransactionClient,
  actor: ActorFacts,
  entry: AuditEntry
): Promise<void> {
  await client.authorizationAudit.create({
    data: {
      organizationId: actor.organizationId,
      actorId: actor.userId,
      actorName: actor.actorName,
      subjectPrincipalId: entry.subjectPrincipalId ?? null,
      subjectName: entry.subjectName ?? null,
      action: entry.action,
      detail: entry.detail
    }
  });
}

/** Added minus removed, so the audit row records the DIFF rather than the result. */
export function diffPermissionSets(
  before: readonly string[],
  after: readonly string[]
): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);

  return {
    added: after.filter((key) => !beforeSet.has(key)).sort(),
    removed: before.filter((key) => !afterSet.has(key)).sort()
  };
}
