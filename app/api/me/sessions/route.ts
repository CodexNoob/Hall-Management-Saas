import { NextResponse } from "next/server";

import { recordActivity } from "@/lib/audit/activity-log";
import { readDeviceSecret } from "@/lib/auth/device-identity";
import { findCurrentDevice, revokeAllDevices } from "@/lib/auth/device-trust";
import { isDeviceTrusted } from "@/lib/auth/device-trust-policy";
import {
  sendSecurityEmail,
  sessionSignedOutEmail
} from "@/lib/auth/security-emails";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { resolveAccessToken } from "@/lib/auth/identity";
import { describeUserAgent, readSessionId } from "@/lib/auth/session-record";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { withRoute } from "@/lib/http/with-route";

/**
 * Sign out sessions on untrusted devices.
 *
 * WHY THIS IS THE CONTROL, RATHER THAN A LIST OF SESSIONS. An access token
 * cannot be withdrawn once issued - it is a signed assertion, valid until it
 * expires. Every system that offers "sign out everywhere" is really revoking
 * the REFRESH side: the short-lived token dies on its own within the hour, and
 * the thing that would have renewed it is gone. Supabase already implements
 * that half, so this is the button in front of it rather than a mechanism of
 * our own.
 *
 * `scope: "others"` keeps the caller signed in. `scope: "all"` revokes every
 * tracked session except those associated with the one confirmed primary
 * device. This avoids Supabase's global sign-out, which cannot preserve a
 * trusted device separately.
 *
 * Server-side rather than straight from the browser, which could call
 * `signOut({ scope: "others" })` on its own. Two reasons: the act is recorded
 * where every other privileged act is recorded, and `auth.admin.signOut` takes
 * the JWT explicitly - so what gets revoked is the session this request
 * authenticated with, not whatever the browser's client happens to hold.
 *
 * Deliberately NOT a permission check beyond membership. Signing out your own
 * other devices escalates nothing, and it is most needed by the person who has
 * just realised something is wrong.
 */
/**
 * Where this person is signed in.
 *
 * Recorded by the session sync rather than read from Supabase, which has no
 * endpoint that enumerates sessions. The rows are this person's own and the
 * query says so - there is no parameter here that could ask for somebody
 * else's.
 */
