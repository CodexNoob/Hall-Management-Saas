import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorizeMember: vi.fn()
}));
// `vi.hoisted`, because the factories below are lifted above ordinary `const`
// declarations - and `authorize` imports the Prisma client at module load, so
// that factory runs during the import phase rather than lazily.
const {
  findMany,
  updateMany,
  adminSignOut,
  findFirst,
  update,
  userFindUnique,
  findCurrentDevice,
  revokeAllDevices,
  queryRaw,
  executeRaw
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  adminSignOut: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  userFindUnique: vi.fn(),
  findCurrentDevice: vi.fn(),
  revokeAllDevices: vi.fn(),
  queryRaw: vi.fn(),
  executeRaw: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userSession: { findMany, updateMany, findFirst, update },
    user: { findUnique: userFindUnique },
    $queryRaw: queryRaw,
    $executeRaw: executeRaw
  }
}));
vi.mock("@/lib/audit/activity-log", () => ({
  recordActivity: vi.fn(async () => ({ id: "log-1" }))
}));
vi.mock("@/lib/auth/device-trust", () => ({
  findCurrentDevice,
  revokeAllDevices
}));

const { sendSecurityEmail, sessionSignedOutEmail } = vi.hoisted(() => ({
  sendSecurityEmail: vi.fn(),
  sessionSignedOutEmail: vi.fn(() => ({ subject: "signed out", html: "" }))
}));

vi.mock("@/lib/auth/security-emails", () => ({
  sendSecurityEmail,
  sessionSignedOutEmail
}));

const { cookieSession } = vi.hoisted(() => ({
  cookieSession: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    auth: { admin: { signOut: adminSignOut } }
  }),
  // The transport the dashboard actually uses. `authenticated-fetch.ts` sends
  // no Authorization header - the session travels as a cookie - so this is the
  // path every real browser takes.
  createSupabaseServerClient: async () => ({
    auth: { getSession: cookieSession }
  })
}));

import { DELETE, GET } from "@/app/api/me/sessions/route";
import { recordActivity } from "@/lib/audit/activity-log";
import { authorizeMember } from "@/lib/authz/authorize";
import { authzContext } from "./authz-test-helpers";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
/** A real-shaped token, because the route reads `session_id` out of it. */
const tokenFor = (sessionId: string) =>
  `header.${Buffer.from(JSON.stringify({ sub: userId, session_id: sessionId })).toString("base64url")}.signature`;

const TOKEN = tokenFor("sess-current");

const request = (token: string | null = TOKEN, method = "DELETE") =>
  new Request("http://localhost/api/me/sessions", {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });

