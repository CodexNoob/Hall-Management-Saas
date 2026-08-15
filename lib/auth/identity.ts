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

export type AuthIdentity = { id: string; email: string };

export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
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
  const parsed = claims as { sub?: unknown; email?: unknown } | undefined;

  if (
    error ||
    typeof parsed?.sub !== "string" ||
    typeof parsed.email !== "string"
  ) {
    throw new AuthorizationError(401, "Invalid or expired session.");
  }

  return { id: parsed.sub, email: parsed.email };
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
