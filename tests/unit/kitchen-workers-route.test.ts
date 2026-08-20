import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server-auth", () => ({
  AuthorizationError: class AuthorizationError extends Error {
    status = 403;
  },
  requirePermission: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    kitchenWorker: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}));

import { GET, POST } from "@/app/api/kitchen/workers/route";
import { DELETE, PATCH } from "@/app/api/kitchen/workers/[workerId]/route";
import { requirePermission } from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";

/**
 * The roster behind the assignment control.
 *
 * `kitchen_workers` sat in the schema with a reader and no writer, so every
 * dish on the board offered exactly one option: "Unassigned". These tests hold
 * the two rules that make the list usable once it can be written - one worker
 * per name, and a retired worker keeps existing.
 */

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const workerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId,
  membership: { role: "OWNER" },
  access: null
};

const params = Promise.resolve({ workerId });

function request(body?: unknown, method = "POST") {
  return new Request("http://localhost/api/kitchen/workers", {
    method: body === undefined ? "GET" : method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

function worker(overrides: Record<string, unknown> = {}) {
  return {
    id: workerId,
    name: "Mendy",
    color: "#1f4d73",
    isActive: true,
    ...overrides
  };
}

describe("kitchen workers route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(actor as never);
    vi.mocked(prisma.kitchenWorker.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.kitchenWorker.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.kitchenWorker.create).mockResolvedValue(worker() as never);
    vi.mocked(prisma.kitchenWorker.update).mockResolvedValue(worker() as never);
  });

  describe("listing", () => {
    it("is gated on the permission that assigns work", async () => {
      await GET(request());

      expect(requirePermission).toHaveBeenCalledWith(
        expect.anything(),
        "canAssignWorkers"
      );
    });

    it("includes retired workers, unlike the board's own read", async () => {
      // This is the screen where someone puts a worker back, so it has to be
      // able to show them.
      await GET(request());

      const query = vi.mocked(prisma.kitchenWorker.findMany).mock.calls[0]?.[0];

      expect(query?.where).toEqual({ organizationId });
      expect(query?.where).not.toHaveProperty("isActive");
    });

    it("scopes to the actor's organization", async () => {
      await GET(request());

      expect(
        vi.mocked(prisma.kitchenWorker.findMany).mock.calls[0]?.[0]?.where
      ).toMatchObject({ organizationId });
    });
  });

  describe("creating", () => {
    it("stores a trimmed name", async () => {
      // The unique index compares lower(name), which would hold "Mendy" beside
      // "Mendy " quite happily.
      const response = await POST(request({ name: "  Mendy  " }));

      expect(response.status).toBe(201);
      expect(
        vi.mocked(prisma.kitchenWorker.create).mock.calls[0]?.[0]?.data
      ).toMatchObject({ name: "Mendy", organizationId });
    });

    it("refuses a name that already exists, whatever its case", async () => {
      vi.mocked(prisma.kitchenWorker.findFirst).mockResolvedValue(
        worker() as never
      );

      const response = await POST(request({ name: "mendy" }));

      expect(response.status).toBe(409);
      expect(prisma.kitchenWorker.create).not.toHaveBeenCalled();
      expect(
        vi.mocked(prisma.kitchenWorker.findFirst).mock.calls[0]?.[0]?.where
      ).toMatchObject({ name: { equals: "mendy", mode: "insensitive" } });
    });

    it("points at the retired worker rather than inventing a second", async () => {
      vi.mocked(prisma.kitchenWorker.findFirst).mockResolvedValue(
        worker({ isActive: false }) as never
      );

      const response = await POST(request({ name: "Mendy" }));
      const body = (await response.json()) as {
        error: string;
        workerId: string;
      };

      expect(response.status).toBe(409);
      expect(body.error).toContain("retired");
      expect(body.workerId).toBe(workerId);
    });

    it("survives losing the race to the unique index", async () => {
      // Two people adding the same name at once: the pre-check passes for both
      // and Postgres refuses the second.
      vi.mocked(prisma.kitchenWorker.create).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("duplicate", {
          code: "P2002",
          clientVersion: "7.8.0"
        })
      );

      const response = await POST(request({ name: "Mendy" }));

      expect(response.status).toBe(409);
    });

    it("rejects a blank name and an unusable colour", async () => {
      expect((await POST(request({ name: "   " }))).status).toBe(400);
      expect(
        (await POST(request({ name: "Mendy", color: "puce" }))).status
      ).toBe(400);
    });
  });

  describe("updating", () => {
    it("answers 404 for a worker in another organization", async () => {
      vi.mocked(prisma.kitchenWorker.findFirst).mockResolvedValue(
        null as never
      );

      const response = await PATCH(request({ name: "Shloimy" }, "PATCH"), {
        params
      });

      expect(response.status).toBe(404);
      expect(prisma.kitchenWorker.update).not.toHaveBeenCalled();
    });

    it("refuses a rename onto another worker's name", async () => {
      vi.mocked(prisma.kitchenWorker.findFirst)
        .mockResolvedValueOnce({ id: workerId } as never)
        .mockResolvedValueOnce({ id: "other" } as never);

      const response = await PATCH(request({ name: "Shloimy" }, "PATCH"), {
        params
      });

      expect(response.status).toBe(409);
      expect(prisma.kitchenWorker.update).not.toHaveBeenCalled();
    });

    it("lets a worker keep their own name", async () => {
      vi.mocked(prisma.kitchenWorker.findFirst)
        .mockResolvedValueOnce({ id: workerId } as never)
        .mockResolvedValueOnce(null as never);

      const response = await PATCH(request({ name: "Mendy" }, "PATCH"), {
        params
      });

      expect(response.status).toBe(200);
      // The clash query has to exclude the worker being renamed, or changing
      // "Mendy" to "Mendy" collides with itself.
      expect(
        vi.mocked(prisma.kitchenWorker.findFirst).mock.calls[1]?.[0]?.where
      ).toMatchObject({ id: { not: workerId } });
    });

    it("restores a retired worker", async () => {
      vi.mocked(prisma.kitchenWorker.findFirst).mockResolvedValue({
        id: workerId
      } as never);

      await PATCH(request({ isActive: true }, "PATCH"), { params });

      expect(
        vi.mocked(prisma.kitchenWorker.update).mock.calls[0]?.[0]?.data
      ).toMatchObject({ isActive: true });
    });

    it("rejects an empty body", async () => {
      const response = await PATCH(request({}, "PATCH"), { params });

      expect(response.status).toBe(400);
    });
  });

  describe("retiring", () => {
    it("deactivates rather than deleting", async () => {
      // KitchenItemStatus points at this row, so a delete either fails on the
      // foreign key or takes the name off work already done.
      vi.mocked(prisma.kitchenWorker.findFirst).mockResolvedValue({
        id: workerId
      } as never);

      const response = await DELETE(request(undefined, "DELETE"), { params });

      expect(response.status).toBe(200);
      expect(
        vi.mocked(prisma.kitchenWorker.update).mock.calls[0]?.[0]?.data
      ).toEqual({ isActive: false });
    });

    it("answers 404 for a worker in another organization", async () => {
      vi.mocked(prisma.kitchenWorker.findFirst).mockResolvedValue(
        null as never
      );

      const response = await DELETE(request(undefined, "DELETE"), { params });

      expect(response.status).toBe(404);
      expect(prisma.kitchenWorker.update).not.toHaveBeenCalled();
    });
  });
});
