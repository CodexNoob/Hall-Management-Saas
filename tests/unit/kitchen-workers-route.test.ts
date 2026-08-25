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

import { GET, POST } from "@/app/api/kitchen/workers/route";
import { authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function postRequest(body: unknown) {
  return new Request("http://localhost/api/kitchen/workers", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

describe("kitchen workers route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue({
      organizationId
    } as never);
  });

  describe("listing", () => {
    it("offers Kitchen Staff who are not already workers", async () => {
      vi.mocked(prisma.kitchenWorker.findMany).mockResolvedValue([
        { id: "w1", name: "Mendy", userId, isActive: true, color: null }
      ] as never);
      vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
        // Already a worker - must not be offered twice.
        { role: "Kitchen Staff", user: { id: userId, name: "Mendy", email: "m@x.test" } },
        { role: "kitchen", user: { id: "user-2", name: "Shloimy", email: "s@x.test" } },
        // Wrong role - not eligible at all.
        { role: "Event Manager", user: { id: "user-3", name: "Rivky", email: "r@x.test" } }
      ] as never);

      const body = await (await GET(new Request("http://localhost/api/kitchen/workers"))).json();

      expect(body.availableStaff).toEqual([
        { id: "user-2", name: "Shloimy" }
      ]);
    });

    it("falls back to the email when a staff member has no name", async () => {
      vi.mocked(prisma.kitchenWorker.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
        { role: "kitchen", user: { id: "user-2", name: "  ", email: "chef@x.test" } }
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

    it("refuses a staff member who does not hold the Kitchen Staff role", async () => {
      // The dropdown only offers eligible staff, but the rule is enforced here
      // rather than trusted from whatever the browser sent.
      vi.mocked(prisma.organizationMembership.findFirst).mockResolvedValue({
        role: "Event Manager",
        user: { name: "Rivky", email: "r@x.test" }
      } as never);

      const response = await POST(postRequest({ userId, color: null }));

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: expect.stringContaining("Kitchen Staff role")
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
      vi.mocked(prisma.organizationMembership.findFirst).mockResolvedValue({
        role: "Kitchen Staff",
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
      vi.mocked(prisma.organizationMembership.findFirst).mockResolvedValue({
        role: "kitchen",
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
