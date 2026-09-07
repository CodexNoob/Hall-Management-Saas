const SENSITIVE_PARAMS = [
  "token_hash",
  "code",
  "token",
  "access_token",
  "refresh_token",
  "email"
];

/**
 * The credential channel `redact` cannot reach.
 *
 * By the time a value is in a query string it is part of a string, and
 * fast-redact matches object paths. `app/auth/confirm/route.ts` and
 * `app/auth/callback/route.ts` receive live one-time credentials as
 * `?token_hash=` and `?code=` - the invite and confirmation emails build
 * exactly those links - so anything logging a URL passes through here first.
 *
 * The censor is a bare token, NOT the `[redacted]` string the logger uses:
 * `URLSearchParams.toString()` percent-encodes brackets, so `[redacted]` comes
 * back as `%5Bredacted%5D` and a search for the marker misses precisely the
 * cases this function exists to cover.
 *
 * Lives in its own module, apart from `logger.ts`, because both halves of the
 * application need it and only one of them should be paying for pino. The
 * browser's Sentry config scrubs `event.request.url` with this, and importing
 * it from `logger.ts` would pull the logging engine into the client bundle to
 * get at fifteen lines of string handling. `logger.ts` re-exports it, so no
 * existing import had to move.
 */
export function safePath(path: string) {
  const [pathname, query] = path.split("?");

  if (!query) return pathname;

  const params = new URLSearchParams(query);

  for (const key of SENSITIVE_PARAMS) {
    if (params.has(key)) params.set(key, "REDACTED");
  }

  return `${pathname}?${params.toString()}`;
}
