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

import { syncKitchenStaffWorkers } from "@/features/kitchen/server/kitchen-staff-workers";
import { prisma } from "@/lib/prisma";

const organizationId = "11111111-1111-4111-8111-111111111111";

function membership(role: string, id: string, name: string, email = `${id}@x.test`) {
  return { role, user: { id, name, email } };
}

describe("kitchen staff workers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.kitchenWorker.createMany).mockResolvedValue({
      count: 0
    } as never);
    vi.mocked(prisma.kitchenWorker.updateMany).mockResolvedValue({
      count: 0
    } as never);
  });

  it("adds a Kitchen Staff member who has no worker row yet", async () => {
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
      membership("Kitchen Staff", "user-1", "Mendy")
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

  it("recognises every spelling the role has been stored as", async () => {
    // Roles are free text: "Kitchen Staff", "kitchen" and "kitchenstaff" have
    // all been written. Comparing the raw string would silently leave most of
    // the kitchen off the list.
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
      membership("Kitchen Staff", "user-1", "A"),
      membership("kitchen", "user-2", "B"),
      membership("kitchenstaff", "user-3", "C"),
      membership("Event Manager", "user-4", "D")
    ] as never);
    vi.mocked(prisma.kitchenWorker.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    await syncKitchenStaffWorkers(organizationId);

    const created = vi.mocked(prisma.kitchenWorker.createMany).mock
      .calls[0][0] as { data: Array<{ userId: string }> };

    expect(created.data.map((row) => row.userId)).toEqual([
      "user-1",
      "user-2",
      "user-3"
    ]);
  });

  it("falls back to the email when the account has no name", async () => {
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
      membership("kitchen", "user-1", "   ", "chef@venue.test")
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
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
      membership("kitchen", "user-1", "Mendy")
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

  it("retires a worker whose staff role was taken away", async () => {
    // The row stays so existing assignments keep their name; only its
    // availability changes.
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
      membership("Event Manager", "user-1", "Mendy")
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

  it("leaves a worker with no login alone", async () => {
    // A casual hand hired for one night has a name and no account. Retiring
    // them because they are not staff would empty the list this table exists
    // for.
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
    expect(workers).toEqual([
      { id: "worker-1", name: "Sunday help", userId: null, isStaff: false }
    ]);
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
