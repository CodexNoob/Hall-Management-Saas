import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn()
}));

const {
  membershipFindFirst,
  sessionFindMany,
  sessionUpdateMany,
  executeRaw,
  transaction,
  loadActorFacts,
  rankOfPrincipal,
  writeAudit,
  assertRankCeiling
} = vi.hoisted(() => ({
  membershipFindFirst: vi.fn(),
  sessionFindMany: vi.fn(),
  sessionUpdateMany: vi.fn(),
  executeRaw: vi.fn(),
  transaction: vi.fn(),
  loadActorFacts: vi.fn(),
  rankOfPrincipal: vi.fn(),
  writeAudit: vi.fn(),
  assertRankCeiling: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMembership: { findFirst: membershipFindFirst },
    userSession: { findMany: sessionFindMany, updateMany: sessionUpdateMany },
    $executeRaw: executeRaw,
    $transaction: transaction
  }
}));

vi.mock("@/lib/authz/admin/context", () => ({
  loadActorFacts,
  rankOfPrincipal
}));
vi.mock("@/lib/authz/admin/audit", () => ({ writeAudit }));
vi.mock("@/lib/authz/guards", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/guards")>()),
  assertRankCeiling
}));

import {
  DELETE,
  GET
} from "@/features/administration/server/staff-session-handlers";
import { authorize } from "@/lib/authz/authorize";
import { authzContext } from "./authz-test-helpers";

/**
 * AN ADMINISTRATOR ENDING SOMEBODY ELSE'S DEVICE SESSION.
 *
 * The counterpart to `/api/me/sessions`, and every test here is about a guard
 * rather than a feature. `/api/me/sessions` is safe by construction - every
 * query is filtered by the caller's own id and there is nothing to name past
 * it. This route takes a target, so the guards ARE the design: the tenant
 * boundary, the rank ceiling, and the two independent ownership checks on the
 * delete.
 */

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actorPrincipal = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const targetPrincipal = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const targetUserId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const params = { params: Promise.resolve({ principalId: targetPrincipal }) };

const request = (query = "") =>
  new Request(`http://localhost/api/staff/${targetPrincipal}/sessions${query}`, {
    method: "DELETE"
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authorize).mockResolvedValue(
    authzContext({ organizationId, principalId: actorPrincipal })
  );
  membershipFindFirst.mockResolvedValue({
    userId: targetUserId,
    user: {
      id: targetUserId,
      name: "Sample Cook",
      supabaseAuthId: "supabase-target"
    }
  });
  sessionFindMany.mockResolvedValue([
    { id: "row-1", sessionId: "sess-1" },
    { id: "row-2", sessionId: "sess-2" }
  ]);
  sessionUpdateMany.mockResolvedValue({ count: 1 });
  executeRaw.mockResolvedValue(1);
  loadActorFacts.mockResolvedValue({ rank: 200 });
  rankOfPrincipal.mockResolvedValue(400);
  writeAudit.mockResolvedValue(undefined);
  assertRankCeiling.mockImplementation(() => undefined);
  // The handler's transaction is a pass-through in these tests; what happens
  // inside it is asserted through the mocks it calls.
  transaction.mockImplementation(
    async (fn: (client: unknown) => Promise<unknown>) =>
      fn({
        organizationMembership: { findFirst: membershipFindFirst }
      })
  );
});

describe("GET /api/staff/[principalId]/sessions", () => {
  it("is gated on staff.deactivate", async () => {
    await GET(new Request("http://localhost/x"), params);

    expect(authorize).toHaveBeenCalledWith(expect.anything(), "staff.deactivate");
  });

  /**
   * THE TENANT BOUNDARY. `organizationId` comes from the authorized actor and
   * never from the request, so a principal id belonging to another tenant finds
   * no membership and the route answers 404.
   */
  it("looks the target up inside the caller's own organization", async () => {
    await GET(new Request("http://localhost/x"), params);

    expect(membershipFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { principalId: targetPrincipal, organizationId }
      })
    );
  });

  it("answers 404 for a principal in another organization", async () => {
    membershipFindFirst.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/x"), params);

    expect(response.status).toBe(404);
  });

  it("never sends the Supabase session id to the browser", async () => {
    // Our row id is enough to name a session across our own API. The Supabase
    // id is what identifies one TO SUPABASE and has no business on a client.
    sessionFindMany.mockResolvedValue([
      {
        id: "row-1",
        userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0",
        ipAddress: "203.0.113.9",
        city: "Manila",
        country: "PH",
        createdAt: new Date(),
        lastSeenAt: new Date()
      }
    ]);

    const response = await GET(new Request("http://localhost/x"), params);
    const body = JSON.stringify(await response.json());

    expect(body).not.toContain("sessionId");
    expect(body).toContain("Chrome on Windows");
  });
});

