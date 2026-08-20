// @vitest-environment node
//
// Server-side request handling needs real Request/Response/Headers, which
// jsdom does not provide.

import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/dist/experimental/testing/server/middleware-testing-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config } from "@/proxy";
import {
  DESKTOP_APP_COOKIE,
  REMEMBER_AUTH_COOKIE,
  REMEMBER_UNTIL_COOKIE
} from "@/lib/supabase/cookie-policy";

type SetAllFn = (
  cookies: { name: string; value: string; options: Record<string, unknown> }[],
  headers: Record<string, string>
) => void;

/**
 * Stands in for @supabase/ssr. `onAuthCall` lets a test drive the thing that is
 * genuinely hard to get right: cookies written from inside setAll *during* the
 * auth call, which is exactly when a token refresh happens.
 */
let currentClaims: Record<string, unknown> | null = null;
let onAuthCall: ((setAll: SetAllFn) => void) | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: SetAllFn } }
  ) => ({
    auth: {
      getClaims: async () => {
        onAuthCall?.(options.cookies.setAll);

        return currentClaims
          ? { data: { claims: currentClaims }, error: null }
          : { data: null, error: { message: "no session" } };
      }
    }
  })
}));

const REFRESHED_COOKIE = {
  name: "sb-testproject-auth-token",
  value: "refreshed-token",
  options: { path: "/", sameSite: "lax" as const }
};

const SUPABASE_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache"
};

function requestFor(
  path: string,
  cookies: Record<string, string> = {},
  origin = "https://app.example.com"
) {
  const request = new NextRequest(`${origin}${path}`);

  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }

  return request;
}

async function run(request: NextRequest) {
  const { updateSession } = await import("@/lib/supabase/proxy");
  return updateSession(request);
}

/** Every Set-Cookie the response carries, as one string. */
function setCookieHeader(response: Response) {
  return response.headers.getSetCookie().join("\n");
}

