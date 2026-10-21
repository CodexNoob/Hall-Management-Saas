import "server-only";

import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  createSupabaseServerClient,
  createSupabaseTokenVerifier
} from "@/lib/supabase/server";
import { isSupabaseAuthCookieName } from "@/lib/supabase/cookie-policy";
import { AuthorizationError } from "@/lib/auth/errors";

/**
 * Layer 1 of the auth stack: turn a credential into a verified identity, and
 * nothing more. It knows about bearer tokens, cookies and Supabase; it knows
 * nothing about our database, our organizations or our roles.
 *
 * Keeping this separate is what makes a second identity provider a change to
 * one file instead of a change to the provisioning path and all 39 protected
 * routes.
 */

/**
 * `aal2` once a second factor has been cleared on this session, `aal1` before
 * it, and null when the token carries no claim at all - an older token, or a
 * shape we do not recognise.
 *
 * Null is treated as `aal1` by everything that enforces. The safe reading of
 * "this token does not say whether a factor was cleared" is that one was not.
 */
export type AssuranceLevel = "aal1" | "aal2";

export type AuthIdentity = {
  id: string;
  email: string;
  /**
   * Read from the VERIFIED claims, which is the only way it may be read.
   *
   * `readSessionId` decodes a token's payload without checking the signature,
   * and that is fine for what it does - matching a session to a row we already
   * own. Doing the same here would be an authorization bypass with a
   * base64 encoder for an exploit: anyone can mint a payload that says `aal2`.
   */
  assuranceLevel: AssuranceLevel | null;
  /**
   * The `session_id` claim, from the VERIFIED claims.
   *
   * Which of this account's sessions is making the request - what the
   * inactivity check needs in order to ask "when did somebody last do something
   * on THIS device", rather than on any device the account owns.
   *
   * Null when the token carries no claim. Everything downstream treats that as
   * "cannot tell", which fails open: a session we cannot identify is never one
   * we sign out.
   */
  sessionId: string | null;
};

export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

/**
 * The caller's access token, from whichever transport they used.
 *
 * Almost nothing needs this - a route wants to know WHO is calling, and
 * `authorize` answers that without the token ever being handled. The exception
 * is talking to Supabase about the caller's own session: `auth.admin.signOut`
 * takes a JWT, and the `session_id` claim is what identifies one session among
 * several.
 *
 * Both transports, because the dashboard uses neither consistently. The session
 * sync sends an explicit `Authorization` header; every other call from the
 * browser sends none at all and relies on the cookie, which is the design
 * `lib/http/authenticated-fetch.ts` settled on - the token travels once, not
 * twice. A route that assumed the header was always there would work in tests,
 * work for the Playwright fixture, and fail for every real browser.
 *
 * `getSession` rather than `getUser`, and only because this is not an identity
 * check: the caller has already been authenticated by the time anything calls
 * this, and what is wanted here is the token string itself, which `getUser`
 * does not return. Never use this to decide who somebody is.
 */
