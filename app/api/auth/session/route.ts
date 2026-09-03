import { NextResponse } from "next/server";
import { getBearerToken, resolveSupabaseUser } from "@/lib/auth/identity";
import { parseSupabaseProfile } from "@/lib/auth/supabase-profile";
import { ensureProvisionedUser } from "@/lib/auth/provisioning";
import { serializeAuthSession, widestScope } from "@/lib/auth/session-context";
import { effectiveAccessByPrincipal } from "@/lib/authz/decide";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { AuthorizationError } from "@/lib/auth/errors";
import type { PermissionKey } from "@/lib/authz/catalog";
import { log } from "@/lib/logging/context";
import { withRoute } from "@/lib/http/with-route";

/**
 * Just-in-time provisioning for a signed-in Supabase account.
 *
 * The handler is deliberately four steps with no branches of its own -
 * verify, read, reconcile, serialize. Everything that used to make this file
 * 290 lines now lives in a module that can be tested on its own:
 *
 *   lib/auth/identity.ts         - which credential, and is it real
 *   lib/auth/supabase-profile.ts - what Supabase says about the account
 *   lib/auth/provisioning.ts     - what our database needs to look like
 *   lib/auth/session-context.ts  - what the browser gets back
 *
 * Every expected failure is an `AuthorizationError` subclass carrying its own
 * status and its own copy - the 403 text in particular is shown to the user
 * verbatim by `getAuthErrorMessage`, so it must survive the trip out.
 */
export const POST = withRoute(
  "POST /api/auth/session",
  async (request: Request) => {
    try {
      // A PER-PAGE-LOAD READ, NOT AN ACTION.
      //
      // Every other limiter in this app guards something a person does on
      // purpose - an import, an invite, a checkout - so a tight allowance over a
      // long window is right: nobody legitimately invites ten people a minute.
      // This endpoint is the opposite. It is what `fetchAuthSession` calls on
      // every cold dashboard load whose 5-minute client cache has lapsed, so its
      // traffic scales with how many people are looking at the dashboard rather
      // than with anything they chose to do.
      //
      // The bucket is keyed by IP (lib/security/rate-limit.ts), and a venue's
      // staff all share one. At 30 per 10 minutes an office of more than about
      // fifteen locked ITSELF out - "Too many requests" in place of the whole
      // dashboard, for ten minutes, with no action to point at. The window is a
      // minute now for the same reason: a burst that does trip this recovers
      // while somebody is still looking at the retry button, instead of poisoning
      // the next ten minutes.
      //
      // Still a real flood guard. A request only reaches here with a bearer token
      // that costs a Supabase user lookup to verify, and 2/second per address
      // caps that regardless of how many tabs are asking.
      const limited = await enforceRateLimit(request, {
        scope: "auth-session",
        limit: 120,
        windowMs: 60_000
      });
      if (limited) return limited;

      const token = getBearerToken(request);

      if (!token) {
        return NextResponse.json(
          { error: "Missing bearer token." },
          { status: 401 }
        );
      }

      const profile = parseSupabaseProfile(await resolveSupabaseUser(token));
      const context = await ensureProvisionedUser(profile);

      // The organization this response tells the client to START in - the user's
      // primary one, not whatever a stale cookie last hinted at. `memberships` is
      // guaranteed non-empty: `ensureProvisionedUser` throws when it is not.
      const active =
        context.memberships.find(
          (membership) =>
            membership.organizationId === context.user.organizationId
        ) ?? context.memberships[0];

      // The same resolver, the same rows, the same fold the server enforces with.
      // What the browser is told and what a route decides cannot disagree, because
      // there is only one place either could come from (INV-2).
      const access = await effectiveAccessByPrincipal(
        active.principalId,
        active.organizationId,
        active.organization.permissionsEpoch
      );

      return NextResponse.json(
        serializeAuthSession({
          ...context,
          // Sorted so a re-fetch that changed nothing produces a byte-identical
          // cache entry, and the browser's own comparison stays trivial.
          permissions: [...access.permissions.keys()].sort() as PermissionKey[],
          scope: widestScope(access.permissions.values()),
          epoch: Number(active.organization.permissionsEpoch),
          usesEmailPassword: profile.usesEmailPassword
        })
      );
    } catch (error) {
      if (error instanceof AuthorizationError) {
        // `code` alongside the prose, because the two refusals that are terminal -
        // no invitation, deactivated account - have to be told apart from a
        // transient 500 by the caller. The browser ends the Supabase session on
        // those, and it must not decide that by matching on a message.
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        );
      }

      log.error(
        {
          err:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : { name: "NonError", message: String(error) },
          status: 500
        },
        "auth_session_request_failed"
      );

      // User-facing copy, deliberately left as it was. Renaming the route is a
      // code change; rewording what a user reads when sign-in breaks is a product
      // one, and `getAuthErrorMessage` surfaces this string verbatim.
      return NextResponse.json(
        { error: "Unable to sync the signed-in user. Please try again." },
        { status: 500 }
      );
    }
  }
);
