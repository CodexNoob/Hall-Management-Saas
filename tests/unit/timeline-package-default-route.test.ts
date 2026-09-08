import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  assertInScope: vi.fn(),
  authorize: vi.fn()
}));
vi.mock("@/lib/prisma", async () => {
  const { withActivityLog } = await import("./prisma-activity-mock");
  return {
    prisma: withActivityLog({
    event: { findFirst: vi.fn() },
    eventPackage: { updateMany: vi.fn() }
  })
  };
});

import { POST } from "@/app/api/events/[eventId]/timeline/package-default/route";
import { authorize } from "@/lib/authz/authorize";
import { prisma } from "@/lib/prisma";
import { authzContext } from "./authz-test-helpers";

/**
 * Saving one event's schedule onto the package it is on.
 *
 * The write lands on the menu catalog rather than the event, so it outlives the
 * event it came from - which is why the route asks for `menu.update` and proves
 * the event names a package before it writes anything.
 */

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const hallId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const packageId = "11111111-1111-4111-8111-111111111111";

const params = Promise.resolve({ eventId });

const timeline = [
  { id: "row-1", time: "03:00 PM", text: "Dining room setup", type: "Event" },
  { id: "row-2", cue: "After soup", text: "Pour the wine", type: "Staff" }
];

function request(body: unknown) {
  return new Request(
    `http://localhost/api/events/${eventId}/timeline/package-default`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
}

describe("timeline package default route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorize).mockResolvedValue(
      authzContext({
        organizationId,
        userId: "22222222-2222-4222-8222-222222222222"
      }) as never
    );
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      hallId,
      packageId,
      packageName: "Wedding Classic"
    } as never);
    vi.mocked(prisma.eventPackage.updateMany).mockResolvedValue({
      count: 1
    } as never);
  });

  it("writes the rows onto the package the event is on", async () => {
    const response = await POST(request({ timeline }), { params });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      packageName: "Wedding Classic",
      rows: 2
    });
    expect(prisma.eventPackage.updateMany).toHaveBeenCalledWith({
      // The organization travels in the filter, so another tenant's package
      // matches nothing rather than being written to.
      where: { id: packageId, organizationId },
      data: { defaultTimeline: timeline }
    });
  });

  it("asks the permission that guards the catalog, not the event", async () => {
    await POST(request({ timeline }), { params });

    expect(authorize).toHaveBeenCalledWith(expect.anything(), "menu.update");
  });

  it("refuses an event that is not on a package", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      hallId,
      packageId: null,
      packageName: null
    } as never);

    const response = await POST(request({ timeline }), { params });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("not on a package")
    });
    expect(prisma.eventPackage.updateMany).not.toHaveBeenCalled();
  });

  it("refuses an empty timeline", async () => {
    // An empty default cannot be told from no default where it is read, so
    // saving one would quietly clear the package through a Save button.
    const response = await POST(request({ timeline: [] }), { params });

    expect(response.status).toBe(400);
    expect(prisma.eventPackage.updateMany).not.toHaveBeenCalled();
  });

  it("reports a missing event rather than writing", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null as never);

    const response = await POST(request({ timeline }), { params });

    expect(response.status).toBe(404);
    expect(prisma.eventPackage.updateMany).not.toHaveBeenCalled();
  });
});
