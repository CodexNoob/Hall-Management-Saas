import { NextResponse } from "next/server";

import { authorize } from "@/lib/authz/authorize";
import { loadActorFacts, rankOfPrincipal } from "@/lib/authz/admin/context";
import { writeAudit } from "@/lib/authz/admin/audit";
import { assertRankCeiling, notFound } from "@/lib/authz/guards";
import { describeUserAgent } from "@/lib/auth/session-record";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http/with-route";

/**
 * SOMEBODY ELSE'S DEVICES.
 *
 * The counterpart to `/api/me/sessions`, and deliberately a different route
 * rather than a parameter on that one. `/api/me/sessions` is scoped to the
 * caller by construction - every query there is filtered by the caller's own
 * `userId`, and there is no id a request could name to reach past it. Adding an
 * "on behalf of" parameter would have turned the safest endpoint in the file
 * into one whose safety depended on a branch being right.
 *
 * WHY `staff.deactivate` AND NOT A NEW KEY. Whoever holds it can already switch
 * an account off entirely, which locks that person out of every device at once
 * and stops them working. Ending one of their sessions is a strictly smaller
 * act, so gating it on the same key grants nobody anything they did not already
 * have - and it needs no catalog entry and no backfill onto roles that already
 * exist. If a venue later wants "may end sessions but may not deactivate", that
 * is a new key and a role edit, not a redesign.
 *
 * THE SAME RANK CEILING AS DEACTIVATION. Ending somebody's session is an
 * exercise of authority over them, so an administrator cannot do it to the
 * owner. Without this, the weaker control would be the way round the stronger
 * one's ceiling.
 *
 * THE TARGET IS NEVER TAKEN FROM THE BROWSER. The request names a PRINCIPAL,
 * which is resolved to a user - and to a Supabase id - server-side, inside the
 * caller's own organization. A principal from another tenant resolves to
 * nothing.
 */

/**
 * Everything needed to act on one staff member's sessions, or a 404.
 *
 * The membership lookup is the tenant boundary: `organizationId` comes from the
 * authorized actor, never from the request, so a principal id belonging to
 * another organization finds no row. 404 rather than 403 for the same reason it
 * is elsewhere in this file - existence is information.
 */
async function loadSubject(
  client: typeof prisma,
  organizationId: string,
  principalId: string
) {
  const membership = await client.organizationMembership.findFirst({
    where: { principalId, organizationId },
    select: {
      userId: true,
      user: { select: { id: true, name: true, supabaseAuthId: true } }
    }
  });

  if (!membership?.user) throw notFound("That staff member");

  return membership.user;
}

export const GET = withRoute(
  "GET /api/staff/[principalId]/sessions",
  async (request: Request, context: { params: Promise<{ principalId: string }> }) => {
    try {
      const actor = await authorize(request, "staff.deactivate");
      const { principalId } = await context.params;
      const subject = await loadSubject(prisma, actor.organizationId, principalId);

      const sessions = await prisma.userSession.findMany({
        where: { userId: subject.id, revokedAt: null },
        orderBy: { lastSeenAt: "desc" },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          city: true,
          region: true,
          country: true,
          createdAt: true,
          lastSeenAt: true
        }
      });

      return NextResponse.json({
        subjectName: subject.name,
        sessions: sessions.map((session) => ({
          id: session.id,
          device: describeUserAgent(session.userAgent) ?? session.userAgent,
          ipAddress: session.ipAddress,
          city: session.city,
          region: session.region,
          country: session.country,
          createdAt: session.createdAt,
          lastSeenAt: session.lastSeenAt
        }))
        // `sessionId` is NOT here, exactly as it is not on /api/me/sessions.
        // The Supabase session id is what identifies a session to Supabase; our
        // row id is enough to name one across our own API.
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

export const DELETE = withRoute(
  "DELETE /api/staff/[principalId]/sessions",
  async (request: Request, context: { params: Promise<{ principalId: string }> }) => {
    try {
      const actor = await authorize(request, "staff.deactivate");
      const { principalId } = await context.params;
      const url = new URL(request.url);
      const rowId = url.searchParams.get("sessionId")?.trim() || null;
      const endEverything = url.searchParams.get("scope") === "all";

      if (!rowId && !endEverything) {
        return NextResponse.json(
          {
            error:
              "Name a session to end, or pass scope=all to end all of them."
          },
          { status: 400 }
        );
      }

      const subject = await prisma.$transaction(async (transaction) => {
        const user = await loadSubject(
          transaction as unknown as typeof prisma,
          actor.organizationId,
          principalId
        );

        const facts = await loadActorFacts(transaction, actor);

        // Ending somebody's session is an exercise of authority over them, so
        // the ceiling that governs switching their account off governs this
        // too. An administrator does not get to sign the owner out.
        assertRankCeiling(
          facts.rank,
          await rankOfPrincipal(transaction, principalId, actor.organizationId),
          "act"
        );

        await writeAudit(transaction, facts, {
          action: "staff.session.revoked",
          subjectPrincipalId: principalId,
          subjectName: user.name,
          detail: rowId ? { sessions: 1 } : { sessions: "all" }
        });

        return user;
      });

      if (!subject.supabaseAuthId) {
        return NextResponse.json(
          {
            error:
              "That account has no sign-in record, so it has no sessions to end."
          },
          { status: 409 }
        );
      }

      /**
       * The rows to end, resolved under the SUBJECT's id.
       *
       * Scoped twice, on purpose. The row is selected by `userId` so a session
       * id belonging to a third person finds nothing, and the delete below
       * repeats the ownership check against `auth.sessions.user_id` - so even a
       * mistake here cannot reach a session this call had no business ending.
       */
      const rows = await prisma.userSession.findMany({
        where: {
          userId: subject.id,
          revokedAt: null,
          ...(rowId ? { id: rowId } : {})
        },
        select: { id: true, sessionId: true }
      });

      if (rowId && rows.length === 0) {
        return NextResponse.json(
          { error: "That session was not found." },
          { status: 404 }
        );
      }

      /**
       * Supabase has no admin call that revokes one session by id -
       * `auth.admin.signOut` takes a JWT and a scope, and we hold neither the
       * subject's JWT nor a reason to want it. Deleting the row from
       * `auth.sessions` is what invalidates the refresh token underneath.
       *
       * The access token the device already holds stays valid until it expires,
       * within the hour, as it does for every revocation everywhere: a signed
       * assertion cannot be withdrawn. If that hour matters, deactivate the
       * account as well - `resolveUserActor` refuses an inactive member on
       * their very next request.
       */
      for (const row of rows) {
        await prisma.$executeRaw`
          DELETE FROM auth.sessions
           WHERE id = ${row.sessionId}::uuid
             AND user_id = ${subject.supabaseAuthId}::uuid
        `;
      }

      try {
        await prisma.userSession.updateMany({
          where: { id: { in: rows.map((row) => row.id) } },
          data: { revokedAt: new Date() }
        });
      } catch (bookkeepingError) {
        // The sessions are already gone at Supabase and throwing cannot undo
        // that. A 500 here would tell an administrator the device is still
        // signed in when it is not, and pressing the button again changes
        // nothing.
        log.warn(
          { err: String(bookkeepingError) },
          "staff_session_rows_not_marked_revoked"
        );
      }

      log.info({ count: rows.length }, "staff_sessions_revoked");

      return NextResponse.json({ revoked: rows.length });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