export const GET = withRoute(
  "GET /api/me/sessions",
  async (request: Request) => {
    try {
      const actor = await authorizeMember(request);
      const userId = requireUserActor(actor);
      const token = await resolveAccessToken(request);
      const currentSessionId = token ? readSessionId(token) : null;
      const now = new Date();

      const sessions = await prisma.userSession.findMany({
        where: { userId, revokedAt: null },
        orderBy: { lastSeenAt: "desc" },
        select: {
          id: true,
          sessionId: true,
          userAgent: true,
          ipAddress: true,
          city: true,
          region: true,
          country: true,
          createdAt: true,
          lastSeenAt: true,
          device: {
            select: {
              isPrimary: true,
              confirmedAt: true,
              trustExpiresAt: true,
              revokedAt: true
            }
          }
        }
      });

      return NextResponse.json({
        sessions: sessions.map((session) => ({
          id: session.id,
          // The device label, plus the raw string as a fallback: a user-agent the
          // parser does not know is still something its owner may recognise.
          device: describeUserAgent(session.userAgent) ?? session.userAgent,
          ipAddress: session.ipAddress,
          city: session.city,
          // State or province, where the edge resolved one. Null in a country
          // whose city names are unambiguous, which is correct rather than a gap.
          region: session.region,
          // The code, not a name: the screen renders it in whichever language
          // the reader has chosen, so one row reads "Philippines" or "Filipinas"
          // depending on who is looking.
          country: session.country,
          createdAt: session.createdAt,
          lastSeenAt: session.lastSeenAt,
          // So the screen can say "this device" and not invite somebody to
          // wonder whether the row they are looking at is themselves.
          current: session.sessionId === currentSessionId,
          // The SAME rule the device gate enforces (confirmed, not removed,
          // inside its trust period) - so a trusted secondary is labelled
          // trusted, instead of looking untrusted beside the primary.
          trustedDevice: isDeviceTrusted(session.device, now),
          primaryDevice: Boolean(session.device?.isPrimary)
        }))
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

/**
 * Ending sessions - one, every other one, every untrusted device, or all.
 *
 * FOUR SCOPES, AND THEY ARE NOT THE SAME ACT:
 *
 *   ?sessionId=<row id>  one session. "That laptop, not this phone."
 *   (nothing)            "Sign out other sessions": every other session ends,
 *                        this one stays signed in, and NO device loses its
 *                        trust - this device included.
 *   ?scope=all           "Sign out untrusted devices": sessions on untrusted
 *                        devices. The confirmed primary device remains signed
 *                        in. Unchanged; `all` predates the scope below and
 *                        keeps its meaning.
 *   ?scope=all-devices   "Sign out all devices": every device loses its trust
 *                        (primary included) and every session ends, this one
 *                        too. Each browser must be verified again from scratch.
 *
 * WHY ONE DEVICE IS DIFFERENT FROM THE OTHER TWO. Supabase's admin API has no
 * call that revokes a single session: `auth.admin.signOut` takes a JWT and a
 * scope, and the scopes are local / others / global. So the single-session path
 * deletes the row from `auth.sessions` directly, which is what revokes the
 * refresh token underneath. That is reaching into the auth schema and it is
 * done deliberately and narrowly - the DELETE is scoped to BOTH the session id
 * and the caller's own `user_id`, so the worst a forged id can do is delete a
 * session that is already the caller's.
 *
 * The id the browser sends is OUR row id, never the Supabase session id. That
 * id is deliberately never sent to the client (see the GET above), and the row
 * is looked up under `userId` before anything is deleted - so "revoke session
 * X" cannot be pointed at somebody else's device by editing a request.
 */
export const DELETE = withRoute(
  "DELETE /api/me/sessions",
  async (request: Request) => {
    try {
      const actor = await authorizeMember(request);
      const userId = requireUserActor(actor);
      // From the header or the cookie - the dashboard uses the cookie for
      // everything except the session sync, so reading only the header
      // refused every real browser while passing every test.
      const token = await resolveAccessToken(request);

      if (!token) {
        return NextResponse.json(
          {
            error:
              "Your session could not be read, so nothing was signed out. Sign in again and retry."
          },
          { status: 400 }
        );
      }

      const url = new URL(request.url);
      const targetRowId = url.searchParams.get("sessionId")?.trim() || null;

      if (targetRowId) {
        return revokeOneSession({
          actor,
          userId,
          rowId: targetRowId,
          actingUserAgent: request.headers.get("user-agent")
        });
      }

      const scopeParam = url.searchParams.get("scope");
      const scope =
        scopeParam === "all"
          ? "all"
          : scopeParam === "all-devices"
            ? "all-devices"
            : "others";
      const currentSessionId = readSessionId(token);
      let endedCurrentSession = false;

      if (scope === "all-devices") {
        // TRUST FIRST. Once every device row is revoked the server refuses
        // every browser on its next request - including one whose access token
        // has not expired yet - so a failure in the sign-out below still
        // leaves the account in the safe state rather than the open one.
        await revokeAllDevices(prisma, { userId });

        // Then every refresh session, this one included. `global` is the call
        // that does exactly that; it is the right tool here because nothing
        // is being preserved.
        const supabase = createSupabaseServiceClient();
        const { error } = await supabase.auth.admin.signOut(token, "global");

        if (error) throw error;

        endedCurrentSession = true;
      } else if (scope === "all") {
        const account = await prisma.user.findUnique({
          where: { id: userId },
          select: { supabaseAuthId: true }
        });

        if (!account?.supabaseAuthId) {
          return NextResponse.json(
            {
              error:
                "Your sessions could not be ended. Sign in again and retry."
            },
            { status: 409 }
          );
        }

        const currentDevice = await findCurrentDevice(
          prisma,
          userId,
          readDeviceSecret(request)
        );
        const currentPrimaryDeviceId =
          currentDevice?.isPrimary &&
          currentDevice.trustedAt &&
          !currentDevice.revokedAt
            ? currentDevice.id
            : null;

        // Supabase has no selectively scoped admin call. In one statement,
        // revoke every tracked non-primary refresh session and mark its local
        // row ended. The current request's device cookie also lets us preserve
        // its primary session when it predates the new session-device link.
        const endedSessions = await prisma.$queryRaw<
          Array<{ sessionId: string }>
        >`
          WITH eligible_sessions AS MATERIALIZED (
          SELECT app_session.session_id
            FROM public.user_sessions AS app_session
           WHERE app_session.user_id = ${userId}::uuid
             AND app_session.revoked_at IS NULL
             AND NOT EXISTS (
               SELECT 1
                 FROM public.user_devices AS primary_device
                WHERE primary_device.user_id = app_session.user_id
                  AND primary_device.is_primary = TRUE
                  AND primary_device.trusted_at IS NOT NULL
                  AND primary_device.revoked_at IS NULL
                  AND (
                    primary_device.id = app_session.device_id
                    OR (
                      app_session.session_id = ${currentSessionId ?? ""}
                      AND primary_device.id = ${currentPrimaryDeviceId}::uuid
                    )
                  )
             )
          ),
          revoked_auth_sessions AS (
          DELETE FROM auth.sessions AS auth_session
           USING eligible_sessions
           WHERE auth_session.id::text = eligible_sessions.session_id
             AND auth_session.user_id = ${account.supabaseAuthId}::uuid
          RETURNING auth_session.id
          ),
          marked_app_sessions AS (
          UPDATE public.user_sessions AS app_session
             SET revoked_at = NOW()
            FROM eligible_sessions
           WHERE app_session.user_id = ${userId}::uuid
             AND app_session.session_id = eligible_sessions.session_id
             AND app_session.revoked_at IS NULL
          RETURNING app_session.session_id
          )
          SELECT session_id AS "sessionId"
          FROM marked_app_sessions
        `;

        endedCurrentSession = Boolean(
          currentSessionId &&
          endedSessions.some(
            (session) => session.sessionId === currentSessionId
          )
        );
      } else {
        const supabase = createSupabaseServiceClient();
        const { error } = await supabase.auth.admin.signOut(token, "others");

        if (error) throw error;
      }

      // The revocation has happened and cannot be undone by throwing. A 500
      // from this bookkeeping would tell somebody their devices are still
      // signed in when they are not.

      try {
        if (scope === "others") {
          await prisma.userSession.updateMany({
            where: {
              userId,
              revokedAt: null,
              ...(currentSessionId
                ? { sessionId: { not: currentSessionId } }
                : {})
            },
            data: { revokedAt: new Date() }
          });
        } else if (scope === "all-devices") {
          // Every row, this one included - matching what `global` revoked.
          await prisma.userSession.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() }
          });
        }
      } catch (bookkeepingError) {
        // Worth a line rather than silence: the revocation worked and the list
        // is now stale, which is exactly the state somebody would report as
        // "it did not work".
        log.warn(
          { err: String(bookkeepingError) },
          "session_rows_not_marked_revoked"
        );
      }

      try {
        await recordActivity(
          prisma,
          {
            organizationId: actor.organizationId,
            userId,
            actorName: actor.actorName
          },
          {
            action: "auth.sessions.revoked",
            message:
              scope === "all-devices"
                ? `${actor.actorName} signed out of all devices and removed their trust.`
                : scope === "all"
                  ? `${actor.actorName} signed out sessions on untrusted devices.`
                  : `${actor.actorName} signed out their other sessions.`
          }
        );
      } catch (auditError) {
        // Same reasoning, and this one matters more: an audit row that did not
        // write is a gap somebody may have to account for later, so it is said
        // out loud instead of being lost behind a 500 that also misreports the
        // outcome.
        log.warn(
          { err: String(auditError) },
          "session_revocation_not_recorded"
        );
      }

      log.info(
        {
          scope:
            scope === "all-devices"
              ? "all_devices"
              : scope === "all"
                ? "untrusted_devices"
                : "others"
        },
        "sessions_revoked"
      );

      return NextResponse.json({ revoked: true, endedCurrentSession });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

/**
 * End one device, and only that one.
 *
 * Supabase has no admin call for this - `auth.admin.signOut` revokes by scope,
 * never by id - so the session row is deleted from `auth.sessions` directly,
 * which is what invalidates its refresh token. The access token it already
 * holds stays valid until it expires, within the hour, exactly as it does for
 * the other two scopes: a signed assertion cannot be withdrawn, and revoking
 * the refresh side is what every "sign out this device" control really does.
 *
 * TWO SCOPES ON THE DELETE, BOTH REQUIRED. The row is first looked up by our id
 * AND `userId`, so a request naming somebody else's row finds nothing. The SQL
 * then repeats the ownership check against `auth.sessions.user_id`, so even a
 * mistake in the lookup above cannot end a stranger's session.
 */
async function revokeOneSession(input: {
  actor: { organizationId: string; actorName: string };
  userId: string;
  rowId: string;
  /** The browser doing the signing out, for the owner's email. */
  actingUserAgent: string | null;
}) {
  const { actor, userId, rowId } = input;

  const row = await prisma.userSession.findFirst({
    // `userId` here is the ownership check, not a filter for convenience.
    where: { id: rowId, userId, revokedAt: null },
    select: { id: true, sessionId: true, userAgent: true }
  });

  if (!row) {
    // Also the answer for a row that belongs to somebody else. Existence is
    // information, and "no such session" is the honest thing to say to a
    // request that had no business naming it.
    return NextResponse.json(
      { error: "That session was not found." },
      { status: 404 }
    );
  }

  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { supabaseAuthId: true, email: true, name: true }
  });

  if (!account?.supabaseAuthId) {
    return NextResponse.json(
      { error: "That session could not be ended. Sign in again and retry." },
      { status: 409 }
    );
  }

  await prisma.$executeRaw`
    DELETE FROM auth.sessions
     WHERE id = ${row.sessionId}::uuid
       AND user_id = ${account.supabaseAuthId}::uuid
  `;

  // Bookkeeping, on the same terms as the bulk path: the session is already
  // gone at Supabase and a failure here must not report otherwise.
  try {
    await prisma.userSession.update({
      where: { id: row.id },
      data: { revokedAt: new Date() }
    });
  } catch (bookkeepingError) {
    log.warn(
      { err: String(bookkeepingError) },
      "session_row_not_marked_revoked"
    );
  }

  try {
    await recordActivity(
      prisma,
      {
        organizationId: actor.organizationId,
        userId,
        actorName: actor.actorName
      },
      {
        action: "auth.sessions.revoked",
        message: `${actor.actorName} signed out one of their devices.`
      }
    );
  } catch (auditError) {
    log.warn({ err: String(auditError) }, "session_revocation_not_recorded");
  }

  log.info({ scope: "one" }, "sessions_revoked");

  /**
   * Tell the owner. Signing out a session is something any trusted device of
   * theirs may do - including to the primary - so the person whose session
   * just ended hears about it, and from which device, wherever they are.
   * `sendSecurityEmail` never throws and logs only the kind and outcome; a
   * notice that fails never undoes the sign-out.
   */
  await sendSecurityEmail(
    "session_signed_out",
    account.email,
    sessionSignedOutEmail({
      name: account.name,
      device: describeUserAgent(row.userAgent) ?? row.userAgent,
      by: describeUserAgent(input.actingUserAgent) ?? input.actingUserAgent,
      when: new Date()
    })
  );

  return NextResponse.json({ revoked: true, endedCurrentSession: false });
}
