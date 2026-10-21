import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  describeUserAgent,
  readRequestIp,
  readRequestLocation,
  readSessionId
} from "@/lib/auth/session-record";

function tokenWith(claims: Record<string, unknown>) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `header.${payload}.signature`;
}

describe("readSessionId", () => {
  it("reads the claim that ties our row to Supabase's session", () => {
    expect(readSessionId(tokenWith({ sub: "user", session_id: "sess-1" }))).toBe(
      "sess-1"
    );
  });

  /**
   * Everything downstream treats null as "do not track this session". Inventing
   * an identifier instead would write a row per request and turn the list into
   * a log of every page load.
   */
  it("returns null rather than inventing an identifier", () => {
    for (const token of [
      tokenWith({ sub: "user" }),
      tokenWith({ session_id: "" }),
      tokenWith({ session_id: 42 }),
      "not-a-jwt",
      "header..signature",
      ""
    ]) {
      expect(readSessionId(token)).toBeNull();
    }
  });
});

describe("readRequestIp", () => {
  /**
   * `x-forwarded-for` is appended to by each hop, so the leftmost entry is the
   * client and everything after it is a proxy. Taking the last would record our
   * own edge on every row, identically, which is worse than recording nothing.
   */
  it("takes the client from the front of the forwarded chain", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" }
    });

    expect(readRequestIp(request)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to nothing", () => {
    expect(
      readRequestIp(
        new Request("http://localhost", { headers: { "x-real-ip": "198.51.100.4" } })
      )
    ).toBe("198.51.100.4");

    expect(readRequestIp(new Request("http://localhost"))).toBeNull();
  });
});

