import pino from "pino";

/**
 * The only module in the codebase that knows a logging library exists.
 *
 * Call sites import `log` from `lib/logging/context`, never pino directly, so
 * the engine and the destination can both be swapped without touching a route.
 *
 * Deliberately free of `server-only`, for the same reason `lib/auth/errors.ts`
 * is: `lib/http/api-error.ts` imports the context module, and api-error is
 * itself imported from modules that are not all server-scoped. Adding the
 * marker here would make it transitive to every route and to the tests that
 * exercise them. `node:async_hooks` in the context module is the real server
 * boundary, and it enforces itself.
 */

/**
 * Keys whose VALUE must never reach the log stream, at any depth.
 *
 * pino's redaction is fast-redact, whose `*` spans exactly one path segment -
 * `*.email` matches `user.email` and misses `booking.client.email`. There is no
 * recursive form, so the depths are enumerated below rather than assumed. Three
 * levels covers every shape this application actually logs; anything deeper
 * should be flattened at the call site instead of trusted to this list.
 */
const SENSITIVE_KEYS = [
  // Credentials. Anything replayable against us or against a partner.
  "authorization",
  "cookie",
  "password",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "accessToken",
  "refreshToken",
  "tokenHash",
  "idempotencyKey",
  // Partner secrets, and what Plaid hands back.
  "client_secret",
  "public_token",
  "link_token",
  "account_id",
  // PII. `userId` is a uuid and stays - it is the primary debugging axis.
  // These are the identifiers behind it, and they belong in the database.
  "email",
  "userEmail",
  "phone",
  "phoneNumber"
];

/** Exported so the redaction test can assert against the real list. */
export const redactPaths = [
  // Header bags, which arrive under a couple of different parent keys.
  "req.headers.cookie",
  "req.headers.authorization",
  "headers.cookie",
  "headers.authorization",
  ...SENSITIVE_KEYS.flatMap((key) => [
    key,
    `*.${key}`,
    `*.*.${key}`,
    `*.*.*.${key}`
  ])
];

/**
 * Not `LOG_LEVEL`. That variable belongs to Prisma - `lib/prisma.ts` turns on
 * full SQL query logging, bound parameters included, when it is `debug` - and
 * sharing it would mean raising the application's verbosity also exports tenant
 * data. `lib/env.ts` declares and validates both.
 *
 * Read from `process.env` rather than `getEnv()` on purpose: this module is
 * imported by `api-error.ts` and therefore by every route and every route test,
 * and a logger that can throw at import time is a logger that takes the
 * application down with it. An unrecognised value degrades to `info` instead.
 */
const LEVELS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent"
] as const;

function resolveLevel() {
  const configured = process.env.APP_LOG_LEVEL;

  return (LEVELS as readonly string[]).includes(configured ?? "")
    ? (configured as (typeof LEVELS)[number])
    : "info";
}

export const baseLogger = pino({
  level: resolveLevel(),
  // Every line carries these, so any query can be scoped to one deployment.
  base: {
    service: "event-core",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"
  },
  redact: { paths: redactPaths, censor: "[redacted]" },
  // `level: "error"` rather than `level: 50`. Every log platform filters on the
  // word, and nobody remembers the numbers.
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime
});

/**
 * Re-exported, not defined here.
 *
 * `safePath` moved to its own module when the browser's Sentry config needed
 * it: importing it from this file would have pulled pino into the client bundle
 * for the sake of some string handling. Kept exported from here so the existing
 * call sites and `tests/unit/logging-redaction.test.ts` did not have to move.
 */
export { safePath } from "@/lib/logging/safe-path";
