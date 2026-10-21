import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getDashboardLoginPath,
  getSafeDashboardReturnPath
} from "@/lib/auth/redirect";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  DESKTOP_APP_COOKIE,
  REMEMBER_AUTH_COOKIE,
  REMEMBER_UNTIL_COOKIE,
  authCookieMaxAge,
  isRememberWindowExpired,
  isSupabaseAuthCookieName,
  isSupabaseSessionCookieName,
  mergeAuthCookieOptions
} from "@/lib/supabase/cookie-policy";
import { log } from "@/lib/logging/context";

/**
 * Server-side session refresh, run before every navigation. Backs the `proxy`
 * file convention (Next 16's rename of `middleware`).
 *
 * Next 16 runs proxy on the **Node.js** runtime, always - route segment config
 * is rejected in that file - so the Edge restrictions that applied to
 * middleware are gone. The import list is still deliberately minimal, for
 * reasons that outlive the runtime:
 *
 * - This runs on *every* navigation. Reaching `@/lib/prisma` here would open a
 *   `pg` pool and issue a query per page view, including for anonymous traffic
 *   on the marketing site.
 * - `@/lib/env`'s getEnv() throws on a missing variable. One unset value would
 *   then 500 the public site rather than degrade, which is why the two Supabase
 *   variables below are read straight off `process.env`.
 * - `next/headers` (and therefore `@/lib/supabase/server`) is not usable here;
 *   cookies come off the NextRequest instead.
 *
 * Authorization deliberately does NOT happen here. `canAccessDashboardRoute`
 * needs the Prisma `access` row, so per-route permission checks stay in the
 * dashboard layout and in the individual route handlers. This is one coarse
 * signed-in-or-not gate and nothing more.
 */

/**
 * @supabase/ssr hands these to `setAll` alongside the cookies. Applying them is
 * not optional: a response that carries `Set-Cookie` for a refreshed session
 * must never be cached, or a CDN or reverse proxy can serve one user's token to
 * the next visitor. Kept here as well so the paths that expire cookies without
 * going through `setAll` can apply the same protection.
 */
const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache"
};

const PROTECTED_PATH_PREFIX = "/dashboard";

/**
 * Pages that only make sense without a session. A signed-in visitor is sent to
 * the dashboard instead of being shown a sign-in form they cannot use.
 *
 * Exact paths, never a prefix, and the list is deliberately this short. The
 * other credential pages must stay reachable *with* a session:
 *
 * - `/set-password` is reached over a recovery or invite link, which signs the
 *   user in first - that is the whole point of the link. `getPasswordSetupPath`
 *   also routes authenticated users here.
 * - `/verify-email` and `/auth/*` are the landing points of those same emailed
 *   links, and the callback exchanges the code while a session already exists.
 *
 * Bouncing any of those would break password recovery for the people least able
 * to work around it.
 */
const ANONYMOUS_ONLY_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password"
]);

function isAnonymousOnly(pathname: string) {
  // Next normalises away a trailing slash before the proxy runs, but the check
  // costs nothing and a raw `fetch` can still arrive with one.
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  return ANONYMOUS_ONLY_PATHS.has(normalized);
}

function applyHeaders(response: NextResponse, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
}

/**
 * A bare NextResponse.redirect() starts with an empty cookie jar. Redirecting
 * with one would silently discard everything the refresh just wrote - including
 * the deletion cookies a *failed* refresh emits, which is how a dead session
 * ends up living in the browser forever.
 */
function redirectPreservingCookies(url: URL, carrier: NextResponse) {
  const redirect = NextResponse.redirect(url);

  for (const cookie of carrier.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }

  for (const key of Object.keys(NO_STORE_HEADERS)) {
    const value = carrier.headers.get(key);
    if (value) redirect.headers.set(key, value);
  }

  return redirect;
}

function loginRedirect(request: NextRequest, carrier: NextResponse) {
  const isDesktopApp =
    request.cookies.get(DESKTOP_APP_COOKIE)?.value === "true";
  const returnPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const target = isDesktopApp
    ? "/login?desktop=1"
    : getDashboardLoginPath(returnPath);

  return redirectPreservingCookies(
    new URL(target, request.nextUrl),
    carrier
  );
}

/**
 * The mirror of loginRedirect: where a signed-in visitor to an anonymous-only
 * page goes instead.
 *
 * `?next=` is honoured so that following a stale
 * `/login?next=/dashboard/menu` link - the shape proxy.ts itself hands out -
 * lands on the page that was originally asked for rather than the dashboard
 * root. It is run through `getSafeDashboardReturnPath`, so a crafted `next`
 * cannot turn this into an open redirect.
 */