describe("DELETE /api/staff/[principalId]/sessions", () => {
  it("is gated on staff.deactivate", async () => {
    await DELETE(request("?scope=all"), params);

    expect(authorize).toHaveBeenCalledWith(expect.anything(), "staff.deactivate");
  });

  /**
   * THE RANK CEILING, and the reason this route cannot be used to get round the
   * stronger control beside it. Ending somebody's session is an exercise of
   * authority over them, so an administrator does not get to sign the owner
   * out - exactly as they cannot deactivate them.
   */
  it("refuses to act on somebody who outranks the caller", async () => {
    assertRankCeiling.mockImplementation(() => {
      throw new Error("rank ceiling");
    });

    const response = await DELETE(request("?sessionId=row-1"), params);

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("checks the ceiling before anything is deleted", async () => {
    await DELETE(request("?sessionId=row-1"), params);

    expect(assertRankCeiling).toHaveBeenCalled();
  });

  it("ends the one named session", async () => {
    sessionFindMany.mockResolvedValue([{ id: "row-1", sessionId: "sess-1" }]);

    const response = await DELETE(request("?sessionId=row-1"), params);

    expect(await response.json()).toEqual({ revoked: 1 });
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  /**
   * The first of the two ownership checks. The row is selected under the
   * SUBJECT's user id, so a session id belonging to a third person finds
   * nothing - the second check lives in the SQL itself.
   */
  it("selects the row under the target's own user id", async () => {
    await DELETE(request("?sessionId=row-1"), params);

    expect(sessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: targetUserId, id: "row-1" })
      })
    );
  });

  it("answers 404 for a session that is not theirs", async () => {
    sessionFindMany.mockResolvedValue([]);

    const response = await DELETE(request("?sessionId=somebody-elses"), params);

    expect(response.status).toBe(404);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("ends every session on scope=all", async () => {
    const response = await DELETE(request("?scope=all"), params);

    expect(await response.json()).toEqual({ revoked: 2 });
    expect(executeRaw).toHaveBeenCalledTimes(2);
  });

  it("refuses a request that names nothing at all", async () => {
    // Defaulting to "all" would make a mistyped query string end every device
    // this person has.
    const response = await DELETE(request(), params);

    expect(response.status).toBe(400);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("marks the rows revoked so the list stops showing them", async () => {
    await DELETE(request("?scope=all"), params);

    expect(sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["row-1", "row-2"] } }
      })
    );
  });

  /**
   * Recorded as its own action rather than as a deactivation. The account is
   * still active and the person still works here; filing this under
   * `staff.deactivated` would overstate what happened and make the trail
   * unreadable for the case it exists to explain.
   */
  it("audits it as a session revocation, not a deactivation", async () => {
    await DELETE(request("?sessionId=row-1"), params);

    expect(writeAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        action: "staff.session.revoked",
        subjectPrincipalId: targetPrincipal
      })
    );
  });

  it("refuses when the account has no Supabase sign-in record", async () => {
    membershipFindFirst.mockResolvedValue({
      userId: targetUserId,
      user: { id: targetUserId, name: "Sample Cook", supabaseAuthId: null }
    });

    const response = await DELETE(request("?scope=all"), params);

    expect(response.status).toBe(409);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("still answers when the bookkeeping update fails", async () => {
    // The sessions are already gone at Supabase. A 500 here would say the
    // device is still signed in when it is not, and pressing again changes
    // nothing.
    sessionUpdateMany.mockRejectedValue(new Error("database down"));

    const response = await DELETE(request("?scope=all"), params);

    expect(response.status).toBe(200);
  });
});