describe("DELETE /api/me/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminSignOut.mockResolvedValue({ data: null, error: null });
    findMany.mockResolvedValue([]);
    updateMany.mockResolvedValue({ count: 2 });
    cookieSession.mockResolvedValue({ data: { session: null }, error: null });
    findFirst.mockResolvedValue({
      id: "row-1",
      sessionId: "sess-other",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    });
    update.mockResolvedValue({});
    userFindUnique.mockResolvedValue({
      supabaseAuthId: "supabase-user-1",
      email: "ada@example.com",
      name: "Ada"
    });
    sendSecurityEmail.mockResolvedValue("sent");
    findCurrentDevice.mockResolvedValue(null);
    revokeAllDevices.mockResolvedValue(3);
    queryRaw.mockResolvedValue([]);
    executeRaw.mockResolvedValue(1);
    vi.mocked(authorizeMember).mockResolvedValue(
      authzContext({ organizationId, userId })
    );
  });

  /**
   * ONE DEVICE, AND ONLY THAT ONE.
   *
   * Supabase has no admin call that revokes a single session - `signOut` takes
   * a scope, never an id - so this path deletes the row from `auth.sessions`
   * directly. That is reaching into the auth schema, so the guards around it
   * are what these tests are really about.
   */
  describe("one device", () => {
    const one = (id = "row-1") =>
      new Request(`http://localhost/api/me/sessions?sessionId=${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${TOKEN}` }
      });

    it("ends the named session and nothing else", async () => {
      const response = await DELETE(one());

      expect(response.status).toBe(200);
      expect(executeRaw).toHaveBeenCalledTimes(1);
      // Never the blunt instrument: the bulk revocation must not fire for a
      // request that named one device.
      expect(adminSignOut).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    });

    /**
     * The ownership check, and the reason a forged id is harmless. The row is
     * looked up by `userId` as well as by its own id, so a request naming
     * somebody else's session finds nothing to delete.
     */
    it("looks the row up under the caller's own id", async () => {
      await DELETE(one());

      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "row-1", userId })
        })
      );
    });

    it("answers 404 for a session that is not the caller's", async () => {
      // Also the answer for one that does not exist. Existence is information.
      findFirst.mockResolvedValue(null);

      const response = await DELETE(one("somebody-elses-row"));

      expect(response.status).toBe(404);
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it("marks the row revoked so the list stops showing it", async () => {
      await DELETE(one());

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "row-1" },
          data: expect.objectContaining({ revokedAt: expect.any(Date) })
        })
      );
    });

    it("does not tell the browser to sign itself out", async () => {
      const response = await DELETE(one());

      expect(await response.json()).toEqual({
        revoked: true,
        endedCurrentSession: false
      });
    });

    it("refuses rather than guessing when the account has no Supabase id", async () => {
      userFindUnique.mockResolvedValue({ supabaseAuthId: null });

      const response = await DELETE(one());

      expect(response.status).toBe(409);
      expect(executeRaw).not.toHaveBeenCalled();
      expect(sendSecurityEmail).not.toHaveBeenCalled();
    });

    /**
     * Any trusted device may sign out any session - the primary's included -
     * so the owner is told, and from which device, after the fact.
     */
    it("emails the owner which session ended and from which device", async () => {
      const request = new Request("http://localhost/api/me/sessions?sessionId=row-1", {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${TOKEN}`,
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      await DELETE(request);

      expect(sendSecurityEmail).toHaveBeenCalledWith(
        "session_signed_out",
        "ada@example.com",
        expect.anything()
      );
      expect(sessionSignedOutEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Ada",
          device: "Safari on macOS",
          by: "Chrome on Windows"
        })
      );
      // After the fact: the session is already gone when the notice goes.
      expect(executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        sendSecurityEmail.mock.invocationCallOrder[0] as number
      );
    });

    it("keeps the sign-out when the notice cannot be sent", async () => {
      sendSecurityEmail.mockResolvedValue("failed");

      const response = await DELETE(one());

      expect(response.status).toBe(200);
      expect(executeRaw).toHaveBeenCalledTimes(1);
    });

    it("sends no notice for a session that was not the caller's", async () => {
      findFirst.mockResolvedValue(null);

      await DELETE(one("somebody-elses-row"));

      expect(sendSecurityEmail).not.toHaveBeenCalled();
    });
  });

  /** Sign out every untrusted device while preserving the confirmed primary. */
  describe("every device", () => {
    const all = () =>
      new Request("http://localhost/api/me/sessions?scope=all", {
        method: "DELETE",
        headers: { authorization: `Bearer ${TOKEN}` }
      });

    it("does not use global sign-out, which would revoke the primary too", async () => {
      await DELETE(all());

      expect(adminSignOut).not.toHaveBeenCalled();
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(queryRaw.mock.calls[0]?.[0].join(" ")).toContain("NOT EXISTS");
      expect(updateMany).not.toHaveBeenCalled();
    });

    it("keeps the current session when it belongs to the trusted primary", async () => {
      const response = await DELETE(all());

      expect(await response.json()).toEqual({
        revoked: true,
        endedCurrentSession: false
      });
    });

    it("preserves the current primary session even before its row is linked", async () => {
      findCurrentDevice.mockResolvedValue({
        id: "device-primary",
        isPrimary: true,
        trustedAt: new Date(),
        revokedAt: null
      });

      const response = await DELETE(all());

      expect(await response.json()).toEqual({
        revoked: true,
        endedCurrentSession: false
      });
      expect(queryRaw.mock.calls[0]).toContain("device-primary");
      expect(queryRaw.mock.calls[0]).toContain("sess-current");
    });

    it("ends the current session when it belongs to an untrusted device", async () => {
      queryRaw.mockResolvedValue([{ sessionId: "sess-current" }]);

      const response = await DELETE(all());

      expect(await response.json()).toEqual({
        revoked: true,
        endedCurrentSession: true
      });
    });

    it("marks revoked app sessions in the same transaction as the auth deletion", async () => {
      await DELETE(all());

      const query = queryRaw.mock.calls[0]?.[0].join(" ");
      expect(query).toContain("DELETE FROM auth.sessions");
      expect(query).toContain("UPDATE public.user_sessions");
      expect(query).toContain("AND NOT EXISTS");
    });

    /** Its existing meaning, unchanged: a sign-out, never a trust removal. */
    it("does not remove any device's trust", async () => {
      await DELETE(all());

      expect(revokeAllDevices).not.toHaveBeenCalled();
    });
  });

  /**
   * "SIGN OUT ALL DEVICES" - every device's trust, every session, this one
   * included. Distinct from `scope=all`, which keeps the primary signed in.
   */
  describe("all devices", () => {
    const allDevices = () =>
      new Request("http://localhost/api/me/sessions?scope=all-devices", {
        method: "DELETE",
        headers: { authorization: `Bearer ${TOKEN}` }
      });

    it("removes every device's trust, the primary included", async () => {
      await DELETE(allDevices());

      expect(revokeAllDevices).toHaveBeenCalledWith(expect.anything(), { userId });
    });

    it("ends every session including this one", async () => {
      const response = await DELETE(allDevices());

      expect(adminSignOut).toHaveBeenCalledWith(TOKEN, "global");
      expect(await response.json()).toEqual({
        revoked: true,
        endedCurrentSession: true
      });
    });

    /**
     * Trust first: once the rows are revoked the server refuses every browser,
     * so a sign-out that fails afterwards still leaves the account locked
     * rather than open.
     */
    it("removes trust before ending sessions", async () => {
      await DELETE(allDevices());

      expect(revokeAllDevices.mock.invocationCallOrder[0]).toBeLessThan(
        adminSignOut.mock.invocationCallOrder[0] as number
      );
    });

    it("marks every session row revoked, this one included", async () => {
      await DELETE(allDevices());

      expect(updateMany).toHaveBeenCalledWith({
        where: { userId, revokedAt: null },
        data: { revokedAt: expect.any(Date) }
      });
    });

    it("never uses the primary-preserving query", async () => {
      await DELETE(allDevices());

      expect(queryRaw).not.toHaveBeenCalled();
    });

    it("reports failure, unrecorded, when Supabase refuses - with trust already gone", async () => {
      adminSignOut.mockResolvedValue({
        data: null,
        error: new Error("revocation unavailable") as never
      });

      const response = await DELETE(allDevices());

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(revokeAllDevices).toHaveBeenCalled();
      expect(recordActivity).not.toHaveBeenCalled();
    });
  });

  it("keeps every device's trust when signing out other sessions", async () => {
    await DELETE(request());

    expect(revokeAllDevices).not.toHaveBeenCalled();
    expect(adminSignOut).toHaveBeenCalledWith(TOKEN, "others");
  });

  it("still defaults to leaving this device signed in", async () => {
    // The scope with no query string is unchanged, so an old client and the
    // API still agree about what pressing nothing in particular does.
    await DELETE(request());

    expect(adminSignOut).toHaveBeenCalledWith(TOKEN, "others");
  });

  /**
   * Marking our own rows is what stops the list going on showing devices that
   * can no longer renew. Everything EXCEPT the caller's own, to match what was
   * actually revoked at Supabase.
   */
  it("marks the other rows revoked and leaves this one alone", async () => {
    await DELETE(request());

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId,
          revokedAt: null,
          sessionId: { not: "sess-current" }
        })
      })
    );
  });

  /**
   * The whole point of the control. `global` would sign the person out of the
   * screen they are sitting at as well, which makes the safest action also the
   * most annoying one - and an action people put off is not a control.
   */
  it("revokes the other sessions and leaves this one signed in", async () => {
    const response = await DELETE(request());

    expect(response.status).toBe(200);
    expect(adminSignOut).toHaveBeenCalledWith(TOKEN, "others");
  });

  /**
   * An access token cannot be withdrawn once issued, so what is actually
   * revoked is the session this request authenticated with. Passing anything
   * other than the caller's own token would end the wrong sessions.
   */
  it("revokes the token the request arrived with", async () => {
    await DELETE(request("a.different.token"));

    expect(adminSignOut).toHaveBeenCalledWith("a.different.token", "others");
  });

  it("records it, because deciding your account is compromised is worth reconstructing", async () => {
    await DELETE(request());

    expect(recordActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId, userId }),
      expect.objectContaining({ action: "auth.sessions.revoked" })
    );
  });

  /**
   * The case that actually ships. `authenticated-fetch.ts` deliberately sends
   * no `Authorization` header - the session travels as a cookie and the token
   * travels once, not twice - so a route that reads only the header refuses
   * every browser while passing every test that hands it a bearer.
   */
  it("falls back to the cookie session when there is no bearer", async () => {
    cookieSession.mockResolvedValue({
      data: { session: { access_token: tokenFor("sess-from-cookie") } },
      error: null
    });

    const response = await DELETE(request(null));

    expect(response.status).toBe(200);
    expect(adminSignOut).toHaveBeenCalledWith(
      tokenFor("sess-from-cookie"),
      "others"
    );
  });

  it("marks the current session from the cookie when listing", async () => {
    cookieSession.mockResolvedValue({
      data: { session: { access_token: tokenFor("sess-phone") } },
      error: null
    });
    findMany.mockResolvedValue([
      {
        id: "row-2",
        sessionId: "sess-phone",
        userAgent: null,
        ipAddress: null,
        createdAt: new Date("2026-09-20T10:00:00.000Z"),
        lastSeenAt: new Date("2026-09-24T18:00:00.000Z")
      }
    ]);

    const body = await (await GET(request(null, "GET"))).json();

    expect(body.sessions[0].current).toBe(true);
  });

  it("refuses when neither transport yields a token, rather than revoking nothing quietly", async () => {
    const response = await DELETE(request(null));

    expect(response.status).toBe(400);
    expect(adminSignOut).not.toHaveBeenCalled();
  });

  /**
   * Supabase has no endpoint that enumerates sessions, which is the whole
   * reason these rows exist. The list is the caller's own by construction -
   * there is no parameter that could ask for anybody else's.
   */
  it("lists only this person's live sessions, marking the current one", async () => {
    findMany.mockResolvedValue([
      {
        id: "row-1",
        sessionId: "sess-current",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        ipAddress: "203.0.113.7",
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
        lastSeenAt: new Date("2026-09-25T09:00:00.000Z"),
        device: {
          isPrimary: true,
          confirmedAt: new Date(Date.now() - 24 * 60 * 60_000),
          trustExpiresAt: new Date(Date.now() + 29 * 24 * 60 * 60_000),
          revokedAt: null
        }
      },
      {
        id: "row-2",
        sessionId: "sess-phone",
        userAgent: null,
        ipAddress: null,
        createdAt: new Date("2026-09-20T10:00:00.000Z"),
        lastSeenAt: new Date("2026-09-24T18:00:00.000Z")
      }
    ]);

    const body = await (await GET(request(TOKEN, "GET"))).json();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId, revokedAt: null } })
    );
    expect(body.sessions).toHaveLength(2);
    expect(body.sessions[0]).toMatchObject({
      current: true,
      device: "Safari on macOS",
      ipAddress: "203.0.113.7",
      trustedDevice: true,
      primaryDevice: true
    });
    // A row with no user-agent still appears; its owner may recognise it from
    // when it signed in even if the device cannot be named.
    expect(body.sessions[1]).toMatchObject({ current: false, device: null });
    // The Supabase session id is an internal join key and never leaves here.
    expect(JSON.stringify(body)).not.toContain("sess-current");
  });

  /**
   * TRUSTED MEANS WHAT THE DEVICE GATE MEANS - primary or not. Labelling only
   * the primary made a trusted secondary (the one somebody was signing out
   * from) look untrusted.
   */
  it("labels every trusted device trusted, and only the first one primary", async () => {
    const DAY = 24 * 60 * 60_000;
    const row = (id: string, device: Record<string, unknown> | null) => ({
      id,
      sessionId: `sess-${id}`,
      userAgent: null,
      ipAddress: null,
      createdAt: new Date("2026-09-20T10:00:00.000Z"),
      lastSeenAt: new Date("2026-09-24T18:00:00.000Z"),
      device
    });
    findMany.mockResolvedValue([
      row("secondary", {
        isPrimary: false,
        confirmedAt: new Date(Date.now() - DAY),
        trustExpiresAt: new Date(Date.now() + 29 * DAY),
        revokedAt: null
      }),
      row("expired", {
        isPrimary: false,
        confirmedAt: new Date(Date.now() - 31 * DAY),
        trustExpiresAt: new Date(Date.now() - DAY),
        revokedAt: null
      }),
      row("removed", {
        isPrimary: true,
        confirmedAt: null,
        trustExpiresAt: null,
        revokedAt: new Date(Date.now() - DAY)
      }),
      row("unlinked", null)
    ]);

    const body = await (await GET(request(TOKEN, "GET"))).json();
    const byState = Object.fromEntries(
      body.sessions.map((session: { id: string }) => [session.id, session])
    );

    expect(byState.secondary).toMatchObject({ trustedDevice: true, primaryDevice: false });
    expect(byState.expired).toMatchObject({ trustedDevice: false });
    expect(byState.removed).toMatchObject({ trustedDevice: false });
    expect(byState.unlinked).toMatchObject({ trustedDevice: false, primaryDevice: false });
  });

  /**
   * The revocation is irreversible and has already happened by the time these
   * run. Failing the response would tell somebody their devices are still
   * signed in when they are not, and the natural response - pressing it again -
   * changes nothing.
   */
  it("still reports success when the bookkeeping fails after the revocation", async () => {
    updateMany.mockRejectedValue(
      new Error("relation user_sessions does not exist")
    );

    const response = await DELETE(request());

    expect(response.status).toBe(200);
    expect(adminSignOut).toHaveBeenCalledWith(TOKEN, "others");
  });

  it("still reports success when the audit row will not write", async () => {
    vi.mocked(recordActivity).mockRejectedValue(new Error("log unavailable"));

    const response = await DELETE(request());

    expect(response.status).toBe(200);
  });

  it("does not record the act when Supabase refused it", async () => {
    adminSignOut.mockResolvedValue({
      data: null,
      error: new Error("revocation unavailable") as never
    });

    const response = await DELETE(request());

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(recordActivity).not.toHaveBeenCalled();
  });
});
