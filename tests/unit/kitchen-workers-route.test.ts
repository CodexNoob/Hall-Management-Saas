import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    kitchenWorker: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    organizationMembership: { findMany: vi.fn(), findFirst: vi.fn() }
  }
}));
// Who holds a key is the resolver's question and has its own suite; this route
// only has to ask it and honour the answer.
vi.mock("@/lib/authz/decide", () => ({
  principalIdsHolding: vi.fn()
}));

import { GET, POST } from "@/app/api/kitchen/workers/route";
import { authorize } from "@/lib/authz/authorize";
import { principalIdsHolding } from "@/lib/authz/decide";
import { prisma } from "@/lib/prisma";
import { authzContext } from "./authz-test-helpers";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** The principals the resolver reports as able to advance production status. */
function eligible(...principalIds: string[]) {
  vi.mocked(principalIdsHolding).mockResolvedValue(new Set(principalIds));
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/kitchen/workers", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

describe("kitchen workers route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(authzContext({ organizationId }));
    eligible();
  });

  describe("listing", () => {
    it("offers eligible staff who are not already workers", async () => {
      eligible("principal-1", "principal-2");
      vi.mocked(prisma.kitchenWorker.findMany).mockResolvedValue([
        { id: "w1", name: "Mendy", userId, isActive: true, color: null },
        {
          id: "w2",
          name: "Old manual worker",
          userId: null,
          isActive: true,
          color: null
        },
        {
          id: "w3",
          name: "Not kitchen anymore",
          userId: "user-3",
          isActive: true,
          color: null
        }
      ] as never);
      vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
        // Already a worker - must not be offered twice.
        {
          principalId: "principal-1",
          user: { id: userId, name: "Mendy", email: "m@x.test" }
        },
        {
          principalId: "principal-2",
          user: { id: "user-2", name: "Shloimy", email: "s@x.test" }
        },
        // Cannot advance production status - not eligible at all.
        {
          principalId: "principal-3",
          user: { id: "user-3", name: "Rivky", email: "r@x.test" }
        }
      ] as never);

      const body = await (await GET(new Request("http://localhost/api/kitchen/workers"))).json();

      expect(body.workers).toEqual([
        { id: "w1", name: "Mendy", userId, isActive: true, color: null }
      ]);
      expect(body.availableStaff).toEqual([
        { id: "user-2", name: "Shloimy" }
      ]);
    });

    it("falls back to the email when a staff member has no name", async () => {
      eligible("principal-2");
      vi.mocked(prisma.kitchenWorker.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
        {
          principalId: "principal-2",
          user: { id: "user-2", name: "  ", email: "chef@x.test" }
        }
      ] as never);

      const body = await (await GET(new Request("http://localhost/api/kitchen/workers"))).json();

      expect(body.availableStaff).toEqual([
        { id: "user-2", name: "chef@x.test" }
      ]);
    });
  });

  describe("adding", () => {
    it("refuses a free-text name, which no longer identifies anyone", async () => {
      const response = await POST(postRequest({ name: "Mendy", color: null }));

      expect(response.status).toBe(400);
      expect(prisma.kitchenWorker.create).not.toHaveBeenCalled();
    });

    it("refuses a staff member who cannot advance production status", async () => {
      // The dropdown only offers eligible staff, but the rule is enforced here
      // rather than trusted from whatever the browser sent.
      eligible("principal-other");
      vi.mocked(prisma.organizationMembership.findFirst).mockResolvedValue({
        principalId: "principal-1",
        user: { name: "Rivky", email: "r@x.test" }
      } as never);

      const response = await POST(postRequest({ userId, color: null }));

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: expect.stringContaining("kitchen production status")
      });
      expect(prisma.kitchenWorker.create).not.toHaveBeenCalled();
    });

    it("refuses someone outside the organization", async () => {
      vi.mocked(prisma.organizationMembership.findFirst).mockResolvedValue(
        null as never
      );

      const response = await POST(postRequest({ userId, color: null }));

      expect(response.status).toBe(404);
      expect(prisma.kitchenWorker.create).not.toHaveBeenCalled();
    });

    it("takes the name from the staff record, not the caller", async () => {
      eligible("principal-1");
      vi.mocked(prisma.organizationMembership.findFirst).mockResolvedValue({
        principalId: "principal-1",
        user: { name: "Mendy", email: "m@x.test" }
      } as never);
      vi.mocked(prisma.kitchenWorker.findFirst).mockResolvedValue(null as never);
      vi.mocked(prisma.kitchenWorker.create).mockResolvedValue({
        id: "w1",
        name: "Mendy",
        color: null,
        isActive: true
      } as never);

      const response = await POST(
        postRequest({ userId, color: "#1f4d73", name: "Someone else" })
      );

      expect(response.status).toBe(201);
      expect(prisma.kitchenWorker.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId,
            userId,
            name: "Mendy"
          })
        })
      );
    });

    it("points at the retired row instead of creating a duplicate", async () => {
      eligible("principal-1");
      vi.mocked(prisma.organizationMembership.findFirst).mockResolvedValue({
        principalId: "principal-1",
        user: { name: "Mendy", email: "m@x.test" }
      } as never);
      vi.mocked(prisma.kitchenWorker.findFirst).mockResolvedValue({
        id: "w1",
        isActive: false,
        name: "Mendy"
      } as never);

      const response = await POST(postRequest({ userId, color: null }));

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        workerId: "w1",
        error: expect.stringContaining("retired")
      });
    });
  });
});
