import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn()
}));
vi.mock("@/features/kitchen/server/kitchen-visibility-resolve", () => ({
  resolveKitchenVisibility: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    kitchenNotification: { updateMany: vi.fn(), deleteMany: vi.fn() }
  }
}));

import { DELETE, PATCH } from "@/app/api/kitchen/notifications/route";
import { authorize } from "@/lib/authz/authorize";
import { resolveKitchenVisibility } from "@/features/kitchen/server/kitchen-visibility-resolve";
import { prisma } from "@/lib/prisma";
import { authzContext } from "./authz-test-helpers";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const bulkRequest = (method: "PATCH" | "DELETE") =>
  new Request("http://localhost/api/kitchen/notifications", { method });

describe("kitchen notification bulk actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(authzContext({ organizationId }));
    vi.mocked(resolveKitchenVisibility).mockResolvedValue({
      seesWholeBoard: true,
      workerId: null
    });
  });

  it("acknowledges every pending notification in only the active organization", async () => {
    vi.mocked(prisma.kitchenNotification.updateMany).mockResolvedValue({
      count: 3
    });
    const response = await PATCH(bulkRequest("PATCH"));

    expect(authorize).toHaveBeenCalledWith(
      expect.any(Request),
      "kitchen.status.update"
    );
    expect(prisma.kitchenNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId, acknowledgedAt: null })
      })
    );
    await expect(response.json()).resolves.toEqual({ acknowledgedCount: 3 });
  });

  it("clears notifications in only the active organization", async () => {
    vi.mocked(prisma.kitchenNotification.deleteMany).mockResolvedValue({
      count: 5
    });
    const response = await DELETE(bulkRequest("DELETE"));

    expect(prisma.kitchenNotification.deleteMany).toHaveBeenCalledWith({
      where: { organizationId }
    });
    await expect(response.json()).resolves.toEqual({ deletedCount: 5 });
  });

  // `kitchen.status.update` is the key a cook holds to advance their own dish,
  // and both of these endpoints are gated on it. Without the visibility check
  // that made a cook - who is shown only the events they are cooking on - able
  // to acknowledge, and permanently delete, every notification in the
  // organization.
  describe("a cook who is shown only part of the feed", () => {
    beforeEach(() => {
      vi.mocked(resolveKitchenVisibility).mockResolvedValue({
        seesWholeBoard: false,
        workerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
      });
    });

    it("cannot acknowledge the whole feed", async () => {
      const response = await PATCH(bulkRequest("PATCH"));

      expect(response.status).toBe(403);
      expect(prisma.kitchenNotification.updateMany).not.toHaveBeenCalled();
    });

    it("cannot clear the feed", async () => {
      const response = await DELETE(bulkRequest("DELETE"));

      expect(response.status).toBe(403);
      expect(prisma.kitchenNotification.deleteMany).not.toHaveBeenCalled();
    });
  });
});
