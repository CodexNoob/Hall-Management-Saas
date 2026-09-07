import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { safePath } from "@/lib/logging/safe-path";

/**
 * The §10 privacy rules, applied to the error plane.
 *
 * The log stream enforces them through pino's `redact` and `safePath`. Sentry
 * builds its own events and attaches its own request metadata, so none of that
 * carries over - these rules have to be re-stated here or they simply do not
 * apply to half the data leaving the application.
 *
 * A separate module from either Sentry config for two reasons: both configs
 * need it, and a `beforeSend` hook that cannot be unit-tested is a privacy
 * guarantee taken on trust. `tests/unit/error-reporting.test.ts` asserts
 * against these directly, the way `logging-redaction.test.ts` asserts against
 * the real `redactPaths`.
 *
 * Type-only imports, so nothing here pulls the SDK into a bundle that would
 * not otherwise have it.
 */

/**
 * Strip everything from a captured event that the log stream would refuse.
 *
 * Three things must not survive:
 *
 * - The **body** (`request.data`). "Never log a request or response body" is
 *   absolute, and an exception report is not an exemption to it.
 * - The **cookie header**, which carries the Supabase session
 *   (`sb-<ref>-auth-token` and its chunks). A captured session is a credential
 *   somebody can replay.
 * - The **query string**. `app/auth/confirm` and `app/auth/callback` receive
 *   one-time credentials as `?token_hash=` and `?code=`. Sentry's own scrubbing
 *   matches field names, so like fast-redact it cannot see inside a URL.
 */
export function scrubEventRequest(event: ErrorEvent): ErrorEvent {
  const request = event.request;

  if (!request) return event;

  delete request.data;
  delete request.cookies;

  if (request.headers) {
    // Both cases: header bags reach here as plain objects, and nothing
    // normalises the casing on the way.
    delete request.headers.cookie;
    delete request.headers.Cookie;
    delete request.headers.authorization;
    delete request.headers.Authorization;
  }

  // Dropped rather than sanitised. It duplicates what is already in `url`, and
  // there is no reason to carry a second copy of a string whose entire risk is
  // what it might contain.
  delete request.query_string;

  if (typeof request.url === "string") {
    request.url = safePath(request.url);
  }

  return event;
}

/**
 * Breadcrumbs record navigations and fetches with their URLs attached, and a
 * credential in a breadcrumb has left the building just as surely as one in the
 * event. This is why scrubbing the event alone is not enough.
 */
export function scrubBreadcrumbUrl(breadcrumb: Breadcrumb): Breadcrumb {
  if (typeof breadcrumb.data?.url === "string") {
    breadcrumb.data.url = safePath(breadcrumb.data.url);
  }

  return breadcrumb;
}
