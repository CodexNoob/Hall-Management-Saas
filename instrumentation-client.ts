import * as Sentry from "@sentry/nextjs";
import { registerErrorReporter } from "@/lib/logging/report";
import {
  scrubBreadcrumbUrl,
  scrubEventRequest
} from "@/lib/logging/scrub-event";

/**
 * Browser-side Sentry initialisation.
 *
 * Next runs this after the document loads and before hydration begins, which is
 * the earliest point that can catch a crash during the first render - the exact
 * failure that today shows a blank screen and tells nobody.
 *
 * Like the server config, this runs with or without a DSN. Unset, the SDK has
 * no destination and every capture is a no-op.
 *
 * Kept synchronous and small on purpose: Next warns when this file takes longer
 * than 16ms, because everything here delays hydration.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // Left to the bundler plugin when the system variable is not exposed: Sentry
  // injects the release it uploaded source maps under, and `undefined` here
  // means "use that" rather than "no release". Setting a value that disagreed
  // with the uploaded artifacts is how you end up staring at a minified stack.
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0,
  // The browser SDK's version of the same rule the server config holds: no IP
  // address, no cookies, no identifiers beyond the uuid bound in
  // `lib/logging/report.ts`.
  sendDefaultPii: false,
  // The browser attaches the current location to an event, and the auth flow
  // redirects through URLs carrying one-time credentials. Breadcrumbs need the
  // same treatment for the same reason - a credential in a breadcrumb has left
  // the building just as surely as one in the event.
  beforeSend: scrubEventRequest,
  beforeBreadcrumb: scrubBreadcrumbUrl
});

/**
 * The browser half of the same registration the server config performs, and the
 * reason `app/error.tsx` and `app/global-error.tsx` can call `captureException`
 * without importing the SDK into a page bundle.
 *
 * Next runs this file before hydration, so the slot is filled before any
 * component - error boundary included - can render.
 */
registerErrorReporter({
  isEnabled: () => Boolean(Sentry.getClient()?.getDsn()),
  captureException: (error) => Sentry.captureException(error),
  setTag: (key, value) => Sentry.setTag(key, value),
  setUser: (user) => Sentry.setUser(user)
});

/**
 * `onRouterTransitionStart` turns App Router navigations into breadcrumbs, so
 * an error arrives with the three screens that preceded it attached.
 *
 * Handed straight to Sentry's own hook rather than wrapped - it takes exactly
 * the signature Next documents for this export.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
