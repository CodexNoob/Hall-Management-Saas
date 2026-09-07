<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Logging is not optional

Server code in this repository records what it does. The full contract is
[docs/logging.md](docs/logging.md); read it before adding a log line. These
rules are non-negotiable and apply to every change:

- **Never `console.*`** in `app/`, `lib/`, `features/` or `components/`. ESLint
  fails the build on it. Use `log` from `@/lib/logging/context`.
- **Payload first, message second**: `log.warn({ hallId }, "hall_unavailable")`.
  The message is a stable lowercase `snake_case` event name, never an
  interpolated sentence — it is the field that gets filtered and alerted on.
- **Do not log an error you are about to throw.** `createApiErrorResponse`
  already logs every branch it handles. A `log` call is for things that are not
  exceptions: a decision taken, an external call worth timing, a fallback used,
  a limit tripped.
- **Never log a request or response body, and never a raw URL.** Log a count, an
  id or a total. URLs go through `safePath()` — the auth routes carry one-time
  credentials in their query string, and redaction matches object keys, not the
  insides of strings.
- **`LOG_LEVEL` belongs to Prisma.** Setting it to `debug` drops the slow-query
  threshold to zero, so every statement is logged. `lib/prisma.ts` subscribes to
  Prisma's query *event* and never logs `event.params` — the bound parameters
  are tenant data and that is the one line in the file that matters. Do not
  reintroduce the bare-string `log: ["query"]` form: it writes to stdout, with
  parameters, and the listener silently never fires. The application logger
  reads `APP_LOG_LEVEL`. Never merge the two.
- **Every new `app/api` route handler is wrapped in `withRoute`**, with the route
  PATTERN as its first argument: `export const POST = withRoute("POST /api/events", async (request) => { ... })`.
  An unwrapped route logs with no request id, no route and no tenant, and its
  response carries no `x-request-id` for a customer to quote. Keep the route's
  own `try/catch` — the wrapper's is only a net for what escapes one.
- **Every call that leaves the process goes through `trackedFetch` or
  `trackOutbound`** from `@/lib/logging/outbound`, with a bounded `vendor` and a
  low-cardinality `operation`. A bare `fetch` to a partner is a call with no
  duration, no status and no attribution when it is the thing making requests
  slow. Never pass the URL or a body into the payload — the helper logs neither.
- **When you add a server-side code path that can fail, degrade, or take a
  decision worth reconstructing later, add the log line in the same change.**
  Retrofitting observability is the work this system exists to stop repeating.
- **Never import `@sentry/nextjs` outside `sentry.server.config.ts` and
  `instrumentation-client.ts`.** Everything else goes through
  `captureException` from `@/lib/logging/report`, which holds no vendor import
  on purpose: it sits in `api-error.ts`'s import graph, and the SDK's entry
  point pulls a webpack plugin that throws under Vitest and would fail the
  whole suite. You rarely need it anyway — `createApiErrorResponse` already
  captures the unhandled branch, and the handled 4xx branches are logged but
  deliberately **not** reported.

Log payloads want `organizationId` and `userId`; they are the debugging axis and
are not personal data. `userEmail`, phone numbers and client names are, and are
redacted — keep them out by construction rather than relying on it.