export async function resolveAccessToken(
  request: Request
): Promise<string | null> {
  const bearer = getBearerToken(request);

  if (bearer) return bearer;

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the caller from either transport.
 *
 * Bearer is tried first and kept deliberately: the Playwright mutation fixture
 * and any non-browser caller still send one, and an explicit credential should
 * win over whatever the ambient cookie jar happens to hold.
 *
 * The cookie path is what lets a Server Component call these helpers at all -
 * it has no Request to hand in, which is why `request` is optional.
 *
 * Uses getClaims() rather than getUser(): it verifies the JWT signature locally
 * against the project's public signing key, so this costs no round trip to the
 * Auth server on a path that every one of the API routes runs. (With a legacy
 * HS256 secret it falls back to getUser() internally, so it is never weaker
 * than what it replaced.) The one thing local verification cannot see is a
 * Supabase-side ban issued mid-token, and that is covered by the `isActive`
 * check `requireAuthenticatedUser` makes against our own database, which is the
 * flag this app actually deactivates people with.
 */
export async function resolveAuthIdentity(
  request?: Request
): Promise<AuthIdentity> {
  const token = request ? getBearerToken(request) : null;

  if (token) {
    const supabase = createSupabaseTokenVerifier();
    const { data, error } = await supabase.auth.getClaims(token);

    return toIdentity(data?.claims, error);
  }

  // Checked before building a client so that "no credential at all" and
  // "credential present but unusable" stay distinguishable. All 39 protected
  // routes surface these two strings, and collapsing them would report an
  // expired session as a missing one.
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((cookie) => isSupabaseAuthCookieName(cookie.name));

  if (!hasAuthCookie) {
    throw new AuthorizationError(401, "Authentication required.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  return toIdentity(data?.claims, error);
}

function toIdentity(claims: unknown, error: unknown): AuthIdentity {
  const parsed = claims as
    | { sub?: unknown; email?: unknown; aal?: unknown; session_id?: unknown }
    | undefined;

  if (
    error ||
    typeof parsed?.sub !== "string" ||
    typeof parsed.email !== "string"
  ) {
    throw new AuthorizationError(401, "Invalid or expired session.");
  }

  return {
    id: parsed.sub,
    email: parsed.email,
    assuranceLevel: toAssuranceLevel(parsed.aal),
    sessionId:
      typeof parsed.session_id === "string" && parsed.session_id
        ? parsed.session_id
        : null
  };
}

/**
 * Anything other than the two levels Supabase actually issues is null rather
 * than a guess. A token claiming "aal3" is not a stronger session, it is a
 * token we do not understand - and everything that enforces reads null as
 * `aal1`.
 */
function toAssuranceLevel(aal: unknown): AssuranceLevel | null {
  if (aal === "aal2") return "aal2";
  if (aal === "aal1") return "aal1";

  return null;
}

/**
 * The assurance level of a specific token, verified.
 *
 * For the session sync, which holds a bearer token and has to report what that
 * session still owes rather than decide anything about the current request.
 *
 * Deliberately `getClaims` and not a base64 decode of the payload. The claim
 * being read is the one the entire two-factor feature turns on, and anybody
 * can write `"aal":"aal2"` into a payload - it is the signature that makes it
 * mean something. This route runs on a cold load rather than on every request,
 * so the verification is affordable, and with asymmetric signing keys it does
 * not leave the process anyway.
 */
export async function resolveAssuranceLevel(
  token: string
): Promise<AssuranceLevel | null> {
  try {
    const supabase = createSupabaseTokenVerifier();
    const { data, error } = await supabase.auth.getClaims(token);

    if (error) return null;

    return toAssuranceLevel(
      (data?.claims as { aal?: unknown } | undefined)?.aal
    );
  } catch {
    // Never fails its caller. The one caller is the session sync, which is how
    // the dashboard loads AT ALL - a throw here would turn "we could not read
    // one claim" into "nobody can sign in", and this claim only decides which
    // screen to show. Null is the safe answer: everything downstream reads it
    // as `aal1`, so a reader that breaks asks for a code rather than skipping
    // one.
    return null;
  }
}

/**
 * The full Supabase user behind a bearer token, not just its claims.
 *
 * Provisioning needs `user_metadata` (the display name, phone and venue the
 * sign-up form collected), `app_metadata.providers` (whether a password is even
 * applicable) and `last_sign_in_at` - none of which the verified JWT claims
 * carry. That makes the round trip to the Auth server unavoidable here, and
 * acceptable: this runs on sign-in and on a cache miss, not on every request
 * the way `resolveAuthIdentity` does.
 */
export async function resolveSupabaseUser(token: string): Promise<User> {
  const supabase = createSupabaseTokenVerifier();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user?.email) {
    throw new AuthorizationError(401, "Invalid Supabase session.");
  }

  return data.user;
}
