import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: vi.fn(() => ({
    storage: { from: vi.fn() }
  }))
}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorize: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    menuItem: { findMany: vi.fn() },
    eventPackage: { findMany: vi.fn() },
    addOn: { findMany: vi.fn() },
    menuCategory: { findMany: vi.fn() }
  }
}));

import { GET } from "@/app/api/menu/route";
import { authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId
};

/**
 * The library payload is read by four screens, and three of them filter it on
 * `isActive` - the event menu's dish selector, its package drawer and the
 * kitchen's replace-a-dish drawer. A column missing from the select does not
 * fail anything on the way out: it arrives as `undefined`, every one of those
 * filters reads that as "not active", and all three drawers go silently empty
 * while the library grid beside them still lists the same rows.
 *
 * So the select is asserted rather than the payload. Mocking `findMany` hands
 * the route whatever the mock returns regardless of what was asked for, which
 * is exactly the drift this guards.
 */
describe("GET /api/menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(actor as never);
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.eventPackage.findMany).mockResolvedValue([]);
    vi.mocked(prisma.addOn.findMany).mockResolvedValue([]);
    vi.mocked(prisma.menuCategory.findMany).mockResolvedValue([]);
  });

  it("asks for isActive on dishes, packages and add-ons", async () => {
    const response = await GET(new Request("http://localhost/api/menu"));

    expect(response.status).toBe(200);

    for (const findMany of [
      prisma.menuItem.findMany,
      prisma.eventPackage.findMany,
      prisma.addOn.findMany
    ]) {
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ isActive: true })
        })
      );
    }
  });

  it("hands a deactivated dish to the client rather than dropping it", async () => {
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      { id: "1", name: "Retired dish", isActive: false, picturePath: null }
    ] as never);

    const response = await GET(new Request("http://localhost/api/menu"));
    const payload = await response.json();

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].isActive).toBe(false);
  });
});
