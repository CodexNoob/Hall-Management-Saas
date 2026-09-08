import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ACTIVITY_MODULES,
  activityActionLabel,
  activityActionModule,
  activityActionsInModule,
  type ActivityModule
} from "@/lib/audit/activity-actions";
import { authorize, hasPermission, tenant } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { csvRow } from "@/lib/http/csv";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http/with-route";

/**
 * What this organization did, filterable and exportable.
 *
 * TWO TABLES, ONE FEED, NO DUAL WRITES. `activity_logs` records operational
 * change - an event edited, a hall removed, a dish marked done.
 * `authorization_audit` records privilege change, and it is written inside the
 * same transaction as the privilege itself (INV-7, lib/authz/admin/audit.ts).
 * Copying one into the other would put a second thing that can fail inside that
 * transaction, and would duplicate every row. They are merged HERE instead,
 * where a failure costs a page of history rather than a privilege write.
 *
 * THE MERGE IS PERMISSION-GATED PER SOURCE. `activity.read` opens the feed;
 * privilege rows additionally need `audit.read`, asked with `hasPermission`,
 * which exists for exactly this second question. A venue manager who may see
 * that a hall was renamed has no business seeing who was made an owner.
 */

const PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 10_000;

const querySchema = z.object({
  module: z.enum(ACTIVITY_MODULES as unknown as [ActivityModule, ...ActivityModule[]]).optional(),
  action: z.string().trim().max(80).optional(),
  userId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  format: z.enum(["json", "csv"]).default("json"),
  cursor: z.string().max(200).optional()
});

/**
 * One row of the merged feed, whichever table it came from.
 *
 * `source` is not decoration: the reader needs to know a privilege row is a
 * privilege row, and a future "show me only the operational history" filter has
 * nothing else to key on.
 */
type FeedEntry = {
  id: string;
  source: "activity" | "privilege";
  createdAt: Date;
  action: string;
  label: string;
  module: ActivityModule;
  message: string;
  actorName: string | null;
  userId: string | null;
  eventId: string | null;
  detail: unknown;
};

/**
 * A keyset over two tables.
 *
 * `(createdAt, id)` descending, encoded opaquely. A cursor holding one table's
 * row id would be meaningless to the other and would silently drop whichever
 * rows fell between - which is the failure mode that makes a merged feed look
 * like it is missing history rather than paging through it.
 */
function encodeCursor(entry: FeedEntry): string {
  return Buffer.from(`${entry.createdAt.toISOString()}|${entry.id}`).toString(
    "base64url"
  );
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  const [timestamp, id] = Buffer.from(cursor, "base64url")
    .toString("utf8")
    .split("|");
  const createdAt = timestamp ? new Date(timestamp) : null;

  // A malformed cursor reads as "start from the beginning" rather than as an
  // error: it is an opaque token the caller only ever got from us, so a bad one
  // is a stale bookmark, not a request worth refusing.
  if (!createdAt || Number.isNaN(createdAt.getTime()) || !id) return null;

  return { createdAt, id };
}

/** The keyset predicate, as a Prisma `where` fragment. */
function afterCursor(cursor: { createdAt: Date; id: string } | null) {
  if (!cursor) return {};

  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } }
    ]
  };
}

function dateRange(from?: string, to?: string) {
  if (!from && !to) return {};

  return {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {})
    }
  };
}