describe("readRequestLocation", () => {
  const withHeaders = (headers: Record<string, string>) =>
    readRequestLocation(new Request("http://localhost", { headers }));

  /**
   * Vercel percent-encodes the city, because a header cannot carry a space.
   * Storing it raw shows somebody "San%20Francisco" as the place they
   * signed in from.
   */
  it("decodes the city the edge encoded", () => {
    expect(
      withHeaders({
        "x-vercel-ip-city": "San%20Francisco",
        "x-vercel-ip-country": "US"
      })
    ).toEqual({ city: "San Francisco", region: null, country: "US" });
  });

  /**
   * The state or province, which is what makes a city name unambiguous where
   * more than one exists - Springfield, Portland, Columbus.
   */
  it("reads the region the edge resolved", () => {
    expect(
      withHeaders({
        "x-vercel-ip-city": "Portland",
        "x-vercel-ip-country-region": "OR",
        "x-vercel-ip-country": "US"
      })
    ).toEqual({ city: "Portland", region: "OR", country: "US" });
  });

  it("decodes a region with a space in it, like the city", () => {
    // "Metro%20Manila" shown raw is exactly the bug the city decoding exists
    // to prevent, and the region arrives encoded the same way.
    expect(
      withHeaders({
        "x-vercel-ip-city": "Manila",
        "x-vercel-ip-country-region": "Metro%20Manila",
        "x-vercel-ip-country": "PH"
      }).region
    ).toBe("Metro Manila");
  });

  /**
   * An edge that placed the request but could not name a region has still
   * placed it. Falling back to the development stand-in here would replace a
   * real location with an invented one.
   */
  it("keeps a real location that has no region", () => {
    expect(
      withHeaders({ "x-vercel-ip-city": "Manila", "x-vercel-ip-country": "PH" })
    ).toEqual({ city: "Manila", region: null, country: "PH" });
  });

  it("falls back to Cloudflare's country", () => {
    expect(withHeaders({ "cf-ipcountry": "PH" })).toEqual({
      city: null,
      region: null,
      country: "PH"
    });
  });

  /**
   * Cloudflare sends "XX" for an address it cannot place and "T1" for Tor.
   * Neither is a country, and storing either would render as a country name
   * that does not exist.
   */
  it("treats the placeholder codes as no country at all", () => {
    expect(withHeaders({ "cf-ipcountry": "XX" }).country).toBeNull();
    expect(withHeaders({ "cf-ipcountry": "T1" }).country).toBeNull();
  });

  /**
   * Local development, where nothing sits in front of the app to resolve it.
   * The expected state rather than a fault - a row still shows its device and
   * when it was last seen.
   */
  it("returns nothing when no edge resolved it", () => {
    expect(withHeaders({})).toEqual({ city: null, region: null, country: null });
  });

  /**
   * The local-development stand-in.
   *
   * Without it the feature cannot be seen working on the machine it is built
   * on - every row reads "Location unavailable", which is correct and
   * indistinguishable from nothing having been implemented. Set by hand rather
   * than resolved, so no address leaves the developer's network to fill in a
   * display field.
   */
  describe("DEV_SESSION_LOCATION", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("stands in for the edge when one is configured", () => {
      vi.stubEnv("DEV_SESSION_LOCATION", "Manila,PH");

      expect(withHeaders({})).toEqual({ city: "Manila", region: null, country: "PH" });
    });

    /**
     * Three fields, and the LAST is always the country code.
     *
     * Counting from the end is what lets the region be optional without a flag:
     * a two-field value has always meant city and country, and it still does.
     */
    it("takes a region from a three-field value", () => {
      vi.stubEnv("DEV_SESSION_LOCATION", "Manila,Metro Manila,PH");

      expect(withHeaders({})).toEqual({
        city: "Manila",
        region: "Metro Manila",
        country: "PH"
      });
    });

    it("reads a lone value as the country, not the city", () => {
      // A city with no country is a place `Intl` cannot name, so the single
      // field has to be the code.
      vi.stubEnv("DEV_SESSION_LOCATION", "PH");

      expect(withHeaders({})).toEqual({ city: null, region: null, country: "PH" });
    });

    it("never overrides what a real edge resolved", () => {
      vi.stubEnv("DEV_SESSION_LOCATION", "Manila,PH");

      expect(withHeaders({ "x-vercel-ip-country": "US" })).toEqual({
        city: null,
        region: null,
        country: "US"
      });
    });

    it("is ignored in production, where the edge is the only source", () => {
      // Otherwise a stray variable in a deployment would label every session
      // in the fleet with the same invented city.
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("DEV_SESSION_LOCATION", "Manila,PH");

      expect(withHeaders({})).toEqual({ city: null, region: null, country: null });
    });

    it("ignores a blank or malformed value rather than storing an empty place", () => {
      vi.stubEnv("DEV_SESSION_LOCATION", "  ");
      expect(withHeaders({})).toEqual({ city: null, region: null, country: null });

      vi.stubEnv("DEV_SESSION_LOCATION", ",");
      expect(withHeaders({})).toEqual({ city: null, region: null, country: null });
    });
  });
});

describe("describeUserAgent", () => {
  /**
   * The ordering traps. Edge and Opera both carry "Chrome" in their own
   * strings, and every browser on iOS is Safari's engine under another name -
   * so a naive table reports half the fleet as Chrome and the other half as
   * Safari.
   */
  it("prefers the specific browser over the one it impersonates", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
      )
    ).toBe("Edge on Windows");

    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0"
      )
    ).toBe("Opera on Windows");

    // Chrome on iOS is CriOS, and its string still ends in Safari.
    expect(
      describeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe("Chrome on iPhone");
  });

  it("names the ordinary cases", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
      )
    ).toBe("Safari on macOS");

    expect(
      describeUserAgent(
        "Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0"
      )
    ).toBe("Firefox on Android");
  });

  /**
   * Null rather than "Unknown device", so the caller can fall back to the raw
   * string - its owner can often recognise a device this parser cannot.
   */
  it("gives nothing back when it recognises nothing", () => {
    expect(describeUserAgent(null)).toBeNull();
    expect(describeUserAgent("curl/8.4.0")).toBeNull();
  });

  it("reports whichever half it does recognise", () => {
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0)")).toBe("Windows");
  });
});
