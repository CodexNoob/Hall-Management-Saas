import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMembership: { findMany: vi.fn() },
    kitchenWorker: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));
// Who holds a key is the resolver's question, and it has its own suite. Here
// the only thing that matters is that this module ASKS it rather than reading a
// role name off the membership row.
vi.mock("@/lib/authz/decide", () => ({
  principalIdsHolding: vi.fn()
}));

import { syncKitchenStaffWorkers } from "@/features/kitchen/server/kitchen-staff-workers";
import { principalIdsHolding } from "@/lib/authz/decide";
import { prisma } from "@/lib/prisma";

const organizationId = "11111111-1111-4111-8111-111111111111";

function membership(
  principalId: string,
  id: string,
  name: string,
  email = `${id}@x.test`
) {
  return { principalId, user: { id, name, email } };
}

/** The principals the resolver reports as holding `kitchen.status.update`. */
function eligible(...principalIds: string[]) {
  vi.mocked(principalIdsHolding).mockResolvedValue(new Set(principalIds));
}

describe("kitchen staff workers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eligible();
    vi.mocked(prisma.kitchenWorker.createMany).mockResolvedValue({
      count: 0
    } as never);
    vi.mocked(prisma.kitchenWorker.updateMany).mockResolvedValue({
      count: 0
    } as never);
  });

  it("adds an eligible member who has no worker row yet", async () => {
    eligible("principal-1");
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
      membership("principal-1", "user-1", "Mendy")
    ] as never);
    vi.mocked(prisma.kitchenWorker.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        { id: "worker-1", name: "Mendy", userId: "user-1" }
      ] as never);

    const workers = await syncKitchenStaffWorkers(organizationId);

    expect(prisma.kitchenWorker.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ organizationId, userId: "user-1", name: "Mendy" }],
        skipDuplicates: true
      })
    );
    expect(workers).toEqual([
      { id: "worker-1", name: "Mendy", userId: "user-1", isStaff: true }
    ]);
  });

  it("asks who may advance production, not who holds a named role", async () => {
    // Roles are tenant-authored, so "Kitchen Staff" is a label a venue may
    // rename or replace. Eligibility asks the only question that survives that:
    // who may move a dish along.
    eligible("principal-1", "principal-2");
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
      membership("principal-1", "user-1", "A"),
      membership("principal-2", "user-2", "B"),
      membership("principal-3", "user-3", "C")
    ] as never);
    vi.mocked(prisma.kitchenWorker.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    await syncKitchenStaffWorkers(organizationId);

    expect(principalIdsHolding).toHaveBeenCalledWith(
      organizationId,
      "kitchen.status.update"
    );

    const created = vi.mocked(prisma.kitchenWorker.createMany).mock
      .calls[0][0] as { data: Array<{ userId: string }> };

    expect(created.data.map((row) => row.userId)).toEqual(["user-1", "user-2"]);
  });

  it("falls back to the email when the account has no name", async () => {
    eligible("principal-1");
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
      membership("principal-1", "user-1", "   ", "chef@venue.test")
    ] as never);
    vi.mocked(prisma.kitchenWorker.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    await syncKitchenStaffWorkers(organizationId);

    const created = vi.mocked(prisma.kitchenWorker.createMany).mock
      .calls[0][0] as { data: Array<{ name: string }> };

    expect(created.data[0].name).toBe("chef@venue.test");
  });

  it("does not duplicate a staff member who is already linked", async () => {
    eligible("principal-1");
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
      membership("principal-1", "user-1", "Mendy")
    ] as never);
    vi.mocked(prisma.kitchenWorker.findMany)
      .mockResolvedValueOnce([
        { id: "worker-1", userId: "user-1", name: "Mendy", isActive: true }
      ] as never)
      .mockResolvedValueOnce([
        { id: "worker-1", name: "Mendy", userId: "user-1" }
      ] as never);

    await syncKitchenStaffWorkers(organizationId);

    expect(prisma.kitchenWorker.createMany).not.toHaveBeenCalled();
  });

  it("retires a worker who no longer holds the permission", async () => {
    // The row stays so existing assignments keep their name; only its
    // availability changes.
    eligible();
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
      membership("principal-1", "user-1", "Mendy")
    ] as never);
    vi.mocked(prisma.kitchenWorker.findMany)
      .mockResolvedValueOnce([
        { id: "worker-1", userId: "user-1", name: "Mendy", isActive: true }
      ] as never)
      .mockResolvedValueOnce([] as never);

    await syncKitchenStaffWorkers(organizationId);

    expect(prisma.kitchenWorker.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["worker-1"] } },
      data: { isActive: false }
    });
  });

  it("keeps old manual workers stored but does not return them as assignable", async () => {
    // A casual hand hired for one night can stay in storage so old assignments
    // keep their label, but the active Kitchen page is now staff-access driven.
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue(
      [] as never
    );
    vi.mocked(prisma.kitchenWorker.findMany)
      .mockResolvedValueOnce([
        { id: "worker-1", userId: null, name: "Sunday help", isActive: true }
      ] as never)
      .mockResolvedValueOnce([
        { id: "worker-1", name: "Sunday help", userId: null }
      ] as never);

    const workers = await syncKitchenStaffWorkers(organizationId);

    expect(prisma.kitchenWorker.updateMany).not.toHaveBeenCalled();
    expect(workers).toEqual([]);
  });

  it("only considers active members of the organization", async () => {
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue(
      [] as never
    );
    vi.mocked(prisma.kitchenWorker.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    await syncKitchenStaffWorkers(organizationId);

    expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          isActive: true,
          user: { isActive: true }
        })
      })
    );
  });
});