function dashboardRedirect(request: NextRequest, carrier: NextResponse) {
  const target = getSafeDashboardReturnPath(
    request.nextUrl.searchParams.get("next")
  );

  return redirectPreservingCookies(new URL(target, request.nextUrl), carrier);
}

function expireAuthCookies(
  request: NextRequest,
  response: NextResponse,
  isSecure: boolean,
  includeCodeVerifier = true
) {
  const expire = (name: string) =>
    response.cookies.set(name, "", {
      path: "/",
      sameSite: "lax",
      secure: isSecure,
      httpOnly: false,
      maxAge: 0
    });

  for (const cookie of request.cookies.getAll()) {
    if (
      isSupabaseAuthCookieName(cookie.name) &&
      (includeCodeVerifier || isSupabaseSessionCookieName(cookie.name))
    ) {
      expire(cookie.name);
    }
  }

  expire(REMEMBER_AUTH_COOKIE);
  expire(REMEMBER_UNTIL_COOKIE);
  expire(ACTIVE_ORGANIZATION_COOKIE);
}

export async function updateSession(request: NextRequest) {
  // Reassigned inside setAll, and the reassigned object is what gets returned.
  // Building a fresh NextResponse.next() at the end instead would drop every
  // refreshed cookie on the floor, which surfaces as users being logged out at
  // random rather than as an error.
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return response;

  // From the live request, never NODE_ENV: `next build && next start` over http
  // reports production, and Playwright drives http://127.0.0.1:3000. A Secure
  // cookie is silently dropped on both.
  const isSecure = request.nextUrl.protocol === "https:";
  const isProtected =
    request.nextUrl.pathname.startsWith(PROTECTED_PATH_PREFIX);

  // The 30-day "Remember me" ceiling, checked before anything else so an
  // expired window costs no round trip to Supabase. This used to be a 60-second
  // interval in the dashboard guard, which only ran once that component
  // mounted; here it is server-authoritative and unskippable.
  if (
    isRememberWindowExpired(
      request.cookies.get(REMEMBER_AUTH_COOKIE)?.value,
      request.cookies.get(REMEMBER_UNTIL_COOKIE)?.value
    )
  ) {
    expireAuthCookies(request, response, isSecure);
    applyHeaders(response, NO_STORE_HEADERS);

    return isProtected ? loginRedirect(request, response) : response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        const maxAge = authCookieMaxAge(
          request.cookies.get(REMEMBER_AUTH_COOKIE)?.value,
          request.cookies.get(REMEMBER_UNTIL_COOKIE)?.value
        );

        // Mutate the REQUEST first, then rebuild the response from the mutated
        // request. Handing NextResponse.next() a headers snapshot taken before
        // this loop forwards the OLD token downstream, so the render attempts a
        // second refresh with a refresh token that has already been spent and
        // Supabase answers "Invalid Refresh Token: Already Used".
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(
            name,
            value,
            mergeAuthCookieOptions(
              options as Record<string, unknown>,
              value,
              isSecure,
              maxAge
            ) as Parameters<typeof response.cookies.set>[2]
          );
        }

        applyHeaders(response, headers ?? NO_STORE_HEADERS);
      }
    }
  });

  // getClaims(), which is what Supabase now recommends for this file - and
  // never getSession(), which their docs single out as untrustworthy in server
  // code because it returns whatever the cookie claims without verifying it.
  //
  // getClaims() verifies the JWT signature locally against the project's public
  // signing key when asymmetric keys are in use, so this costs no round trip to
  // the Auth server on a path that runs for every navigation. With a legacy
  // HS256 secret it falls back to getUser() internally, so it is never worse
  // than what it replaced.
  //
  // Awaited here, before any response is returned: reading the session is what
  // triggers the refresh, and a refresh that lands after the response has
  // already been built has nowhere to write its cookies.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    const hasUnverifiedSession = request.cookies.getAll().some(
      (cookie) =>
        isSupabaseSessionCookieName(cookie.name) && cookie.value.length > 0
    );

    if (hasUnverifiedSession) {
      // Do not expire the PKCE verifier here: OAuth's callback still needs it
      // when there is no session yet. A token cookie that failed verification,
      // on the other hand, makes the landing page advertise a dead session.
      expireAuthCookies(request, response, isSecure, false);
      applyHeaders(response, NO_STORE_HEADERS);
      log.warn({}, "unverified_auth_session_cleared");
    }

    return isProtected ? loginRedirect(request, response) : response;
  }

  // Checked only on the authenticated branch, and only after the refresh above
  // has had its chance to write cookies - `redirectPreservingCookies` then
  // carries them onto the redirect, so bouncing off /login never costs the
  // visitor the freshly rotated token.
  if (isAnonymousOnly(request.nextUrl.pathname)) {
    return dashboardRedirect(request, response);
  }

  return response;
}
