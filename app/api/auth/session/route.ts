import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, resolveSupabaseUser } from "@/lib/auth/identity";
import { parseSupabaseProfile } from "@/lib/auth/supabase-profile";
import { ensureProvisionedUser } from "@/lib/auth/provisioning";
import { serializeAuthSession } from "@/lib/auth/session-context";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { AuthorizationError } from "@/lib/auth/errors";

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
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "auth-session",
      limit: 30,
      windowMs: 10 * 60 * 1000
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

    return NextResponse.json(
      serializeAuthSession({
        ...context,
        usesEmailPassword: profile.usesEmailPassword
      })
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Auth session request failed", error);

    // User-facing copy, deliberately left as it was. Renaming the route is a
    // code change; rewording what a user reads when sign-in breaks is a product
    // one, and `getAuthErrorMessage` surfaces this string verbatim.
    return NextResponse.json(
      { error: "Unable to sync the signed-in user. Please try again." },
      { status: 500 }
    );
  }
}
