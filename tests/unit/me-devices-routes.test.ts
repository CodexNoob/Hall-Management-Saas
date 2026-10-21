import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  getEnv: () => ({ SESSION_SECRET: "test-secret" })
}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorizeMember: vi.fn()
}));
vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null)
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getSession: async () => ({ data: { session: null }, error: null }) }
  })
}));

const mocks = vi.hoisted(() => ({
  findCurrentDevice: vi.fn(),
  listDevices: vi.fn(),
  revokeDevice: vi.fn(),
  confirmDevice: vi.fn(),
  sendDeviceRemovalCode: vi.fn(),
  verifyDeviceRemovalCode: vi.fn()
}));
const identity = vi.hoisted(() => ({ resolveAssuranceLevel: vi.fn() }));
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  userDevice: { findFirst: vi.fn() },
  $queryRaw: vi.fn()
}));
const audit = vi.hoisted(() => ({ recordActivity: vi.fn() }));
const email = vi.hoisted(() => ({ sendSecurityEmail: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/audit/activity-log", () => audit);
vi.mock("@/lib/auth/device-trust", () => mocks);
vi.mock("@/lib/auth/security-emails", () => ({
  sendSecurityEmail: email.sendSecurityEmail,
  deviceRemovedEmail: () => ({ subject: "removed", html: "" })
}));
// The VERIFIED assurance level - the route must not read it off the token
// payload itself, and this test's token is unsigned.
vi.mock("@/lib/auth/identity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/identity")>()),
  resolveAssuranceLevel: identity.resolveAssuranceLevel
}));

import { POST as confirm } from "@/app/api/me/devices/confirm/route";
import { POST as requestRemovalCode } from "@/app/api/me/devices/removal-code/route";
import { DELETE, GET } from "@/app/api/me/devices/route";
import { DEVICE_COOKIE } from "@/lib/auth/device-identity";
import { authorizeMember } from "@/lib/authz/authorize";
import { authzContext } from "./authz-test-helpers";

const SECRET = "s".repeat(43);
/** A device id as the database makes them - the routes validate the shape. */
const TARGET = "9b2f8c1e-4d3a-4e5b-8c7d-1a2b3c4d5e6f";
const TOKEN = `header.${Buffer.from(
  JSON.stringify({ sub: "supabase-1", session_id: "sess-1" })
).toString("base64url")}.signature`;

const request = (url: string, method: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      cookie: `${DEVICE_COOKIE}=${SECRET}`,
      ...(body ? { "content-type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authorizeMember).mockResolvedValue(
    authzContext({ organizationId: "org-1", userId: "user-1" })
  );
  mocks.findCurrentDevice.mockResolvedValue({
    id: "device-1",
    trustedAt: null,
    confirmedAt: null,
    revokedAt: null,
    trustExpiresAt: null
  });
  identity.resolveAssuranceLevel.mockResolvedValue("aal1");
  // One row answers both reads the removal makes of the caller's account.
  db.user.findUnique.mockResolvedValue({
    supabaseAuthId: "supabase-1",
    email: "ada@example.com",
    name: "Ada"
  });
  db.user.findUniqueOrThrow.mockResolvedValue({ email: "ada@example.com", name: "Ada" });
  db.userDevice.findFirst.mockResolvedValue({ id: TARGET, userAgent: null });
  db.$queryRaw.mockResolvedValue([]);
  audit.recordActivity.mockResolvedValue({ id: "log-1" });
  email.sendSecurityEmail.mockResolvedValue("sent");
});

const DAY_MS = 24 * 60 * 60_000;

describe("GET /api/me/devices", () => {
  it("lists the caller's own devices and marks this one", async () => {
    mocks.listDevices.mockResolvedValue([{ id: "device-1", current: true, trusted: false }]);

    const response = await GET(request("/api/me/devices", "GET"));
    const text = await response.text();

    expect(mocks.findCurrentDevice).toHaveBeenCalledWith(expect.anything(), "user-1", SECRET);
    expect(mocks.listDevices).toHaveBeenCalledWith(expect.anything(), "user-1", "device-1");
    // The raw secret from the cookie is never echoed back.
    expect(text).not.toContain(SECRET);
  });

  it("does not require the 2FA exemption - it runs after a full sign-in", async () => {
    mocks.listDevices.mockResolvedValue([]);
    await GET(request("/api/me/devices", "GET"));

    expect(vi.mocked(authorizeMember).mock.calls[0]?.[1]).toBeUndefined();
  });
});

