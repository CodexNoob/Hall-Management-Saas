import { beforeEach, describe, expect, it, vi } from "vitest";
import { authzContext } from "@/tests/unit/authz-test-helpers";

const mocks = vi.hoisted(() => ({
  prisma: {
    activityLog: { findMany: vi.fn() },
    authorizationAudit: { findMany: vi.fn() }
  },
  authorize: vi.fn(),
  hasPermission: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
// Keep the real AuthorizationError: createApiErrorResponse does an `instanceof`
// check against it, so a bare stub breaks the error path.
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: mocks.authorize,
  hasPermission: mocks.hasPermission
}));

import { GET } from "@/app/api/activity/route";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function get(search = "") {
  return GET(new Request(`http://localhost/api/activity${search}`));
}

function activityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: new Date("2026-09-08T10:00:00.000Z"),
    actionType: "settings.hall.updated",
    message: "Edited the Grand Ballroom hall: capacity.",
    userName: "Sarah Klein",
    userId: "22222222-2222-4222-8222-222222222222",
    eventId: null,
    oldValue: null,
    newValue: { hallId: "hall-1", fields: ["capacity"] },
    ...overrides
  };
}

function privilegeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    createdAt: new Date("2026-09-08T11:00:00.000Z"),
    action: "role.assigned",
    actorId: "22222222-2222-4222-8222-222222222222",
    actorName: "Sarah Klein",
    subjectName: "Dana Klein",
    detail: { added: ["menu.update"] },
    ...overrides
  };
}