export const GET = withRoute("GET /api/activity", async (request: Request) => {
  try {
    const actor = await authorize(request, "activity.read");
    const query = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams)
    );

    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const take = query.format === "csv" ? MAX_EXPORT_ROWS : PAGE_SIZE + 1;

    // The privilege half is a second question, not an inference from having got
    // through the door. A caller without `audit.read` gets the operational feed
    // and is not told the other table exists.
    const canReadPrivilegeTrail = await hasPermission(actor, "audit.read");

    // "Access" names privilege rows only, so asking for it while holding no
    // `audit.read` correctly returns nothing rather than the whole feed.
    const wantsPrivilege =
      canReadPrivilegeTrail &&
      (!query.module || query.module === "Access") &&
      !query.eventId;
    const wantsActivity = !query.module || query.module !== "Access";

    const moduleActions = query.module
      ? activityActionsInModule(query.module)
      : null;

    const [activityRows, privilegeRows] = await Promise.all([
      wantsActivity
        ? prisma.activityLog.findMany({
            where: {
              ...tenant(actor),
              ...afterCursor(cursor),
              ...dateRange(query.from, query.to),
              // A module filter expands to its keys. Legacy rows written before
              // the catalog carry human-readable strings and belong to "Other";
              // they are matched by exclusion so that filtering for Other does
              // not mean listing every string that was ever written.
              ...(moduleActions && query.module !== "Other"
                ? { actionType: { in: [...moduleActions] } }
                : {}),
              // AFTER the module clause, not before: both write `actionType`, and
              // an exact action is the narrower of the two. Spread the other way
              // round and asking for one action inside a module silently returns
              // the whole module.
              ...(query.action ? { actionType: query.action } : {}),
              ...(query.module === "Other" && moduleActions
                ? {
                    NOT: {
                      actionType: {
                        in: [
                          ...activityActionsInModule("Events"),
                          ...activityActionsInModule("Menu"),
                          ...activityActionsInModule("Kitchen"),
                          ...activityActionsInModule("Calendar"),
                          ...activityActionsInModule("Staff"),
                          ...activityActionsInModule("Settings")
                        ]
                      }
                    }
                  }
                : {}),
              ...(query.userId ? { userId: query.userId } : {}),
              ...(query.eventId ? { eventId: query.eventId } : {})
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take,
            select: {
              id: true,
              createdAt: true,
              actionType: true,
              message: true,
              userName: true,
              userId: true,
              eventId: true,
              oldValue: true,
              newValue: true
            }
          })
        : [],
      wantsPrivilege
        ? prisma.authorizationAudit.findMany({
            where: {
              ...tenant(actor),
              ...afterCursor(cursor),
              ...dateRange(query.from, query.to),
              ...(query.action ? { action: query.action } : {}),
              ...(query.userId ? { actorId: query.userId } : {})
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take,
            select: {
              id: true,
              createdAt: true,
              action: true,
              actorId: true,
              actorName: true,
              subjectName: true,
              detail: true
            }
          })
        : []
    ]);

    const merged: FeedEntry[] = [
      ...activityRows.map((row) => ({
        id: row.id,
        source: "activity" as const,
        createdAt: row.createdAt,
        action: row.actionType,
        label: activityActionLabel(row.actionType),
        module: activityActionModule(row.actionType),
        message: row.message,
        actorName: row.userName,
        userId: row.userId,
        eventId: row.eventId,
        detail:
          row.oldValue === null && row.newValue === null
            ? null
            : { before: row.oldValue, after: row.newValue }
      })),
      ...privilegeRows.map((row) => ({
        id: row.id,
        source: "privilege" as const,
        createdAt: row.createdAt,
        action: row.action,
        label: activityActionLabel(row.action),
        module: "Access" as const,
        // The privilege table stores no sentence - it stores an action and a
        // subject - so one is composed here rather than left blank. The Access
        // screen's own reader does the same thing with the same two fields.
        message: row.subjectName
          ? `${activityActionLabel(row.action)} · ${row.subjectName}`
          : activityActionLabel(row.action),
        actorName: row.actorName,
        userId: row.actorId,
        eventId: null,
        detail: row.detail
      }))
    ].sort(
      (left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime() ||
        right.id.localeCompare(left.id)
    );

    if (query.format === "csv") {
      const rows = merged.slice(0, MAX_EXPORT_ROWS);
      const body = rows.map((entry) =>
        csvRow([
          entry.createdAt.toISOString(),
          entry.module,
          entry.action,
          entry.actorName,
          entry.message,
          entry.detail
        ])
      );

      // Truncation is announced rather than silent: a report that quietly stops
      // at ten thousand rows reads as "this is everything" when it is not.
      if (merged.length >= MAX_EXPORT_ROWS) {
        body.push(
          csvRow([
            `TRUNCATED at ${MAX_EXPORT_ROWS} rows. Narrow the date range to export the rest.`
          ])
        );
      }

      return new NextResponse(
        [
          csvRow(["created_at", "module", "action", "actor", "message", "detail"]),
          ...body
        ].join("\n"),
        {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="activity-${actor.organization.slug}.csv"`
          }
        }
      );
    }

    const page = merged.slice(0, PAGE_SIZE);
    const last = page[page.length - 1];

    return NextResponse.json({
      entries: page.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString()
      })),
      // A next cursor only when a page was actually filled. `merged` holds up to
      // PAGE_SIZE + 1 from EACH table, so its length says nothing about whether
      // more exists - the page being full is the only honest signal.
      nextCursor: merged.length > PAGE_SIZE && last ? encodeCursor(last) : null,
      includesPrivilegeTrail: canReadPrivilegeTrail,
      epoch: actor.epoch
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
});