/**
 * REMOVING A DEVICE NEEDS THE EMAILED CODE, AND NOTHING IS REVOKED BEFORE IT.
 *
 * `verifyDeviceRemovalCode` is the code's own life (device-trust.test.ts);
 * these cover what the ROUTE does with each answer.
 */
describe("DELETE /api/me/devices", () => {
  const remove = (body: unknown = { deviceId: TARGET, code: "123456" }) =>
    DELETE(request("/api/me/devices", "DELETE", body));

  beforeEach(() => {
    mocks.verifyDeviceRemovalCode.mockResolvedValue({
      status: "verified",
      grantExpiresAt: new Date()
    });
    mocks.revokeDevice.mockResolvedValue(true);
  });

  it("requires a code - an id alone removes nothing", async () => {
    const response = await remove({ deviceId: TARGET });

    expect(response.status).toBe(400);
    expect(mocks.verifyDeviceRemovalCode).not.toHaveBeenCalled();
    expect(mocks.revokeDevice).not.toHaveBeenCalled();
  });

  it("checks the code for this person, this session and this device", async () => {
    await remove();

    expect(mocks.verifyDeviceRemovalCode).toHaveBeenCalledWith(expect.anything(), {
      userId: "user-1",
      sessionId: "sess-1",
      deviceId: TARGET,
      code: "123456"
    });
  });

  it.each([
    ["wrong", { status: "invalid", attemptsLeft: 4 }, 400],
    ["locked", { status: "locked" }, 429],
    ["expired", { status: "expired" }, 410],
    ["replayed", { status: "missing" }, 410]
  ])("revokes nothing for a %s code", async (_label, result, status) => {
    mocks.verifyDeviceRemovalCode.mockResolvedValue(result);

    const response = await remove();

    expect(response.status).toBe(status);
    expect(mocks.revokeDevice).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(email.sendSecurityEmail).not.toHaveBeenCalled();
  });

  /** Ownership first: no attempt is spent on somebody else's device. */
  it("answers 404 for a device that is not the caller's, before any code check", async () => {
    db.userDevice.findFirst.mockResolvedValue(null);

    const response = await remove();

    expect(response.status).toBe(404);
    expect(db.userDevice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TARGET, userId: "user-1", revokedAt: null }
      })
    );
    expect(mocks.verifyDeviceRemovalCode).not.toHaveBeenCalled();
  });

  /**
   * PRIMARY IS NOT PROTECTION. The route never consults it: the primary is
   * removed, and signed out, exactly like any other device.
   */
  it("removes the primary device like any other", async () => {
    db.userDevice.findFirst.mockResolvedValue({ id: TARGET, userAgent: null, isPrimary: true });

    const response = await remove();

    expect(response.status).toBe(200);
    expect(mocks.revokeDevice).toHaveBeenCalledWith(expect.anything(), {
      userId: "user-1",
      deviceId: TARGET
    });
  });

  it("ends the removed device's sessions at Supabase and in our list", async () => {
    db.$queryRaw.mockResolvedValue([{ sessionId: "sess-laptop" }]);

    const response = await remove();
    const [strings, ...values] = db.$queryRaw.mock.calls[0] as [string[], ...unknown[]];
    const sql = strings.join(" ");

    expect(sql).toContain("app_session.device_id =");
    expect(sql).toContain("DELETE FROM auth.sessions");
    expect(sql).toContain("UPDATE public.user_sessions");
    // Scoped to the caller on both sides, and to THIS device.
    expect(values).toEqual(expect.arrayContaining(["user-1", TARGET, "supabase-1"]));
    expect(await response.json()).toMatchObject({
      removed: true,
      endedSessions: 1,
      endedCurrentSession: false
    });
  });

  it("revokes trust before ending sessions", async () => {
    await remove();

    expect(mocks.revokeDevice.mock.invocationCallOrder[0]).toBeLessThan(
      db.$queryRaw.mock.invocationCallOrder[0] as number
    );
  });

  it("leaves this browser signed in when another device is removed", async () => {
    const response = await remove();
    const values = (db.$queryRaw.mock.calls[0] as unknown[]).slice(1);

    expect(values).not.toContain("sess-1");
    expect((await response.json()).endedCurrentSession).toBe(false);
  });

  /**
   * Removing THIS browser ends this session too - by id, so even a session
   * recorded before sessions were linked to devices is caught - and tells the
   * browser to clear itself and go to sign-in.
   */
  it("ends the current session when this browser is the one removed", async () => {
    mocks.findCurrentDevice.mockResolvedValue({ id: TARGET });

    const response = await remove();
    const values = (db.$queryRaw.mock.calls[0] as unknown[]).slice(1);

    expect(values).toContain("sess-1");
    expect(await response.json()).toMatchObject({
      removed: true,
      endedCurrentSession: true
    });
  });

  it("emails the owner after the device is removed", async () => {
    await remove();

    expect(email.sendSecurityEmail).toHaveBeenCalledWith(
      "device_removed",
      "ada@example.com",
      expect.anything()
    );
    expect(mocks.revokeDevice.mock.invocationCallOrder[0]).toBeLessThan(
      email.sendSecurityEmail.mock.invocationCallOrder[0] as number
    );
  });

  /** A notice that fails never undoes the removal it describes. */
  it.each(["failed", "unconfigured"])(
    "keeps the removal when the notice %s",
    async (outcome) => {
      email.sendSecurityEmail.mockResolvedValue(outcome);

      const response = await remove();

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ removed: true });
    }
  );

  it("keeps the removal when the notice throws", async () => {
    email.sendSecurityEmail.mockRejectedValue(new Error("provider down"));

    const response = await remove();

    expect(response.status).toBe(200);
  });

  /**
   * The device is already untrusted and refused by the server, so a failure
   * to end its sessions is logged - never turned into an error that says the
   * removal did not happen.
   */
  it("still reports the removal when ending its sessions fails", async () => {
    mocks.findCurrentDevice.mockResolvedValue({ id: TARGET });
    db.$queryRaw.mockRejectedValue(new Error("auth schema unavailable"));

    const response = await remove();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      removed: true,
      endedSessions: 0,
      endedCurrentSession: true
    });
  });

  it("records the removal", async () => {
    await remove();

    expect(audit.recordActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "user-1" }),
      expect.objectContaining({ action: "auth.sessions.revoked" })
    );
  });

  /** Email confirms the removal; it never stands in for the second factor. */
  it("is not exempt from the 2FA or device gates", async () => {
    await remove();

    expect(vi.mocked(authorizeMember).mock.calls[0]?.[1]).toBeUndefined();
  });

  it("never returns the code", async () => {
    const text = await (await remove()).text();

    expect(text).not.toContain("123456");
  });
});

