/**
 * The error plane's facade - the only module call sites import, in the same way
 * `lib/logging/context.ts` is the only module that exposes the logger.
 *
 * It contains no vendor import at all, not even a lazy one. The two framework
 * entry points that already load Sentry - `sentry.server.config.ts` and
 * `instrumentation-client.ts` - push an implementation in here at startup with
 * `registerErrorReporter`, and everything else calls the functions below.
 *
 * That inversion is not architectural taste, it is a hard constraint. Importing
 * `@sentry/nextjs` from this module would put it in `lib/http/api-error.ts`'s
 * import graph and therefore in all 71 routes' and in every unit test that
 * exercises one. The SDK's entry point pulls its webpack bundler plugin, which
 * throws `The URL must be of scheme file` under Vitest's module runner - so a
 * direct import here fails the suite wholesale. Keeping the vendor on the far
 * side of a registration slot means the facade is a few dozen lines of plain
 * TypeScript that any environment can load.
 *
 * The same shape keeps it isomorphic: `lib/http/api-error.ts` imports this on
 * the server and `app/error.tsx` imports it in the browser, and neither drags
 * anything runtime-specific behind it.
 */

type ErrorReporter = {
  /** Whether reports have anywhere to go - false with no DSN configured. */
  isEnabled: () => boolean;
  captureException: (error: unknown) => string;
  setTag: (key: string, value: string) => void;
  setUser: (user: { id: string } | null) => void;
};

let reporter: ErrorReporter | null = null;

/**
 * Called once per runtime, from the Sentry config that owns it.
 *
 * Until it is called every function below is a no-op, which is the correct
 * behaviour in the two cases it actually happens: a unit test, and a script or
 * cron that never initialises the SDK.
 */
export function registerErrorReporter(next: ErrorReporter) {
  reporter = next;
}

/**
 * Exposed for tests, which need to put the slot back the way they found it.
 * Nothing in the application should call this.
 */
export function resetErrorReporter() {
  reporter = null;
}

/**
 * The SDK can be initialised and still have nowhere to send anything - `init`
 * with no DSN builds a client with no destination. In that state
 * `captureException` hands back an event id for an event that was never
 * transmitted, and putting that id on a log line as `sentryId` would be worse
 * than logging nothing: it is a join key pointing at a row that does not exist.
 */
function isEnabled() {
  try {
    return reporter?.isEnabled() ?? false;
  } catch {
    return false;
  }
}

/**
 * Report an exception and return its id, or `null` when reporting is off or the
 * capture itself failed.
 *
 * That id is the join between the two planes: it goes onto the log line as
 * `sentryId`, so a log search crosses to the grouped issue and back. Without it
 * the diagnostic and error planes are two search boxes with nothing tying them
 * together.
 *
 * Never throws, under any circumstance. This runs inside the error path - it is
 * only reached once something has already gone wrong - and an exception raised
 * here would replace a handled 500 with an unhandled one. The codebase already
 * holds this line in `authenticatedFetch`: instrumentation must never turn a
 * failure into a worse failure.
 */
export function captureException(error: unknown): string | null {
  if (!isEnabled()) return null;

  try {
    return reporter?.captureException(error) ?? null;
  } catch {
    return null;
  }
}

/**
 * Tag the current scope with who the request belongs to.
 *
 * Called from `bindActor` in `lib/logging/context.ts`, so both planes are
 * tagged from one place and cannot drift apart. Sentry gives every request its
 * own isolation scope, so these do not leak between concurrent requests sharing
 * an instance.
 *
 * `organizationId` is a tag because tags are what can be grouped, filtered and
 * alerted on - "this issue hit these three organizations" is the question this
 * phase exists to answer.
 *
 * The user is the uuid and NOTHING else. `AuthzContext` carries an email too,
 * and it must not travel: `sendDefaultPii` is off in both configs, and putting
 * an address here would walk straight past that.
 */
export function bindActorToErrorScope(actor: {
  organizationId: string;
  userId: string | null;
  principalId: string;
}) {
  if (!isEnabled()) return;

  try {
    reporter?.setTag("organizationId", actor.organizationId);
    reporter?.setTag("principalId", actor.principalId);
    reporter?.setUser(actor.userId ? { id: actor.userId } : null);
  } catch {
    // Same rule as above: tagging is a nicety, and losing it is never worth
    // raising a second error from inside the first one's handler.
  }
}

/**
 * Attach the correlation id to the error scope.
 *
 * Sentry groups by stack; the logs group by `requestId`. This is what lets you
 * land on an issue and pull up every log line the same request produced - the
 * reverse of the `sentryId` direction above, and just as necessary.
 */
export function bindRequestIdToErrorScope(requestId: string) {
  if (!isEnabled()) return;

  try {
    reporter?.setTag("requestId", requestId);
  } catch {
    // Non-fatal by design.
  }
}
