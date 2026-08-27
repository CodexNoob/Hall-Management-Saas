import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMembership: { findMany: vi.fn() },
    kitchenWorker: { findMany: vi.fn() }
  }
}));
vi.mock("@/lib/authz/decide", () => ({ principalIdsHolding: vi.fn() }));

import { loadKitchenStaffWorkers } from "@/features/kitchen/server/kitchen-staff-workers";
import { principalIdsHolding } from "@/lib/authz/decide";
import { prisma } from "@/lib/prisma";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("kitchen staff workers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(principalIdsHolding).mockImplementation(async (_org, key) =>
      key === "kitchen.status.update"
        ? new Set(["kitchen-principal"])
        : new Set()
    );
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
      {
        principalId: "kitchen-principal",
        user: { id: "kitchen-user", name: "Mendy", email: "m@x.test" }
      }
    ] as never);
    vi.mocked(prisma.kitchenWorker.findMany).mockResolvedValue([] as never);
  });

  it("does not create a worker merely because someone has kitchen access", async () => {
    await expect(loadKitchenStaffWorkers(organizationId)).resolves.toEqual([]);

    expect(prisma.kitchenWorker.findMany).toHaveBeenCalledTimes(1);
  });

  it("returns an active explicitly designated kitchen worker", async () => {
    vi.mocked(prisma.kitchenWorker.findMany).mockResolvedValue([
      {
        id: "worker-1",
        userId: "kitchen-user",
        name: "Mendy",
        isActive: true
      }
    ] as never);

    await expect(loadKitchenStaffWorkers(organizationId)).resolves.toEqual([
      {
        id: "worker-1",
        name: "Mendy",
        userId: "kitchen-user",
        isStaff: true
      }
    ]);
  });

  it("excludes a staff administrator even if a worker row already exists", async () => {
    vi.mocked(principalIdsHolding).mockImplementation(async (_org, key) =>
      key === "kitchen.status.update" || key === "role.assign"
        ? new Set(["admin-principal"])
        : new Set()
    );
    vi.mocked(prisma.organizationMembership.findMany).mockResolvedValue([
      {
        principalId: "admin-principal",
        user: { id: "admin-user", name: "Administrator", email: "admin@x.test" }
      }
    ] as never);
    vi.mocked(prisma.kitchenWorker.findMany).mockResolvedValue([
      {
        id: "worker-admin",
        userId: "admin-user",
        name: "Administrator",
        isActive: true
      }
    ] as never);

    await expect(loadKitchenStaffWorkers(organizationId)).resolves.toEqual([]);
  });
});
