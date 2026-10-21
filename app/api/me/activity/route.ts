import { NextResponse } from "next/server";

import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { resolveAccessToken } from "@/lib/auth/identity";
import { readSessionId } from "@/lib/auth/session-record";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http/with-route";

/**
 * "A person just did something on this device."
 *
 * The signal the inactivity timeout reads, and it needs to exist separately
 * from everything else this application already records.
 *
 * WHY `last_seen_at` COULD NOT BE USED. That column is touched by
 * `POST /api/auth/session`, which the dashboard polls every sixty seconds
 * while the tab is VISIBLE. Tab visible is not user active: a screen left open
 * on a desk refreshes itself forever, so a timeout built on it would never fire
 * for precisely the screen it exists to protect. `last_seen_at` answers "is
 * this session still alive" and has to go on answering only that.
 *
 * SENT ON REAL INTERACTION, THROTTLED HARD. The browser fires this at most once
 * every few minutes, and only after a click, a keypress or a scroll - so it
 * costs about one request per five minutes per person who is actually working,
 * and nothing at all for a screen nobody is touching.
 *
 * DELIBERATELY NOT EXEMPT from the inactivity check itself. A session that has
 * already passed the limit gets a 401 from `authorizeMember` before reaching
 * this line, which is correct: a ping must never be able to resurrect a session
 * the server has already decided is over.
 */
export const POST = withRoute(
  "POST /api/me/activity",
  async (request: Request) => {
    try {
      const actor = await authorizeMember(request);
      const userId = requireUserActor(actor);
      const token = await resolveAccessToken(request);
      const sessionId = token ? readSessionId(token) : null;

      // No session to stamp. Not an error - a caller with no `session_id`
      // claim is one the inactivity check already fails open for, so there is
      // nothing to record and nothing to complain about.
      if (!sessionId) return NextResponse.json({ recorded: false });

      // `updateMany` rather than `update`, and scoped by `userId` as well as by
      // the session id: it writes nothing rather than throwing when the row is
      // absent, and the ownership filter means a session id from a token this
      // process did not verify still cannot stamp somebody else's row.
      const { count } = await prisma.userSession.updateMany({
        where: { sessionId, userId, revokedAt: null },
        data: { lastActiveAt: new Date() }
      });

      return NextResponse.json({ recorded: count > 0 });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

/**
 * Mark this device as a shared display, or stop.
 *
 * The kitchen board on the wall is unattended by design - nobody touches it for
 * three hours at a stretch and that is it working. Without this it would be
 * signed out mid-service.
 *
 * PER DEVICE, SET FROM THAT DEVICE. Whoever signs the board in ticks the box on
 * the board, which is the only place somebody can actually see which screen
 * they are describing. It is scoped to the caller's own session for the same
 * reason everything in `/api/me/` is: there is no id here that could name
 * somebody else's device.
 *
 * Audited, because it is an exemption from a security control.
 */
export const PATCH = withRoute(
  "PATCH /api/me/activity",
  async (request: Request) => {
    try {
      const actor = await authorizeMember(request);
      const userId = requireUserActor(actor);
      const token = await resolveAccessToken(request);
      const sessionId = token ? readSessionId(token) : null;

      if (!sessionId) {
        return NextResponse.json(
          { error: "This device could not be identified." },
          { status: 400 }
        );
      }

      const body = (await request.json().catch(() => null)) as {
        sharedDevice?: unknown;
      } | null;

      if (typeof body?.sharedDevice !== "boolean") {
        return NextResponse.json(
          { error: "Say whether this is a shared display." },
          { status: 400 }
        );
      }

      const { count } = await prisma.userSession.updateMany({
        where: { sessionId, userId, revokedAt: null },
        data: { sharedDevice: body.sharedDevice }
      });

      if (count === 0) {
        return NextResponse.json(
          { error: "This device could not be identified." },
          { status: 404 }
        );
      }

      // An exemption from a security control is worth being able to
      // reconstruct later. `sharedDevice` is a boolean, not tenant data.
      log.info(
        { sharedDevice: body.sharedDevice },
        "session_shared_device_changed"
      );

      return NextResponse.json({ sharedDevice: body.sharedDevice });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