describe("POST /api/me/devices/removal-code", () => {
  const ask = (body: unknown = { deviceId: TARGET }) =>
    requestRemovalCode(request("/api/me/devices/removal-code", "POST", body));

  beforeEach(() => {
    mocks.sendDeviceRemovalCode.mockResolvedValue({
      status: "sent",
      resendAvailableAt: new Date("2026-10-08T12:01:00Z"),
      expiresAt: new Date("2026-10-08T12:10:00Z")
    });
  });

  it("emails a code bound to this person, session and device - and removes nothing", async () => {
    const response = await ask();

    expect(response.status).toBe(200);
    expect(mocks.sendDeviceRemovalCode).toHaveBeenCalledWith(expect.anything(), {
      userId: "user-1",
      organizationId: "org-1",
      sessionId: "sess-1",
      device: { id: TARGET, userAgent: null },
      owner: { email: "ada@example.com", name: "Ada" }
    });
    expect(await response.json()).toEqual({
      sentTo: "a•••@example.com",
      expiresAt: "2026-10-08T12:10:00.000Z",
      resendAvailableAt: "2026-10-08T12:01:00.000Z"
    });
    expect(mocks.revokeDevice).not.toHaveBeenCalled();
  });

  it("answers 404 for a device that is not the caller's", async () => {
    db.userDevice.findFirst.mockResolvedValue(null);

    const response = await ask();

    expect(response.status).toBe(404);
    expect(mocks.sendDeviceRemovalCode).not.toHaveBeenCalled();
  });

  it("refuses a malformed device id", async () => {
    const response = await ask({ deviceId: "not-a-uuid" });

    expect(response.status).toBe(400);
    expect(mocks.sendDeviceRemovalCode).not.toHaveBeenCalled();
  });

  it("answers 429 with when to retry when throttled", async () => {
    mocks.sendDeviceRemovalCode.mockResolvedValue({
      status: "throttled",
      reason: "cooldown",
      resendAvailableAt: new Date("2026-10-08T12:01:00Z")
    });

    const response = await ask();

    expect(response.status).toBe(429);
    expect((await response.json()).resendAvailableAt).toBe(
      "2026-10-08T12:01:00.000Z"
    );
  });

  it("says the device was not removed when the code could not be delivered", async () => {
    mocks.sendDeviceRemovalCode.mockResolvedValue({ status: "undelivered" });

    const response = await ask();

    expect(response.status).toBe(502);
    expect((await response.json()).error).toMatch(/not removed/);
    expect(mocks.revokeDevice).not.toHaveBeenCalled();
  });

  it("is not exempt from the 2FA or device gates", async () => {
    await ask();

    expect(vi.mocked(authorizeMember).mock.calls[0]?.[1]).toBeUndefined();
  });
});

