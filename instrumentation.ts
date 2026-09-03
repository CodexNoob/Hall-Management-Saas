import type { Instrumentation } from "next";

/**
 * The gap `createApiErrorResponse` cannot see.
 *
 * `onRequestError` fires only for errors that ESCAPE a handler, and 69 of the
 * 73 route files here carry their own `catch`. So this is not a second net
 * under the API - it is the only net at all under Server Component rendering
 * and streaming, which today fail with nothing recorded anywhere.
 *
 * No `register()` export yet: it exists to initialise a vendor SDK, and Phase 1
 * ships without one. Sentry's `captureRequestError` joins this function in
 * Phase 2.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  // Imported lazily so that a failure inside the logging module cannot stop the
  // server from booting - this file is loaded before anything serves.
  const { baseLogger, safePath } = await import("@/lib/logging/logger");

  baseLogger.error(
    {
      err:
        err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : { name: "NonError", message: String(err) },
      // React can replace the thrown instance while rendering Server
      // Components. The digest is what matches this line to the opaque id the
      // browser was shown.
      digest:
        typeof err === "object" && err !== null && "digest" in err
          ? String((err as { digest: unknown }).digest)
          : undefined,
      // `request.path` is documented as the resource path INCLUDING the query
      // string, and the auth links carry one-time credentials there. Never the
      // raw value, and never `request.headers` - that bag holds the Supabase
      // session cookie, which is what the official example would have shipped.
      path: safePath(request.path),
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType
    },
    "request_error"
  );
};
