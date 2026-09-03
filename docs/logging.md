# Logging

Every server-side failure and decision worth reconstructing goes through one
module. This document is the contract: what to call, what to name it, and what
must never reach the stream.

## The API

```ts
import { log } from "@/lib/logging/context";

log.info({ eventId, hallId }, "booking_confirmed");
```

**Payload first, message second.** This is pino's argument order and it is the
easiest thing to get backwards. `log.info("booking confirmed")` produces a line
with no queryable fields.

Four levels: `debug`, `info`, `warn`, `error`.

## The message is an event name

```ts
log.warn({ hallId, requested: 3, limit: 2 }, "daily_event_limit_exceeded");  // yes
log.warn({}, `Hall ${hallId} is over its limit of 2 per day`);               // no
```

The message is the field you filter and alert on, so it has to be a stable
string. Interpolating a value makes every line unique, and nothing can be
counted. Variable data belongs in the payload — that is what the payload is for.

Style: lowercase `snake_case`, past tense, no punctuation.
`handled_route_error`, `stripe_webhook_failed`, `menu_picture_signing_failed`.

## Choosing a level

| Level | Means | Example |
| --- | --- | --- |
| `error` | Broke; a person should eventually look | `stripe_webhook_failed` |
| `warn` | Expected but notable — denials, conflicts, degraded fallbacks | `handled_route_error` on a 403, `rate_limiter_memory_fallback` |
| `info` | Happened; worth counting | a booking confirmed, an invoice sent |
| `debug` | Local reproduction only; never on in production | |

The distinction that matters is `error` vs `warn`. `error` should mean "worth
waking someone for, eventually". If every degraded-but-working path logs at
`error`, alerting on it becomes worthless. The rate limiter falling back to
memory is `error` because rate limiting is genuinely defeated; a thumbnail
failing to sign is not.

## Do not log an error you are about to throw

```ts
// Two lines for one failure.
log.error({ err }, "booking_failed");
throw new BookingError("Hall unavailable", 409);

// Correct. createApiErrorResponse logs every branch it handles.
throw new BookingError("Hall unavailable", 409);
```

Anything reaching a route's `catch (error) { return createApiErrorResponse(error) }`
is **already logged**, at the right level, with its status and error class. Add a
`log` call only for things that are not exceptions: a decision taken, an external
call worth timing, a fallback used, a limit tripped.

## What must never reach the stream

Redaction in `lib/logging/logger.ts` covers **keys**, at nesting depths one
through four — `password`, `token`, `email`, `phone`, `access_token`,
`client_secret` and the rest of `SENSITIVE_KEYS`. Those are replaced with
`[redacted]` wherever they appear in a payload.

It cannot see inside a string. Two consequences:

```ts
log.info({ url: request.url }, "callback_received");             // leaks ?token_hash=
log.info({ url: safePath(request.url) }, "callback_received");   // correct
```

- **Never log a request or response body.** Not for a size, not for a shape. Log
  a count, an id or a total. This is both the privacy rule and the cost rule.
- **Never log a raw URL.** `app/auth/confirm` and `app/auth/callback` receive
  one-time credentials as `?token_hash=` and `?code=`. Use `safePath()`.
- **`organizationId` and `userId` are wanted.** They are the primary debugging
  axis and neither is personal data. `userEmail` is — it is redacted, and it
  belongs in the database.
- Anything deeper than four levels of nesting should be flattened at the call
  site rather than trusted to the redact list.

`tests/unit/logging-redaction.test.ts` asserts all of this. It carries a
`@vitest-environment node` pragma because the suite is jsdom-wide and pino's
browser build performs no redaction at all — without the pragma every assertion
in that file would pass vacuously.

## Levels at runtime

```
APP_LOG_LEVEL=info    # this logger. trace|debug|info|warn|error|fatal|silent
LOG_LEVEL=info        # Prisma's, and only Prisma's
```

These are deliberately separate variables. `LOG_LEVEL=debug` switches the Prisma
client to full query logging, which prints every statement **with its bound
parameters** — client names, phone numbers, event details. Never reuse it to
raise the application's verbosity, and never raise it in a deployed environment.

## Reading the output

```bash
npm run dev | npx pino-pretty   # readable, coloured
npm run dev                     # raw NDJSON, as a log platform ingests it
```

In production this is Vercel's runtime log. Retention there is short — one hour
on Hobby, one day on Pro — so anything that needs to outlive an incident has to
be drained somewhere durable.

## Server only

`lib/logging/context.ts` imports `node:async_hooks`. Importing `log` into a
`"use client"` component fails the build. There is no client-side reporting yet.

Neither logging module carries `server-only`, and that is deliberate:
`lib/http/api-error.ts` imports the context module, and `lib/auth/errors.ts`
documents that api-error is reachable from modules that are not all
server-scoped. Adding the marker would make it transitive to every route and to
the tests that exercise them. `node:async_hooks` is the real boundary and it
enforces itself.

## What is not built yet

`getRequestId()` returns `null`. Nothing binds a route, a request id or an
organization onto a log line, so two failures from different endpoints are
currently indistinguishable beyond their status and error class. That arrives
with the `withRoute` wrapper and `bindActor` in `toContext()`.

Until then: a line tells you *what class of thing failed and why*, not *who it
happened to*.