describe("GET /api/activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue(authzContext({ organizationId }));
    mocks.hasPermission.mockResolvedValue(false);
    mocks.prisma.activityLog.findMany.mockResolvedValue([]);
    mocks.prisma.authorizationAudit.findMany.mockResolvedValue([]);
  });

  it("asks for activity.read, not audit.read", async () => {
    await get();

    expect(mocks.authorize).toHaveBeenCalledWith(
      expect.any(Request),
      "activity.read"
    );
  });

  it("filters to the caller's organization", async () => {
    await get();

    expect(mocks.prisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId })
      })
    );
  });

  it("labels each entry from the catalog and files it under its module", async () => {
    mocks.prisma.activityLog.findMany.mockResolvedValue([activityRow()]);

    const body = await (await get()).json();

    expect(body.entries[0]).toMatchObject({
      source: "activity",
      action: "settings.hall.updated",
      label: "Hall edited",
      module: "Settings"
    });
  });

  it("files a legacy human-readable action under Other and keeps it readable", async () => {
    mocks.prisma.activityLog.findMany.mockResolvedValue([
      activityRow({ actionType: "Client Created" })
    ]);

    const body = await (await get()).json();

    expect(body.entries[0]).toMatchObject({
      label: "Client Created",
      module: "Other"
    });
  });

  describe("the privilege trail", () => {
    it("is not read at all without audit.read", async () => {
      mocks.prisma.authorizationAudit.findMany.mockResolvedValue([
        privilegeRow()
      ]);

      const body = await (await get()).json();

      // Not merely filtered out of the response - never queried. A caller
      // without the key is not told the other table exists.
      expect(mocks.prisma.authorizationAudit.findMany).not.toHaveBeenCalled();
      expect(body.entries).toEqual([]);
      expect(body.includesPrivilegeTrail).toBe(false);
    });

    it("is merged in, newest first, for a caller who holds audit.read", async () => {
      mocks.hasPermission.mockResolvedValue(true);
      mocks.prisma.activityLog.findMany.mockResolvedValue([activityRow()]);
      mocks.prisma.authorizationAudit.findMany.mockResolvedValue([
        privilegeRow()
      ]);

      const body = await (await get()).json();

      expect(body.includesPrivilegeTrail).toBe(true);
      // 11:00 before 10:00 - the merge orders across both tables rather than
      // concatenating them.
      expect(body.entries.map((entry: { source: string }) => entry.source)).toEqual([
        "privilege",
        "activity"
      ]);
    });

    it("composes a sentence for a privilege row, which stores none", async () => {
      mocks.hasPermission.mockResolvedValue(true);
      mocks.prisma.authorizationAudit.findMany.mockResolvedValue([
        privilegeRow()
      ]);

      const body = await (await get()).json();

      expect(body.entries[0]).toMatchObject({
        module: "Access",
        message: "role.assigned · Dana Klein"
      });
    });

    it("is skipped for a module filter that names another module", async () => {
      mocks.hasPermission.mockResolvedValue(true);

      await get("?module=Kitchen");

      expect(mocks.prisma.authorizationAudit.findMany).not.toHaveBeenCalled();
      expect(mocks.prisma.activityLog.findMany).toHaveBeenCalled();
    });

    it("is the only source when the module filter names Access", async () => {
      mocks.hasPermission.mockResolvedValue(true);

      await get("?module=Access");

      expect(mocks.prisma.authorizationAudit.findMany).toHaveBeenCalled();
      expect(mocks.prisma.activityLog.findMany).not.toHaveBeenCalled();
    });
  });

  describe("filters", () => {
    it("expands a module into the keys it holds", async () => {
      await get("?module=Calendar");

      const where = mocks.prisma.activityLog.findMany.mock.calls[0][0].where;

      expect(where.actionType.in).toEqual([
        "calendar.blocked_date.created",
        "calendar.blocked_date.removed"
      ]);
    });

    it("lets an exact action narrow a module rather than being overridden", async () => {
      // Both write `actionType`, and spread the wrong way round this silently
      // returns the whole module for a request that asked for one action.
      await get("?module=Calendar&action=calendar.blocked_date.created");

      const where = mocks.prisma.activityLog.findMany.mock.calls[0][0].where;

      expect(where.actionType).toBe("calendar.blocked_date.created");
    });

    it("refuses a module that is not one", async () => {
      expect((await get("?module=Nonsense")).status).toBe(400);
    });
  });

  describe("paging", () => {
    it("offers no cursor when the page is not full", async () => {
      mocks.prisma.activityLog.findMany.mockResolvedValue([activityRow()]);

      const body = await (await get()).json();

      expect(body.nextCursor).toBeNull();
    });

    it("keysets on (createdAt, id) so a tie cannot drop a row", async () => {
      // A merged feed cannot key on one table's row id: the rows between would
      // vanish, and the feed would read as missing history rather than as
      // paging through it.
      const cursor = Buffer.from(
        "2026-09-08T10:00:00.000Z|11111111-1111-4111-8111-111111111111"
      ).toString("base64url");

      await get(`?cursor=${cursor}`);

      const where = mocks.prisma.activityLog.findMany.mock.calls[0][0].where;

      expect(where.OR).toEqual([
        { createdAt: { lt: new Date("2026-09-08T10:00:00.000Z") } },
        {
          createdAt: new Date("2026-09-08T10:00:00.000Z"),
          id: { lt: "11111111-1111-4111-8111-111111111111" }
        }
      ]);
    });

    it("treats a malformed cursor as a stale bookmark, not an error", async () => {
      const response = await get("?cursor=not-a-cursor");

      expect(response.status).toBe(200);
      expect(
        mocks.prisma.activityLog.findMany.mock.calls[0][0].where
      ).not.toHaveProperty("OR");
    });
  });

  describe("csv export", () => {
    it("answers as a download with the escaped rows", async () => {
      mocks.prisma.activityLog.findMany.mockResolvedValue([
        activityRow({ message: 'Edited "Grand Ballroom", again' })
      ]);

      const response = await get("?format=csv");
      const text = await response.text();

      expect(response.headers.get("content-type")).toContain("text/csv");
      expect(response.headers.get("content-disposition")).toContain(
        "attachment"
      );
      // RFC 4180: quotes doubled, the whole field wrapped.
      expect(text).toContain('"Edited ""Grand Ballroom"", again"');
    });
  });
});