describe("POST /api/me/devices/confirm", () => {
  it("confirms THIS browser - the one its cookie names - in this session", async () => {
    mocks.confirmDevice.mockResolvedValue({ status: "verified", grantExpiresAt: new Date() });

    const response = await confirm(request("/api/me/devices/confirm", "POST", { code: "123456" }));

    expect(response.status).toBe(200);
    expect(mocks.confirmDevice).toHaveBeenCalledWith(expect.anything(), {
      userId: "user-1",
      deviceId: "device-1",
      sessionId: "sess-1",
      code: "123456",
      mfaVerified: false
    });
  });

  /**
   * Only a session that cleared the authenticator makes the device remember
   * it - and that is read from the verified token, never the request body.
   */
  it("remembers the authenticator only when this session cleared it", async () => {
    mocks.confirmDevice.mockResolvedValue({ status: "verified", grantExpiresAt: new Date() });
    identity.resolveAssuranceLevel.mockResolvedValue("aal2");

    await confirm(request("/api/me/devices/confirm", "POST", { code: "123456" }));

    expect(mocks.confirmDevice.mock.calls[0]?.[1]).toMatchObject({
      mfaVerified: true
    });
  });

  it("confirms an expired device again like a new one", async () => {
    mocks.findCurrentDevice.mockResolvedValue({
      id: "device-1",
      trustedAt: null,
      confirmedAt: new Date(Date.now() - 31 * DAY_MS),
      revokedAt: null,
      trustExpiresAt: new Date(Date.now() - DAY_MS)
    });
    mocks.confirmDevice.mockResolvedValue({ status: "verified", grantExpiresAt: new Date() });

    const response = await confirm(request("/api/me/devices/confirm", "POST", { code: "123456" }));

    expect(response.status).toBe(200);
    expect(mocks.confirmDevice).toHaveBeenCalledTimes(1);
  });

  it("does not spend a code on a device that is still trusted", async () => {
    mocks.findCurrentDevice.mockResolvedValue({
      id: "device-1",
      trustedAt: null,
      confirmedAt: new Date(Date.now() - DAY_MS),
      revokedAt: null,
      trustExpiresAt: new Date(Date.now() + 29 * DAY_MS)
    });

    const response = await confirm(request("/api/me/devices/confirm", "POST", { code: "123456" }));

    expect(await response.json()).toEqual({ confirmed: true, trusted: true });
    expect(mocks.confirmDevice).not.toHaveBeenCalled();
  });

  it("answers before the device is trusted - it is the route that clears the gate", async () => {
    mocks.confirmDevice.mockResolvedValue({ status: "verified", grantExpiresAt: new Date() });

    await confirm(request("/api/me/devices/confirm", "POST", { code: "123456" }));

    // The device exemption only. It does NOT waive the second factor.
    expect(vi.mocked(authorizeMember).mock.calls[0]?.[1]).toEqual({
      allowUnconfirmedDevice: true
    });
  });

  it("refuses to take a device id from the body", async () => {
    const response = await confirm(
      request("/api/me/devices/confirm", "POST", { code: "123456", deviceId: "someone-elses" })
    );

    expect(response.status).toBe(400);
    expect(mocks.confirmDevice).not.toHaveBeenCalled();
  });

  it("refuses when this browser has no known device", async () => {
    mocks.findCurrentDevice.mockResolvedValue(null);

    const response = await confirm(request("/api/me/devices/confirm", "POST", { code: "123456" }));

    expect(response.status).toBe(400);
  });

  it.each([
    [{ status: "invalid", attemptsLeft: 2 }, 400],
    [{ status: "locked" }, 429],
    [{ status: "expired" }, 410]
  ])("answers %o with %i", async (result, status) => {
    mocks.confirmDevice.mockResolvedValue(result);

    const response = await confirm(request("/api/me/devices/confirm", "POST", { code: "123456" }));

    expect(response.status).toBe(status);
  });
});
