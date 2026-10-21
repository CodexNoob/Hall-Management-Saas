import "server-only";

import type { Prisma, UserSession } from "@prisma/client";

import { log } from "@/lib/logging/context";

/**
 * Recording where somebody is signed in, so the Security screen can show it.
 *
 * Kept out of the route handler because all three of the awkward parts are
 * here: finding the session's identity inside the access token, deciding what
 * a user-agent string is called, and working out what counts as one visit
 * rather than a stream of them.
 */

/**
 * The `session_id` claim from a Supabase access token.
 *
 * Read rather than verified, deliberately: by the time this is called the
 * token has already been checked against the Auth server by `getUser`, and
 * re-verifying it here would be a second network round trip to learn something
 * the first one already proved. The claim is only ever used as a key for the
 * caller's own row, so a forged one would let somebody rename their own
 * session and nothing else.
 *
 * Null when the claim is absent, which older tokens and some custom JWT setups
 * will be. Everything downstream treats that as "do not track this session"
 * rather than inventing an identifier - a row per request would turn the list
 * into a log.
 */
export function readSessionId(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];

    if (!payload) return null;

    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { session_id?: unknown };

    return typeof claims.session_id === "string" && claims.session_id
      ? claims.session_id
      : null;
  } catch {
    return null;
  }
}

/**
 * The address the request came from, as the proxy in front of us reports it.
 *
 * `x-forwarded-for` is a list appended to by each hop, and the leftmost entry
 * is the original client - the ones after it are the proxies. Trusting the
 * last would record our own edge on every row.
 */
export function readRequestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    const client = forwarded.split(",")[0]?.trim();
    if (client) return client;
  }

  return request.headers.get("x-real-ip")?.trim() || null;
}

/**
 * Roughly where the request came from, as the edge already worked it out.
 *
 * Vercel resolves this at its edge and puts it on the request; Cloudflare sets
 * a country. Reading the headers means no IP address leaves our infrastructure
 * to answer the question, no key, no per-lookup cost, and no outbound call to
 * track - a geolocation API would have been all four.
 *
 * Empty in local development, where nothing sits in front of the app to set
 * them. That is the expected state rather than a fault, and the screen shows a
 * row without a location perfectly well.
 */
export function readRequestLocation(request: Request): {
  city: string | null;
  region: string | null;
  country: string | null;
} {
  /**
   * Percent-encoded by Vercel, because neither a city nor a region name is
   * header-safe - "San%20Francisco" would otherwise be shown to somebody
   * exactly like that, and so would "Metro%20Manila".
   */
  const decodeHeader = (name: string) => {
    const raw = request.headers.get(name);

    if (!raw) return null;

    try {
      return decodeURIComponent(raw).trim() || null;
    } catch {
      // A header that is not valid percent-encoding is still more useful shown
      // than discarded, so it goes through as it arrived.
      return raw.trim() || null;
    }
  };

  const city = decodeHeader("x-vercel-ip-city");
  const region = decodeHeader("x-vercel-ip-country-region");

  const rawCountry =
    request.headers.get("x-vercel-ip-country")?.trim() ||
    // Cloudflare's equivalent. "XX" is what it sends for an address it cannot
    // place, and "T1" for Tor - neither is a country, so neither is stored.
    request.headers.get("cf-ipcountry")?.trim() ||
    null;

  const country =
    rawCountry && !["XX", "T1"].includes(rawCountry.toUpperCase())
      ? rawCountry
      : null;

  // No edge in front of the app, so no edge resolved anything. Only then, and
  // only outside production, does the stand-in apply - a request that reached a
  // real edge keeps what the edge said, even if that was nothing useful.
  //
  // `region` is not part of this test on purpose: an edge that resolved a city
  // and no region has still resolved the request, and falling back would
  // replace a real location with an invented one.
  if (!city && !country) return developmentLocation();

  return { city, region, country };
}

/**
 * A location to stand in for the one an edge would have resolved, in local
 * development only.
 *
 * `next dev` is spoken to directly by the browser, so no `x-vercel-ip-*` header
 * exists and the request IP is loopback - there is no input a lookup could work
 * from, and the Security screen shows every session with no place on it. That
 * is correct behaviour and reads exactly like a broken feature.
 *
 * Read from the environment rather than resolved: geolocating the machine would
 * mean an outbound call, a third party and the developer's own address leaving
 * their network, to fill in a display field on a screen they are testing. This
 * costs nothing and is inert unless somebody sets it.
 *
 * `DEV_SESSION_LOCATION` takes one, two or three comma-separated fields, and
 * THE LAST ONE IS ALWAYS THE COUNTRY CODE:
 *
 *   "PH"                     -> Philippines
 *   "Manila,PH"              -> Manila, Philippines
 *   "Manila,Metro Manila,PH" -> Manila, Metro Manila, Philippines
 *
 * Counting from the end rather than the start is what lets the region be
 * optional without a flag: a two-field value has always meant city and country,
 * and it still does.
 *
 * Ignored entirely in production, where the edge is the only source.
 */
