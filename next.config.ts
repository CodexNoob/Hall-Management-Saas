import type { NextConfig } from "next";

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

export default nextConfig;