beforeEach(() => {
  vi.clearAllMocks();
  currentClaims = { sub: "user-1" };
  onAuthCall = null;
  // stubEnv, not direct assignment: vitest shares a worker process across test
  // files, so unsetting a variable here would leak into whichever file runs
  // next in the same worker and fail it intermittently.
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://testproject.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the dashboard gate", () => {
  it("sends an unauthenticated visitor to login with a return path", async () => {
    currentClaims = null;

    const response = await run(requestFor("/dashboard/menu"));
    const location = new URL(response.headers.get("location") as string);

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard/menu");
  });

  it("preserves the query string in the return path", async () => {
    currentClaims = null;

    const response = await run(requestFor("/dashboard/events?view=week"));
    const location = new URL(response.headers.get("location") as string);

    expect(location.searchParams.get("next")).toBe(
      "/dashboard/events?view=week"
    );
  });

  it("lets an authenticated visitor through", async () => {
    const response = await run(requestFor("/dashboard"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("leaves public pages alone for an unauthenticated visitor", async () => {
    currentClaims = null;

    for (const path of ["/", "/product", "/login", "/auth/confirm"]) {
      const response = await run(requestFor(path));
      expect(response.headers.get("location"), path).toBeNull();
    }
  });

  it("sends the desktop shell to its own sign-in page", async () => {
    currentClaims = null;

    const response = await run(
      requestFor("/dashboard", { [DESKTOP_APP_COOKIE]: "true" })
    );
    const location = new URL(response.headers.get("location") as string);

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("desktop")).toBe("1");
  });
});

describe("the anonymous-only gate", () => {
  it("sends a signed-in visitor away from the credential pages", async () => {
    for (const path of ["/login", "/signup", "/forgot-password"]) {
      const response = await run(requestFor(path));
      const location = new URL(response.headers.get("location") as string);

      expect(location.pathname, path).toBe("/dashboard");
    }
  });

  /**
   * proxy.ts hands out `/login?next=/dashboard/...` itself. Following a stale
   * one with a live session should land where it was pointing, not at the root.
   */
  it("honours a safe return path", async () => {
    const response = await run(
      requestFor("/login?next=%2Fdashboard%2Fmenu%3Ftab%3Dcourses")
    );
    const location = new URL(response.headers.get("location") as string);

    expect(location.pathname).toBe("/dashboard/menu");
    expect(location.searchParams.get("tab")).toBe("courses");
  });

  it("refuses to be turned into an open redirect", async () => {
    const response = await run(
      requestFor("/login?next=https%3A%2F%2Fevil.example.com")
    );
    const location = new URL(response.headers.get("location") as string);

    expect(location.origin).toBe("https://app.example.com");
    expect(location.pathname).toBe("/dashboard");
  });

  /**
   * These are reached over recovery and invite links, which sign the user in
   * *before* they land. Bouncing them would break password recovery outright -
   * the reason the gate is an exact-path allowlist and not a prefix match.
   */
  it("leaves the emailed-link pages reachable with a session", async () => {
    for (const path of [
      "/set-password?flow=required",
      "/verify-email",
      "/auth/confirm",
      "/auth/callback",
      "/auth/auth-error"
    ]) {
      const response = await run(requestFor(path));
      expect(response.headers.get("location"), path).toBeNull();
    }
  });

  it("leaves the public marketing pages alone", async () => {
    for (const path of ["/", "/product/halls", "/documentation"]) {
      const response = await run(requestFor(path));
      expect(response.headers.get("location"), path).toBeNull();
    }
  });

  /**
   * The bounce happens after the refresh has run. Dropping the cookies it wrote
   * would sign the visitor out for the crime of opening the sign-in page.
   */
  it("carries a refreshed cookie onto the redirect", async () => {
    onAuthCall = (setAll) => setAll([REFRESHED_COOKIE], SUPABASE_CACHE_HEADERS);

    const response = await run(requestFor("/login"));

    expect(response.headers.get("location")).toContain("/dashboard");
    expect(setCookieHeader(response)).toContain("refreshed-token");
  });

  /**
   * The remember-window sweep returns before getClaims() ever runs. A visitor
   * whose window has closed is on their way to being signed out, so the sign-in
   * page has to stay open to them.
   */
  it("does not bounce once the remember window has closed", async () => {
    const response = await run(
      requestFor("/login", {
        [REMEMBER_AUTH_COOKIE]: "true",
        [REMEMBER_UNTIL_COOKIE]: String(Date.now() - 1000)
      })
    );

    expect(response.headers.get("location")).toBeNull();
  });
});

describe("session refresh", () => {
  /**
   * The failure this guards against does not look like an error - the refresh
   * succeeds, the response drops the cookie, and the user is silently signed
   * out at some later navigation.
   */
  it("returns the response that setAll wrote onto, not a fresh one", async () => {
    onAuthCall = (setAll) => setAll([REFRESHED_COOKIE], SUPABASE_CACHE_HEADERS);

    const response = await run(requestFor("/dashboard"));

    expect(setCookieHeader(response)).toContain("refreshed-token");
  });

  /**
   * Without these a CDN or reverse proxy can cache a response carrying
   * Set-Cookie and hand one user's session token to the next visitor.
   */
  it("applies the no-store headers Supabase passes alongside the cookies", async () => {
    onAuthCall = (setAll) => setAll([REFRESHED_COOKIE], SUPABASE_CACHE_HEADERS);

    const response = await run(requestFor("/dashboard"));

    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0"
    );
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  /**
   * The response must be rebuilt from the MUTATED request. Forwarding the old
   * token downstream makes the render attempt a second refresh with a refresh
   * token that has already been spent - "Invalid Refresh Token: Already Used".
   */
  it("forwards the new token downstream, not the one it replaced", async () => {
    onAuthCall = (setAll) => setAll([REFRESHED_COOKIE], SUPABASE_CACHE_HEADERS);

    const request = requestFor("/dashboard", {
      "sb-testproject-auth-token": "stale-token"
    });
    await run(request);

    expect(request.cookies.get("sb-testproject-auth-token")?.value).toBe(
      "refreshed-token"
    );
  });

  /**
   * A failed refresh emits deletion cookies. A bare NextResponse.redirect()
   * starts with an empty jar, so without redirectPreservingCookies the dead
   * cookie stays in the browser forever and every later visit repeats the
   * failure.
   */
  it("carries cookies onto the login redirect when the refresh failed", async () => {
    currentClaims = null;
    onAuthCall = (setAll) =>
      setAll(
        [
          {
            name: "sb-testproject-auth-token",
            value: "",
            options: { path: "/" }
          }
        ],
        SUPABASE_CACHE_HEADERS
      );

    const response = await run(
      requestFor("/dashboard", { "sb-testproject-auth-token": "dead-token" })
    );

    expect(response.headers.get("location")).toBeTruthy();
    expect(setCookieHeader(response)).toContain("sb-testproject-auth-token=");
    expect(setCookieHeader(response)).toMatch(/Max-Age=0/i);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("writes auth cookies without HttpOnly so the browser client can read them", async () => {
    onAuthCall = (setAll) => setAll([REFRESHED_COOKIE], SUPABASE_CACHE_HEADERS);

    const response = await run(requestFor("/dashboard"));

    expect(setCookieHeader(response)).not.toMatch(/HttpOnly/i);
  });

  /**
   * Secure comes from the live request, never NODE_ENV - Playwright drives
   * http://127.0.0.1:3000, where a Secure cookie is dropped and the resulting
   * empty storageState fails a pile of e2e specs with no useful message.
   */
  it("omits Secure over http and sets it over https", async () => {
    onAuthCall = (setAll) => setAll([REFRESHED_COOKIE], SUPABASE_CACHE_HEADERS);

    const insecure = await run(
      requestFor("/dashboard", {}, "http://127.0.0.1:3000")
    );
    expect(setCookieHeader(insecure)).not.toMatch(/Secure/i);

    const secure = await run(requestFor("/dashboard"));
    expect(setCookieHeader(secure)).toMatch(/Secure/i);
  });
});

describe("the remember-me ceiling", () => {
  const expired = {
    [REMEMBER_AUTH_COOKIE]: "true",
    [REMEMBER_UNTIL_COOKIE]: String(Date.now() - 1000),
    "sb-testproject-auth-token": "still-valid-token"
  };

  it("clears the session and redirects once the window has passed", async () => {
    const response = await run(requestFor("/dashboard", expired));

    expect(new URL(response.headers.get("location") as string).pathname).toBe(
      "/login"
    );
    expect(setCookieHeader(response)).toContain("sb-testproject-auth-token=");
    expect(setCookieHeader(response)).toContain(REMEMBER_AUTH_COOKIE);
    expect(setCookieHeader(response)).toContain(REMEMBER_UNTIL_COOKIE);
    expect(setCookieHeader(response)).toMatch(/Max-Age=0/i);
  });

  it("costs no round trip to Supabase", async () => {
    let asked = false;
    onAuthCall = () => {
      asked = true;
    };

    await run(requestFor("/dashboard", expired));

    expect(asked).toBe(false);
  });

  it("still clears the session on a public page, without redirecting", async () => {
    const response = await run(requestFor("/", expired));

    expect(response.headers.get("location")).toBeNull();
    expect(setCookieHeader(response)).toContain("sb-testproject-auth-token=");
  });

  /**
   * The ceiling applies only to an explicit "Remember me" tick. An absent
   * preference - which is every trial sign-up, since that form never records
   * one - must never expire early.
   */
  it("does not apply when no preference was recorded", async () => {
    const response = await run(
      requestFor("/dashboard", {
        [REMEMBER_UNTIL_COOKIE]: String(Date.now() - 1000)
      })
    );

    expect(response.headers.get("location")).toBeNull();
  });
});

/**
 * Every other test in this file calls updateSession() directly, so all of them
 * would still pass with a matcher that ran the proxy on /api/** or on static
 * assets. Next's own matcher evaluator is the only thing that closes that gap.
 */
describe("the matcher", () => {
  const runsOn = (path: string) =>
    unstable_doesMiddlewareMatch({
      config,
      url: `https://app.example.com${path}`
    });

  it("runs on dashboard and auth navigations", () => {
    for (const path of [
      "/",
      "/dashboard",
      "/dashboard/menu",
      "/login",
      "/auth/confirm",
      "/set-password"
    ]) {
      expect(runsOn(path), path).toBe(true);
    }
  });

  /**
   * The exclusion that matters most. Matching these would put a second auth
   * round trip in front of all 39 route handlers, and would have N concurrent
   * requests racing to refresh with the same refresh token.
   */
  it("never runs on API routes", () => {
    for (const path of [
      "/api/events",
      "/api/auth/session",
      "/api/billing/stripe/webhook",
      "/api/health"
    ]) {
      expect(runsOn(path), path).toBe(false);
    }
  });

  it("skips static assets", () => {
    for (const path of [
      "/_next/static/chunk.js",
      "/_next/image",
      "/images/branding/hms-logo-header.png",
      "/sw.js",
      "/favicon.ico"
    ]) {
      expect(runsOn(path), path).toBe(false);
    }
  });
});

describe("configuration failures", () => {
  /**
   * getEnv() would throw here and take the public marketing site down with it.
   * proxy.ts reads process.env directly and degrades instead.
   */
  it("passes traffic through when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);

    const response = await run(requestFor("/dashboard"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
