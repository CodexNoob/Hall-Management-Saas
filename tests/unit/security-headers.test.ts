import { describe, expect, it, vi } from "vitest";

/**
 * `next.config.ts` is wrapped in `withSentryConfig`, which loads Sentry's
 * webpack bundler plugin at import time - and that plugin throws
 * "The URL must be of scheme file" under Vitest's module runner. Stubbing the
 * wrapper as the identity function is what lets this file keep importing the
 * config at all.
 *
 * It costs nothing that matters here: every assertion below is about values
 * this repository defines, and `withSentryConfig` does not touch the headers.
 * `tests/unit/error-reporting.test.ts` deliberately does NOT stub the SDK,
 * which is why the two files stay separate.
 */
vi.mock("@sentry/nextjs/config", () => ({
  withSentryConfig: <T,>(config: T) => config
}));

const { default: nextConfig, createContentSecurityPolicy, sentryBuildOptions } =
  await import("@/next.config");

describe("global security headers", () => {
  it("defines CSP, HSTS, framing, MIME, referrer, and permissions policies", async () => {
    const rules = await nextConfig.headers?.();
    const globalRule = rules?.find((rule) => rule.source === "/(.*)");
    const headers = new Map(
      globalRule?.headers.map(({ key, value }) => [key, value])
    );

    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
  });

  it("allows React Refresh evaluation only outside production", () => {
    expect(createContentSecurityPolicy(false)).toContain("'unsafe-eval'");
    expect(createContentSecurityPolicy(true)).not.toContain("'unsafe-eval'");
  });
});

describe("Sentry against the content security policy", () => {
  it("routes envelopes through a same-origin tunnel instead of an ingest host", () => {
    // These two assertions are a pair, and the pairing is the point.
    //
    // `connect-src` is an explicit allow-list under `default-src 'self'`, and a
    // browser request the policy refuses fails SILENTLY - the SDK looks
    // installed, the dashboard stays empty, and nothing anywhere says why. The
    // CSP is allowed to carry no Sentry host ONLY because the tunnel makes
    // every envelope same-origin. Drop the tunnel without adding the host and
    // this is what says so.
    expect(createContentSecurityPolicy(true)).not.toContain("sentry.io");
    expect(sentryBuildOptions.tunnelRoute).toMatch(/^\//);
    expect(createContentSecurityPolicy(true)).toContain("connect-src 'self'");
  });

  it("keeps the tunnel out of the proxy matcher", async () => {
    // Every browser-side envelope POSTs to the tunnel. If the proxy matched it,
    // each one would carry a Supabase round trip - the exact cost `api/` is
    // excluded to avoid - in front of the reporter you need most at precisely
    // the moment things are already broken.
    const { config } = await import("@/proxy");
    const matcher = new RegExp(config.matcher[0]);

    expect(matcher.test(sentryBuildOptions.tunnelRoute)).toBe(false);
    // A control. Without it the assertion above would pass just as happily
    // against a matcher that excluded everything.
    expect(matcher.test("/dashboard")).toBe(true);
  });
});
