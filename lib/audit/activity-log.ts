import { Prisma } from "@prisma/client";

import type { ActivityAction } from "@/lib/audit/activity-actions";

/**
 * The organization's history: what was done, by whom, and to what.
 *
 * ONE WRITE PATH. Every in-scope mutation calls `recordActivity` and nothing
 * calls `activityLog.create` directly. That is not tidiness - it is what makes
 * the coverage test possible. `tests/unit/activity-route-coverage.test.ts`
 * enumerates the mutating routes and asserts each one CALLS this function; a
 * hand-written `transaction.activityLog.create` is correct today and
 * unenumerable forever, exactly as an inline `organizationId:` is next to
 * `tenant()`.
 *
 * IN THE SAME TRANSACTION AS THE CHANGE IT DESCRIBES. A change that is visible
 * but unrecorded, or recorded but not applied, is worse than either failure
 * alone. This takes a transaction client and nothing else for the same reason
 * `writeAudit` does (lib/authz/admin/audit.ts): a variant taking the singleton
 * would eventually be called outside one, and the invariant would be gone with
 * no diff to point at. Where a mutation genuinely cannot be transactional - a
 * staff invitation reaches Supabase - the call site says so in a comment.
 *
 * THE ACTOR ARRIVES WHOLE. Callers pass the `AuthzContext` they already have
 * rather than copying four fields out of it, so "who did this" cannot be half
 * filled in.
 *
 * NOT THE SAME THING AS `log` FROM @/lib/logging/context. That system's MESSAGE
 * is the stable snake_case event name; here that role belongs to `action`, and
 * `message` is prose an operator reads on the Activity screen. Do not pair a
 * `log.info` with a `recordActivity` - the row IS the record. `log.*` stays for
 * what is not an activity: a failure, a fallback, a decision worth timing.
 *
 * WHAT MAY GO IN `changed`
 * ------------------------
 * A field diff, never a whole row and never the request body. Never a client
 * email, a phone number or a raw URL - `AGENTS.md` redacts those from logs and
 * this table has no redaction at all, so they must stay out by construction.
 * Where a payload's VALUES are themselves sensitive (organization settings hold
 * a contact email and a payment link), record the changed key paths and no
 * values; see `changedKeyPaths` below.
 *
 * `userName` is a denormalized snapshot on purpose: `user_id` is ON DELETE SET
 * NULL, so the entry still reads correctly once the account is gone. See
 * prisma/migrations/20260820200000_activity_logs_allow_user_detach.
 */

/**
 * The subset of `AuthzContext` a history entry needs.
 *
 * Structural rather than an import of `AuthzContext` itself: that type lives in
 * a `server-only` module, and the seed scripts and unit tests build actors by
 * hand.
 */
export type ActivityActor = {
  organizationId: string;
  /** Null for a service account, which has no user row to point at. */
  userId: string | null;
  /** A person's name, or the service token's label. */
  actorName: string | null;
};

export type ActivityEntry = {
  /** From the catalog. A typo here is a build failure. */
  action: ActivityAction;
  /** The sentence the Activity feed renders. Prose, not an event name. */
  message: string;
  /** The event this concerns, where there is one. */
  eventId?: string | null;
  /** The client this concerns, where there is one. */
  clientId?: string | null;
  /** Before and after. Read the note above on what may appear here. */
  changed?: {
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
  };
};

/**
 * The structural shape of the client, rather than `Prisma.TransactionClient`.
 *
 * The unit suites mock Prisma as a bare object with one `activityLog.create`
 * spy (tests/unit/event-update-route.test.ts, client-portal-selections-route),
 * and narrowing this to the generated type would break all of them at once
 * without making a single call site safer.
 */
type ActivityLogClient = {
  activityLog: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

/**
 * Returns the row it wrote.
 *
 * Almost every caller ignores it - the row IS the record, and there is nothing
 * to do with it. The two billing services hand it back in their own response,
 * which is the only reason this is not `void`.
 */
export async function recordActivity(
  client: unknown,
  actor: ActivityActor,
  entry: ActivityEntry
): Promise<unknown> {
  const activityLogClient = client as ActivityLogClient;

  return activityLogClient.activityLog.create({
    data: {
      organizationId: actor.organizationId,
      eventId: entry.eventId ?? undefined,
      clientId: entry.clientId ?? undefined,
      userId: actor.userId ?? undefined,
      userName: actor.actorName ?? undefined,
      actionType: entry.action,
      message: entry.message,
      oldValue: entry.changed?.before ?? undefined,
      newValue: entry.changed?.after ?? undefined
    }
  });
}

/**
 * Which fields moved, comparing what was supplied against what is stored.
 *
 * `undefined` in `after` means "not supplied", which is not a change. This
 * matters more than it sounds: the event details panel sends every count on
 * every save, so a notes-only edit arrives carrying all six and would otherwise
 * record a change that never happened.
 *
 * Scalars and dates. Dates are compared by their instant, because two `Date`
 * objects for the same moment are never `===` and a naive comparison would
 * report every save as a date change. A caller diffing arrays or nested objects
 * does it itself.
 */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>
): Array<keyof T & string> {
  return Object.keys(after).filter((field) => {
    const next = after[field];
    if (next === undefined) return false;

    const previous = before[field];

    if (next instanceof Date || previous instanceof Date) {
      const nextTime = next instanceof Date ? next.getTime() : next;
      const previousTime =
        previous instanceof Date ? previous.getTime() : previous;

      return nextTime !== previousTime;
    }

    return next !== previous;
  }) as Array<keyof T & string>;
}

/**
 * The dotted paths that changed, WITHOUT their values.
 *
 * For payloads whose values may not be recorded at all: organization settings
 * carry a contact email and a client payment link, one personal data and one a
 * URL, and both are barred from this table. "Somebody changed
 * general.contactEmail at 14:12" is the whole answer an operator needs; the
 * current value is on the screen they are already looking at.
 */
export function changedKeyPaths(
  before: unknown,
  after: unknown,
  prefix = ""
): string[] {
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) ||
    Array.isArray(after)
  ) {
    return before === after ? [] : [prefix].filter(Boolean);
  }

  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  const paths: string[] = [];

  for (const key of Object.keys(afterRecord)) {
    const value = afterRecord[key];
    if (value === undefined) continue;

    const path = prefix ? `${prefix}.${key}` : key;
    const previous = beforeRecord[key];

    if (
      value &&
      previous &&
      typeof value === "object" &&
      typeof previous === "object" &&
      !Array.isArray(value) &&
      !Array.isArray(previous)
    ) {
      paths.push(...changedKeyPaths(previous, value, path));
      continue;
    }

    // Arrays and scalars alike: a structural comparison is enough to answer
    // "did this move", and the values themselves are deliberately not recorded.
    if (JSON.stringify(previous) !== JSON.stringify(value)) paths.push(path);
  }

  return paths;
}
