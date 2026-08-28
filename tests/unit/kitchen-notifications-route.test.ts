import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    kitchenNotification: { updateMany: vi.fn(), deleteMany: vi.fn() }
  }
}));

import { DELETE, PATCH } from "@/app/api/kitchen/notifications/route";
import { authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { authzContext } from "./authz-test-helpers";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("kitchen notification bulk actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(authzContext({ organizationId }));
  });

  it("acknowledges every pending notification in only the active organization", async () => {
    vi.mocked(prisma.kitchenNotification.updateMany).mockResolvedValue({
      count: 3
    });
    const response = await PATCH(
      new Request("http://localhost/api/kitchen/notifications", {
        method: "PATCH"
      })
    );

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
    const response = await DELETE(
      new Request("http://localhost/api/kitchen/notifications", {
        method: "DELETE"
      })
    );

    expect(prisma.kitchenNotification.deleteMany).toHaveBeenCalledWith({
      where: { organizationId }
    });
    await expect(response.json()).resolves.toEqual({ deletedCount: 5 });
  });
});
