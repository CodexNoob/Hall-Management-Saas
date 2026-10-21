import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActivity } from "@/lib/audit/activity-log";
import { readDeviceSecret } from "@/lib/auth/device-identity";
import {
  findCurrentDevice,
  listDevices,
  revokeDevice,
  verifyDeviceRemovalCode
} from "@/lib/auth/device-trust";
import { resolveAccessToken } from "@/lib/auth/identity";
import {
  deviceRemovedEmail,
  sendSecurityEmail
} from "@/lib/auth/security-emails";
import { describeUserAgent, readSessionId } from "@/lib/auth/session-record";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";

/**
 * The browsers this person has signed in from - for My Account > Devices.
 *
 * The caller's own rows only; nothing in the request can name anybody else.
 * Each row carries our id, a readable browser name, the approximate place,
 * first/last seen and whether it is trusted. NEVER the device hash, and the
 * secret is not something the server even has.
 */
export const GET = withRoute("GET /api/me/devices", async (request: Request) => {
  try {
    const actor = await authorizeMember(request);
    const userId = requireUserActor(actor);
    const current = await findCurrentDevice(prisma, userId, readDeviceSecret(request));

    return NextResponse.json({
      devices: await listDevices(prisma, userId, current?.id ?? null)
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
});

/**
 * Remove a device - ANY device, the primary included - with the code emailed
 * by `POST /api/me/devices/removal-code`. Body: `{ deviceId, code }`. Primary
 * only decides what "sign out untrusted devices" keeps; it never protects a
 * device from its owner removing it.
 *
 * NOTHING IS REVOKED UNTIL THE CODE IS ACCEPTED - for this session, this
 * device and this purpose (lib/auth/device-trust.ts). A wrong, expired,
 * replayed or locked code changes nothing. Then, in this order:
 *
 *   1. TRUST. The device stops being trusted and forgets any remembered
 *      authenticator. The server refuses that browser's NEXT request -
 *      `resolveUserActor` reads the row every time - so this alone already
 *      locks it out, even while an access token it holds is still unexpired.
 *   2. SESSIONS. Every session recorded on that device is ended (its refresh
 *      token deleted at Supabase), so it cannot quietly renew either. If it is
 *      THIS browser, the current session is ended too and the response says
 *      so; the browser then clears itself and goes to sign-in.
 *   3. NOTICE. The owner is emailed that it happened. A notice that fails to
 *      send never undoes the removal.
 *
 * NOT EXEMPT FROM ANY GATE: the email code confirms a removal by somebody
 * already fully signed in; it never stands in for the second factor.
 *
 * To get back in, that browser is new: the authenticator code if one is set
 * up, then a fresh email code.
 */
const removeSchema = z
  .object({
    deviceId: z.string().uuid("Choose a device to remove."),
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email.")
  })
  .strict();

export const DELETE = withRoute("DELETE /api/me/devices", async (request: Request) => {
  try {
    // Per address. Each code already dies after five wrong entries.
    const limited = await enforceRateLimit(request, {
      scope: "device-remove",
      limit: 30,
      windowMs: 15 * 60 * 1000
    });
    if (limited) return limited;

    const actor = await authorizeMember(request);
    const userId = requireUserActor(actor);
    const { deviceId, code } = removeSchema.parse(await request.json());
    const token = await resolveAccessToken(request);
    const currentSessionId = token ? readSessionId(token) : null;

    if (!currentSessionId) {
      return NextResponse.json(
        { error: "Your session could not be read. Sign in again and retry." },
        { status: 400 }
      );
    }

    // Ownership before the code: somebody else's id, or a device already
    // removed, is "not found" - and no attempt is spent on it.
    const target = await prisma.userDevice.findFirst({
      where: { id: deviceId, userId, revokedAt: null },
      select: { id: true, userAgent: true }
    });

    if (!target) {
      return NextResponse.json({ error: "That device was not found." }, { status: 404 });
    }

    const verification = await verifyDeviceRemovalCode(prisma, {
      userId,
      sessionId: currentSessionId,
      deviceId,
      code
    });

    switch (verification.status) {
      case "verified":
        break;
      case "invalid":
        return NextResponse.json(
          {
            error: "That code is not right. Check the email and try again.",
            attemptsLeft: verification.attemptsLeft
          },
          { status: 400 }
        );
      case "locked":
        return NextResponse.json(
          { error: "Too many incorrect codes. Send a new code and try again." },
          { status: 429 }
        );
      case "expired":
      case "missing":
        return NextResponse.json(
          { error: "This code has expired or was already used. Send a new one." },
          { status: 410 }
        );
    }

    // Before the removal: afterwards `findCurrentDevice` no longer finds a
    // revoked row, and we would lose whether this is the browser asking.
    const current = await findCurrentDevice(prisma, userId, readDeviceSecret(request));
    const isCurrentDevice = current?.id === deviceId;

    const removed = await revokeDevice(prisma, { userId, deviceId });

    if (!removed) {
      // Removed by another request between the check and now. The code is
      // spent either way; there is nothing left to remove.
      return NextResponse.json({ error: "That device was not found." }, { status: 404 });
    }

    const endedSessions = await endDeviceSessions({
      userId,
      deviceId,
      // The current session is on the removed device even if its row was
      // recorded before sessions were linked to devices.
      alsoSessionId: isCurrentDevice ? currentSessionId : null
    });

    try {
      await recordActivity(
        prisma,
        { organizationId: actor.organizationId, userId, actorName: actor.actorName },
        {
          action: "auth.sessions.revoked",
          message: isCurrentDevice
            ? `${actor.actorName} removed this device and signed it out.`
            : `${actor.actorName} removed a device and signed it out.`
        }
      );
    } catch (auditError) {
      // The removal has happened; failing now would misreport it.
      log.warn({ err: String(auditError) }, "device_removal_not_recorded");
    }

    await notifyDeviceRemoved(userId, target.userAgent);

    return NextResponse.json({
      removed: true,
      endedSessions,
      // This browser's trust is gone either way, so it must leave even if
      // ending the session at Supabase failed: the server refuses it already.
      endedCurrentSession: isCurrentDevice
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
});

/**
 * "A device was removed" to the account's own address. Never throws and never
 * undoes anything: `sendSecurityEmail` reports failure instead of raising, and
 * logs the kind and outcome only - never the address or the body.
 */
async function notifyDeviceRemoved(userId: string, userAgent: string | null) {
  try {
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true }
    });

    if (!owner) return;

    await sendSecurityEmail(
      "device_removed",
      owner.email,
      deviceRemovedEmail({
        name: owner.name,
        device: describeUserAgent(userAgent) ?? userAgent,
        when: new Date()
      })
    );
  } catch (notifyError) {
    log.warn({ userId, err: String(notifyError) }, "device_removed_notice_failed");
  }
}

/**
 * End every live session recorded on one device - deleting its refresh session
 * from `auth.sessions` and marking our row - in one statement, scoped to the
 * caller on BOTH sides exactly as `DELETE /api/me/sessions` is.
 *
 * Never throws. The device is already untrusted and refused by the server; a
 * failure here only means a session survives until its token expires, so it
 * is logged rather than turned into an error that misreports the removal.
 */
async function endDeviceSessions(input: {
  userId: string;
  deviceId: string;
  alsoSessionId: string | null;
}) {
  try {
    const account = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { supabaseAuthId: true }
    });

    if (!account?.supabaseAuthId) {
      log.warn({ userId: input.userId }, "device_sessions_not_ended");
      return 0;
    }

    const ended = await prisma.$queryRaw<Array<{ sessionId: string }>>`
      WITH eligible_sessions AS MATERIALIZED (
      SELECT app_session.session_id
        FROM public.user_sessions AS app_session
       WHERE app_session.user_id = ${input.userId}::uuid
         AND app_session.revoked_at IS NULL
         AND (
           app_session.device_id = ${input.deviceId}::uuid
           OR app_session.session_id = ${input.alsoSessionId ?? ""}
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
       WHERE app_session.user_id = ${input.userId}::uuid
         AND app_session.session_id = eligible_sessions.session_id
         AND app_session.revoked_at IS NULL
      RETURNING app_session.session_id
      )
      SELECT session_id AS "sessionId"
      FROM marked_app_sessions
    `;

    log.info({ userId: input.userId, count: ended.length }, "device_sessions_ended");

    return ended.length;
  } catch (endError) {
    log.warn(
      { userId: input.userId, err: String(endError) },
      "device_sessions_not_ended"
    );
    return 0;
  }
}
