import * as Sentry from "@sentry/nextjs";
import { registerErrorReporter } from "@/lib/logging/report";
import { scrubEventRequest } from "@/lib/logging/scrub-event";

/**
 * Server-side Sentry initialisation, loaded from `instrumentation.ts`'s
 * `register()` on the Node.js runtime.
 *
 * Runs unconditionally, including with no DSN configured. `init` with an
 * undefined DSN produces a client with no destination, every capture is a
 * no-op, and `lib/logging/report.ts` reports that state as "not enabled" so no
 * useless `sentryId` reaches a log line. That is the shipping configuration
 * until the Sentry project exists - nothing here has to change to switch it on,
 * only the environment.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // The FULL sha, not the seven characters `lib/logging/logger.ts` puts on a
  // log line. `withSentryConfig` derives this same value when it uploads source
  // maps, and a release that disagrees with the uploaded artifacts gets you
  // minified stacks - the one thing this vendor is here to prevent. The log
  // line's `release` is a prefix of this, so both still name the same commit.
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  // Off. Tracing is real value but it is also a separate volume and billing
  // decision, and §03 of the plan defers distributed tracing until there is a
  // second deployable. Turning this up is a deliberate later choice, not
  // something to inherit from a starter template.
  tracesSampleRate: 0,
  // Never. This is what would attach IP addresses, cookies and user identifiers
  // by default. The actor is bound explicitly in `lib/logging/report.ts` as a
  // bare uuid instead.
  sendDefaultPii: false,
  // The §10 privacy rules, applied to the error stream. Sentry attaches its own
  // request metadata to server events, so none of the log stream's redaction
  // carries over - see `lib/logging/scrub-event.ts` for what has to go and why.
  beforeSend: scrubEventRequest
});

/**
 * Hand the initialised SDK to the facade every other server module talks to.
 *
 * This direction, rather than `lib/logging/report.ts` importing Sentry, is what
 * keeps the vendor out of `lib/http/api-error.ts`'s import graph - and so out
 * of all 71 routes and the tests that exercise them. The reasoning is in full
 * at the top of that file.
 */
registerErrorReporter({
  isEnabled: () => Boolean(Sentry.getClient()?.getDsn()),
  captureException: (error) => Sentry.captureException(error),
  setTag: (key, value) => Sentry.setTag(key, value),
  setUser: (user) => Sentry.setUser(user)
});
