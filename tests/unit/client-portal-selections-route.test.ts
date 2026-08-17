import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findFirst: vi.fn(), update: vi.fn() },
    eventPackage: { findFirst: vi.fn() },
    tableclothOption: { findFirst: vi.fn() },
    menuItem: { count: vi.fn() },
    addOn: { count: vi.fn() },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn()
  }
}));

import { POST } from "@/app/api/client-portal/[eventId]/selections/route";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const packageId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const menuItemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function post(body: unknown, id = eventId) {
  return POST(
    new Request(`http://localhost/api/client-portal/${id}/selections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ eventId: id }) }
  );
}

describe("public client portal selections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      organizationId,
      packageId: null,
      tableclothId: null,
      menuItemIds: [],
      addOnIds: [],
      workspaceData: null
    } as never);
    vi.mocked(prisma.event.update).mockResolvedValue({
      id: eventId,
      packageId,
      tableclothId: null,
      menuItemIds: [menuItemId],
      addOnIds: []
    } as never);
    vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (
      callback: (tx: unknown) => Promise<unknown>
    ) => callback(prisma)) as never);
  });

  it("rejects a package belonging to another organization", async () => {
    // The id is well-formed but not this organization's, so the ownership
    // lookup finds nothing.
    vi.mocked(prisma.eventPackage.findFirst).mockResolvedValue(null);

    const response = await post({ packageId });

    expect(response.status).toBe(400);
    expect(prisma.eventPackage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: packageId, organizationId })
      })
    );
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("rejects menu items that are not all owned and active", async () => {
    vi.mocked(prisma.menuItem.count).mockResolvedValue(0);

    const response = await post({ menuItemIds: [menuItemId] });

    expect(response.status).toBe(400);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("refuses edits once the venue has confirmed the menu", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      organizationId,
      packageId: null,
      tableclothId: null,
      menuItemIds: [],
      addOnIds: [],
      workspaceData: { menuConfirmed: true }
    } as never);

    const response = await post({ menuItemIds: [menuItemId] });

    expect(response.status).toBe(409);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("passes the rate limiter's rejection straight through", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue(
      new Response(null, { status: 429 }) as never
    );

    const response = await post({ menuItemIds: [] });

    expect(response.status).toBe(429);
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
  });

  it("404s for a malformed event id without touching the database", async () => {
    const response = await post({ menuItemIds: [] }, "not-a-uuid");

    expect(response.status).toBe(404);
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
  });

  it("rejects unknown fields rather than silently ignoring them", async () => {
    const response = await post({ organizationId: "hijacked" });

    expect(response.status).toBe(400);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("saves owned selections and appends one activity log entry", async () => {
    vi.mocked(prisma.eventPackage.findFirst).mockResolvedValue({
      id: packageId,
      name: "Gold dinner"
    } as never);
    vi.mocked(prisma.menuItem.count).mockResolvedValue(1);

    const response = await post({ packageId, menuItemIds: [menuItemId] });

    expect(response.status).toBe(200);
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: eventId, organizationId },
        data: expect.objectContaining({
          packageId,
          packageName: "Gold dinner",
          menuItemIds: [menuItemId]
        })
      })
    );
    expect(prisma.activityLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId, eventId })
      })
    );
  });
});
