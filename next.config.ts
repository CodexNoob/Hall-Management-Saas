// `@sentry/nextjs/config`, not `@sentry/nextjs`. Importing the wrapper from the
// package root is deprecated in v10 and stops working in v11.
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

/**
 * Note what is NOT in `connect-src` below: any Sentry ingest host.
 *
 * That is deliberate and it is load-bearing. `tunnelRoute` in the Sentry build
 * options makes the browser SDK post its envelopes to a same-origin path on
 * this app, which `default-src 'self'` already permits, and the app forwards
 * them onward from the server. So the policy stays exactly as tight as it was,
 * and the tunnel survives the ad-blockers that eat direct requests to
 * `*.sentry.io` as well.
 *
 * If you are here because Sentry looks installed and the dashboard is empty:
 * adding an ingest host here is the wrong fix. Check that `tunnelRoute` is
 * still set and that the DSN is configured. A CSP refusal is silent, which is
 * exactly why this comment exists.
 */
export function createContentSecurityPolicy(isProduction: boolean) {
  const developmentEvalSource = isProduction ? "" : " 'unsafe-eval'";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://*.stripe.com",
    `script-src 'self' 'unsafe-inline'${developmentEvalSource} https://cdn.plaid.com https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.plaid.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
    "frame-src https://*.plaid.com https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "upgrade-insecure-requests"
  ].join("; ");
}

const contentSecurityPolicy = createContentSecurityPolicy(
  process.env.NODE_ENV === "production"
);

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(self)" }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  /*
   * `next dev` serves its chunks only to the host it was started on, and 403s
   * every other one. Started plainly it answers to `localhost`, but the e2e
   * suite drives `http://127.0.0.1:3000` (playwright.config.ts `baseURL`) - so
   * a dev server already open in an editor gets reused by `reuseExistingServer`
   * and then refuses the suite's chunk requests. No JavaScript reaches the page,
   * nothing hydrates, and every spec that waits for hydration times out.
   *
   * Naming the loopback literal here makes the two agree however the server was
   * started. Development only; the option has no effect on a production build.
   */
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    qualities: [100]
  },
  async redirects() {
    return [
      // The sign-up route was /start-trial until the auth screens moved out of
      // the landing modal. Permanent so anything already linking to it - a
      // bookmark, a sent email, a search result - lands on the new URL.
      {
        source: "/start-trial",
        destination: "/signup",
        permanent: true
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate"
          },
          {
            key: "Service-Worker-Allowed",
            value: "/"
          }
        ]
      },
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate"
          }
        ]
      }
    ];
  },
  typedRoutes: true
};

/**
 * Exported so `tests/unit/error-reporting.test.ts` can assert against the real
 * values. `tunnelRoute` in particular is what makes the untouched `connect-src`
 * above sufficient, and its absence would fail silently in the browser - the
 * one failure mode nothing else in the suite would catch.
 */
export const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Build-time only. It never reaches the runtime and must never be
  // `NEXT_PUBLIC_` - see the note in `lib/env.ts`.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  /*
   * The CSP answer, explained at the top of this file: envelopes go to this
   * same-origin path instead of to `*.sentry.io`, so `connect-src 'self'`
   * covers them and no ingest host has to be allow-listed. It also gets past
   * ad-blockers, which block direct Sentry requests by hostname.
   *
   * `/monitoring` is not a real route in `app/` - the plugin creates it.
   */
  tunnelRoute: "/monitoring",
  // The client bundle Next emits is chunked in ways the default upload scope
  // misses; without this the browser stacks come back partially minified,
  // which is most of what the error plane is being bought for.
  widenClientFileUpload: true,
  // Uploaded, then removed from the deployment. Leaving them in place serves
  // the original source of a closed-source product to anyone who asks for it.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  treeshake: { removeDebugLogging: true },
  // Quiet locally, verbose in CI - where the upload either worked or is the
  // thing you need to read the log to diagnose.
  silent: !process.env.CI,
  telemetry: false
} as const;

/**
 * Wrapped unconditionally, including with no Sentry credentials set.
 *
 * With no `authToken` the plugin skips the source-map upload and builds
 * normally, so this is the same one build in every environment rather than two
 * that diverge exactly where a release goes out.
 */
export default withSentryConfig(nextConfig, sentryBuildOptions);