function developmentLocation(): {
  city: string | null;
  region: string | null;
  country: string | null;
} {
  const empty = { city: null, region: null, country: null };

  if (process.env.NODE_ENV === "production") return empty;

  const configured = process.env.DEV_SESSION_LOCATION?.trim();

  if (!configured) return empty;

  const parts = configured.split(",").map((part) => part.trim());
  // The country is the last field, whatever the length. A city on its own would
  // be a location nothing can name.
  const country = parts[parts.length - 1] || null;

  return {
    city: parts.length > 1 ? parts[0] || null : null,
    region: parts.length > 2 ? parts[1] || null : null,
    country
  };
}

/**
 * A user-agent reduced to something a person recognises their own device by.
 *
 * Order matters in both lists. Edge and Opera put "Chrome" in their own
 * strings, and every browser on iOS is Safari's engine wearing another name,
 * so the more specific token has to be tested first or everything reports as
 * Chrome. This is a display label and nothing branches on it.
 */
const BROWSERS: Array<[RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\//, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bCriOS\//, "Chrome"],
  [/\bChrome\//, "Chrome"],
  [/\bSafari\//, "Safari"]
];

const PLATFORMS: Array<[RegExp, string]> = [
  [/\biPhone\b/, "iPhone"],
  [/\biPad\b/, "iPad"],
  [/\bAndroid\b/, "Android"],
  [/\bWindows NT\b/, "Windows"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bLinux\b/, "Linux"]
];

function match(value: string, table: Array<[RegExp, string]>) {
  return table.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

/**
 * "Chrome on Windows", or as much of it as the string supports.
 *
 * Returns null rather than "Unknown device" when nothing matches, so the caller
 * can fall back to showing the raw user-agent - its owner can often recognise a
 * device this parser cannot.
 */
export function describeUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;

  const browser = match(userAgent, BROWSERS);
  const platform = match(userAgent, PLATFORMS);

  if (browser && platform) return `${browser} on ${platform}`;

  return browser ?? platform;
}

/**
 * Records that this session was seen, creating the row the first time.
 *
 * Called from the session sync, which the dashboard hits on every cold load
 * past its five-minute cache - so `lastSeenAt` is a heartbeat rather than a
 * sign-in time, and `createdAt` is the sign-in time.
 *
 * Failure here must never fail the sync. Somebody whose session list is a
 * moment stale is a cosmetic problem; somebody who cannot load the dashboard
 * because a display table would not write is an outage.
 */
export async function touchUserSession(
  client:
    | Prisma.TransactionClient
    | { userSession: Prisma.UserSessionDelegate },
  input: {
    userId: string;
    sessionId: string;
    deviceId?: string | null;
    userAgent: string | null;
    ipAddress: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
  }
): Promise<UserSession | null> {
  try {
    return await client.userSession.upsert({
      where: { sessionId: input.sessionId },
      create: {
        userId: input.userId,
        sessionId: input.sessionId,
        ...(input.deviceId ? { deviceId: input.deviceId } : {}),
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        city: input.city,
        region: input.region,
        country: input.country
      },
      // The address, the browser and the place can all change within one
      // session - a laptop moves between networks, and a phone moves between
      // cities - so the newest reading wins rather than the row keeping
      // whatever it was opened with.
      //
      // Except where the newest reading is nothing. A sync that arrives with
      // no location header, which is every request in local development,
      // should not blank a location an earlier one resolved.
      update: {
        lastSeenAt: new Date(),
        ...(input.deviceId ? { deviceId: input.deviceId } : {}),
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        ...(input.city ? { city: input.city } : {}),
        ...(input.region ? { region: input.region } : {}),
        ...(input.country ? { country: input.country } : {})
      }
    });
  } catch (recordError) {
    /**
     * Still never fails the sync - a stale session list is cosmetic and a
     * dashboard that will not load is an outage - but it is no longer SILENT.
     *
     * It was, and that was a mistake. When the Security screen and the staff
     * profile both said "not signed in on any device", there was nothing
     * anywhere to say whether the write had been attempted and refused or had
     * never run at all. A swallow with no line is a failure you can only debug
     * by reading the source.
     *
     * `userId` is the debugging axis and is not personal data. The user agent,
     * the address and the location are deliberately NOT logged - they are
     * precisely the fields this table exists to hold carefully.
     */
    log.warn(
      { userId: input.userId, err: String(recordError) },
      "user_session_not_recorded"
    );

    return null;
  }
}
