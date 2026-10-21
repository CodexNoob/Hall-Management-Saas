import { NextResponse } from "next/server";

import { recordActivity } from "@/lib/audit/activity-log";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { resolveAccessToken, resolveSupabaseUser } from "@/lib/auth/identity";
import { syncMfaEnrollment } from "@/lib/auth/mfa";
import { reconcileMfaFactors } from "@/lib/auth/mfa-trust";
import { readSessionId } from "@/lib/auth/session-record";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http/with-route";

/**
 * "I just changed my second factor - go and look."
 *
 * ENROLMENT ITSELF DOES NOT HAPPEN HERE. Setting up a TOTP factor is a
 * conversation between the browser and Supabase: `enroll()` returns a secret
 * that must never touch our servers, and `challengeAndVerify()` is the only
 * thing that can decide whether a six-digit code is right. Putting either
 * behind our API would mean handling a secret we have no reason to hold.
 *
 * What we do need is for `users.mfa_enrolled_at` to catch up, because that
 * mirror is what every other request consults to decide whether this person
 * owes a factor. The session sync refreshes it too, but only on a cold load -
 * and the gap matters in exactly the wrong direction. Somebody who has just
 * finished enrolling would otherwise keep getting in without a code until
 * their client cache lapsed, which is five minutes during which the feature
 * they just switched on does nothing.
 *
 * THE BROWSER REPORTS NOTHING. It says "look again"; the answer comes from
 * `getUser` with the caller's own token. A request body claiming "I am
 * enrolled" would be a client-supplied input to an authorization decision.
 *
 * AND A VERIFIED FACTOR IS NOT AUTOMATICALLY A TRUSTED ONE. A new factor is
 * trusted only while this session holds the email-verified enrollment grant;
 * one without it is removed and reported (lib/auth/mfa-trust.ts). The mirror
 * counts trusted factors only.
 *
 * Exempt from the two-factor check, and one of only three routes that are.
 * Refusing it would be circular: a person enrolling to satisfy an
 * organization policy has not satisfied it yet, and this is the call that
 * records that they now have.
 */
export const POST = withRoute("POST /api/me/mfa", async (request: Request) => {
  try {
    // Both gates: 2FA comes before device confirmation, so the call that
    // records a new factor must answer on a browser not yet confirmed.
    const actor = await authorizeMember(request, {
      allowUnsatisfiedMfa: true,
      allowUnconfirmedDevice: true
    });
    const userId = requireUserActor(actor);
    const token = await resolveAccessToken(request);

    if (!token) {
      return NextResponse.json(
        {
          error:
            "Your session could not be read. Sign in again and retry."
        },
        { status: 400 }
      );
    }

    const supabaseUser = await resolveSupabaseUser(token);

    // What it was, so this can tell an actual change from the panel calling on
    // mount. Only a change is worth an audit row.
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnrolledAt: true, email: true, name: true }
    });

    const audit = {
      organizationId: actor.organizationId,
      userId,
      actorName: actor.actorName
    };
    // Trusts a new factor on this session's grant, or removes it. Records and
    // emails "turned on" / "unverified removed" itself.
    const result = await reconcileMfaFactors({
      userId,
      supabaseAuthId: supabaseUser.id,
      factors: supabaseUser.factors,
      sessionId: readSessionId(token),
      audit,
      owner: {
        email: before?.email ?? supabaseUser.email ?? "",
        name: before?.name ?? actor.actorName
      }
    });

    await syncMfaEnrollment(prisma, {
      userId,
      enrolled: result.trusted,
      enrolledAt: new Date()
    });

    // Turning 2FA OFF is recorded here; turning it on is recorded by the
    // reconcile above, at the moment the factor is trusted.
    if (before?.mfaEnrolledAt && !result.trusted) {
      try {
        await recordActivity(prisma, audit, {
          action: "auth.mfa.disabled",
          message: `${actor.actorName} turned off two-factor authentication.`
        });
      } catch (auditError) {
        // The factor is already gone at Supabase and the mirror is already
        // correct; failing the request would misreport both.
        log.warn({ err: String(auditError) }, "mfa_change_not_recorded");
      }
    }

    return NextResponse.json({
      // Kept for existing callers: "a factor this app counts is in place".
      enrolled: result.trusted,
      trusted: result.trusted,
      removedUntrusted: result.removedUntrusted
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
});
