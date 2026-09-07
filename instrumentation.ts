import type { Instrumentation } from "next";

/**
 * Runs once, before anything is served.
 *
 * The runtime guard is not ceremony: this file is loaded on every runtime Next
 * has, and the server config pulls in pino and the Node SDK. There are zero
 * `runtime = "edge"` routes in this repository and Next 16 runs Proxy on Node
 * by default, so the guard is a no-op today and the honest boundary tomorrow -
 * an edge route added later gets no Sentry rather than a build failure.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

/**
 * The gap `createApiErrorResponse` cannot see.
 *
 * `onRequestError` fires only for errors that ESCAPE a handler, and 69 of the
 * 73 route files here carry their own `catch`. So this is not a second net
 * under the API - it is the only net at all under Server Component rendering
 * and streaming, which today fail with nothing recorded anywhere.
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

  // Sentry ships this for exactly this hook's signature, so the arguments are
  // handed straight through rather than reshaped. It is called AFTER the log
  // line above on purpose: the line is the thing that always happens, and a
  // failure inside the vendor SDK must not be able to swallow it.
  //
  // Lazily imported for the same reason as the logger, and additionally so that
  // an edge invocation - where `register()` deliberately never initialised the
  // SDK - does not drag the server build in behind it.
  const Sentry = await import("@sentry/nextjs");

  await Sentry.captureRequestError(err, request, context);
};
