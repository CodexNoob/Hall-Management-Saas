import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ SESSION_SECRET: "test-secret" }) }));

import {
  DEVICE_COOKIE,
  deviceCookieOptions,
  generateDeviceSecret,
  hashDeviceSecret,
  readDeviceSecret
} from "@/lib/auth/device-identity";

const withCookie = (cookie: string | null) =>
  new Request("http://localhost/api/auth/session", {
    method: "POST",
    headers: cookie ? { cookie } : {}
  });

describe("device identity", () => {
  it("mints long, random, URL-safe secrets", () => {
    const first = generateDeviceSecret();
    const second = generateDeviceSecret();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it("hashes a secret the same way every time, and differently from another", () => {
    const secret = generateDeviceSecret();

    expect(hashDeviceSecret(secret)).toBe(hashDeviceSecret(secret));
    expect(hashDeviceSecret(secret)).not.toBe(hashDeviceSecret(generateDeviceSecret()));
    // The stored value is not the secret itself.
    expect(hashDeviceSecret(secret)).not.toContain(secret);
  });

  it("reads the secret from its own cookie among others", () => {
    const secret = generateDeviceSecret();

    expect(
      readDeviceSecret(withCookie(`other=1; ${DEVICE_COOKIE}=${secret}; sb-token=abc`))
    ).toBe(secret);
  });

  it("treats a missing or malformed cookie as no device", () => {
    expect(readDeviceSecret(withCookie(null))).toBeNull();
    expect(readDeviceSecret(withCookie(`${DEVICE_COOKIE}=short`))).toBeNull();
    expect(readDeviceSecret(withCookie(`${DEVICE_COOKIE}=${"x".repeat(42)}!`))).toBeNull();
  });

  it("plants the cookie httpOnly, SameSite=Lax, and Secure over https", () => {
    expect(deviceCookieOptions(true)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/"
    });
    expect(deviceCookieOptions(false).secure).toBe(false);
  });
});
