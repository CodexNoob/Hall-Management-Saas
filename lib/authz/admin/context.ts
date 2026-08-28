import "server-only";

import type { Prisma } from "@prisma/client";
import type { PermissionKey } from "@/lib/authz/catalog";
import { loadEffectiveAccess } from "@/lib/authz/decide";
import { UNRANKED } from "@/lib/authz/guards";
import type { AuthzContext } from "@/lib/authz/authorize";

/**
 * The facts every privilege write is checked against, read INSIDE the write's
 * own transaction.
 *
 * Uncached on purpose. The subset check (INV-6) and the rank ceiling have to see
 * what is true at commit time, not what was true when a cache entry was filled -
 * otherwise an administrator whose own `payment.refund` was revoked a second ago
 * can still hand it out.
 */

/**
 * The transaction budget every privilege write runs under.
 *
 * WHY THE DEFAULT IS NOT ENOUGH. Prisma allows an interactive transaction 5
 * seconds, and these transactions spend that on about eight sequential round
 * trips: the actor's facts, the epoch precondition, the subject, the role, the
 * target's rank, the existing row, the write itself, and the audit entry. Every
 * one of them is inside the transaction on purpose - `loadActorFacts` below
 * explains why they have to be read at commit time rather than from a cache -
 * and none of them can overlap, because an interactive transaction holds one
 * connection and the driver serializes what it is given. Against a remote
 * database that is roughly eight latencies end to end, which was overrunning
 * five seconds under ordinary load and failing the commit with P2028: the
 * caller saw a 500, and nothing was written.
 *
 * So the budget matches the work rather than the work being cut to fit the
 * budget. Assigning a role is a rare, deliberate act by an administrator; it is
 * better slow than half-applied, and the atomicity is the point.
 *
 * `maxWait` is how long a transaction may wait to START - to be handed a
 * connection - and is aligned with the pool's own `connectionTimeoutMillis` in
 * lib/prisma.ts so a busy pool produces one clear failure rather than two
 * different ones at two different limits.
 */
export const PRIVILEGE_TRANSACTION_OPTIONS = {
  timeout: 15_000,
  maxWait: 10_000
} as const;

export type ActorFacts = {
  principalId: string;
  organizationId: string;
  userId: string | null;
  actorName: string;
  /** Every key the actor effectively holds. The ceiling on what they may grant. */
  permissions: ReadonlySet<PermissionKey>;
  /**
   * The best (lowest) rank the actor holds. `UNRANKED` when they hold no
   * assignment at all, which outranks nobody - and since every comparison is
   * strict, denies every act on every target.
   */
  rank: number;
};

export async function loadActorFacts(
  client: Prisma.TransactionClient,
  actor: AuthzContext,
  now: Date = new Date()
): Promise<ActorFacts> {
  const [access, assignments] = await Promise.all([
    loadEffectiveAccess(actor.principalId, actor.organizationId, client, now),
    client.principalRole.findMany({
      where: {
        principalId: actor.principalId,
        organizationId: actor.organizationId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      select: { role: { select: { rank: true } } }
    })
  ]);

  const rank = assignments.reduce(
    (best, assignment) => Math.min(best, assignment.role.rank),
    UNRANKED
  );

  return {
    principalId: actor.principalId,
    organizationId: actor.organizationId,
    userId: actor.userId,
    actorName: actor.actorName,
    permissions: new Set(access.permissions.keys()),
    rank
  };
}

/**
 * The rank of a role, and of a principal, for the ceiling check.
 *
 * A principal's rank is the BEST rank they hold, so somebody who is both an
 * Administrator and a Viewer is treated as an Administrator - being additionally
 * assigned a weaker role must never make someone easier to act on.
 */
export async function rankOfPrincipal(
  client: Prisma.TransactionClient,
  principalId: string,
  organizationId: string,
  now: Date = new Date()
): Promise<number> {
  const assignments = await client.principalRole.findMany({
    where: {
      principalId,
      organizationId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    select: { role: { select: { rank: true } } }
  });

  return assignments.reduce(
    (best, assignment) => Math.min(best, assignment.role.rank),
    UNRANKED
  );
}
