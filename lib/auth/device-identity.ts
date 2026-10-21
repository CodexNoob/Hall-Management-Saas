import "server-only";

import { randomBytes } from "node:crypto";

import { serverHmac } from "@/lib/auth/security-codes";

/**
 * WHICH BROWSER IS THIS.
 *
 * A random secret, generated once per browser and kept in an httpOnly cookie.
 * The database stores only an HMAC of it (keyed with the server secret), so:
 *   - JavaScript on the page cannot read it (httpOnly), and
 *   - a copy of `user_devices` cannot be turned back into a cookie.
 *
 * The raw secret is NEVER returned in a response body and NEVER logged. The
 * only place it travels is the Set-Cookie header that plants it.
 *
 * This identifies a browser, not a person and not a login. The same cookie
 * seen for two different accounts maps to two separate device rows
 * (lib/auth/device-trust.ts): trust is always per user.
 */

export const DEVICE_COOKIE = "event-core.device";

/**
 * About 13 months - the longest lifetime browsers honour for a cookie. A
 * device that is not seen for longer than that is new again, which is fine.
 */
const DEVICE_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;

/** 32 random bytes, base64url: 43 characters. */
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Whether an unconfirmed device is held at the gate.
 *
 * On unless `DEVICE_CONFIRMATION=off`. The switch exists for one situation:
 * email delivery is broken, nobody can receive a confirmation code, and the
 * whole organization - administrators included - would otherwise be locked
 * out until it is fixed. It is an operator's emergency lever, not a setting;
 * device rows and emails keep working with it off, only the gate stops.
 */
export function isDeviceConfirmationEnforced() {
  return process.env.DEVICE_CONFIRMATION?.trim().toLowerCase() !== "off";
}

export function generateDeviceSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashDeviceSecret(secret: string) {
  return serverHmac(`device:${secret}`);
}

/** The value if it has the shape of one of our secrets, otherwise null. */
export function parseDeviceSecret(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  return SECRET_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * The device secret from the request's cookies, or null when there is none
 * or it is not one of ours. A malformed value is treated as absent - it is
 * replaced with a fresh secret rather than hashed and trusted.
 */
export function readDeviceSecret(request: Request): string | null {
  const header = request.headers.get("cookie");

  if (!header) return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");

    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== DEVICE_COOKIE) continue;

    return parseDeviceSecret(part.slice(separator + 1));
  }

  return null;
}

/**
 * How the cookie is planted.
 *
 * httpOnly - no script can read it. Secure - never sent over plain http in
 * production. SameSite=Lax - not sent on cross-site subrequests, still sent
 * when somebody follows a link to the app.
 */
export function deviceCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE_S
  };
}
