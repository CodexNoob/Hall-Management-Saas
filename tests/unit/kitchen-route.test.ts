import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server-auth", () => ({
  AuthorizationError: class AuthorizationError extends Error {
    status = 403;
  },
  requireAnyPermission: vi.fn(),
  requirePermission: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    kitchenWorker: { findMany: vi.fn() },
    menuItem: { findMany: vi.fn(), findFirst: vi.fn() },
    kitchenItemStatus: { upsert: vi.fn(), deleteMany: vi.fn() },
    kitchenNotification: { create: vi.fn() }
  }
}));

import { GET, PATCH } from "@/app/api/kitchen/route";
import {
  requireAnyPermission,
  requirePermission
} from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";

/**
 * The kitchen board is a list of work the hall is committed to.
 *
 * These tests exist because it used to be a list of every event on the date:
 * inquiries the client had not accepted, holds that had expired and bookings
 * that were cancelled all sat in today's production list beside real work.
 */

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const menuItemId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Test Actor",
  organizationId,
  membership: { role: "OWNER" },
  access: null
};

function request(body?: unknown) {
  return new Request("http://localhost/api/kitchen", {
    method: body === undefined ? "GET" : "PATCH",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

/** The `where` the event query actually ran with. */
function eventQueryFilter() {
  return vi.mocked(prisma.event.findMany).mock.calls[0]?.[0]?.where;
}

describe("kitchen dashboard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(actor as never);
    vi.mocked(requireAnyPermission).mockResolvedValue(actor as never);
    vi.mocked(prisma.event.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.kitchenWorker.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([] as never);
  });

  it("asks only for confirmed bookings", async () => {
    await GET(request());

    expect(eventQueryFilter()).toMatchObject({
      organizationId,
      deleted: false,
      bookingStatus: "CONFIRMED"
    });
  });

  it("filters on the lifecycle column, not the free-text label", async () => {
    // `eventStatus` is rewritten to "Confirmed" or "Hold" by every details
    // save, so a cancelled event carries the label "Hold" and would come back
    // onto the board if the board trusted it.
    await GET(request());

    const filter = eventQueryFilter() as Record<string, unknown>;

    expect(filter).not.toHaveProperty("eventStatus");
  });

  it("still scopes to the organization and the date window", async () => {
    await GET(request());

    const filter = eventQueryFilter() as {
      organizationId: string;
      eventDate: { gte: Date; lt: Date };
    };

    expect(filter.organizationId).toBe(organizationId);
    expect(filter.eventDate.lt.getTime() - filter.eventDate.gte.getTime()).toBe(
      28 * 24 * 60 * 60 * 1000
    );
  });

  it("refuses a status write against a booking that is no longer confirmed", async () => {
    // The event is gone from the board, but a tab left open still has its id.
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
      id: menuItemId,
      name: "Potato kugel"
    } as never);

    const response = await PATCH(
      request({ action: "status", eventId, menuItemId, status: "COMPLETE" })
    );

    expect(response.status).toBe(404);
    expect(
      vi.mocked(prisma.event.findFirst).mock.calls[0]?.[0]?.where
    ).toMatchObject({ bookingStatus: "CONFIRMED" });
    expect(prisma.kitchenItemStatus.upsert).not.toHaveBeenCalled();
  });

  it("records the status when the booking is confirmed", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: eventId,
      eventDate: new Date("2026-08-20T00:00:00.000Z"),
      hallName: "Main Hall",
      menuItemIds: [menuItemId]
    } as never);
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({
      id: menuItemId,
      name: "Potato kugel"
    } as never);
    vi.mocked(prisma.kitchenItemStatus.upsert).mockResolvedValue({
      status: "COMPLETE"
    } as never);

    const response = await PATCH(
      request({ action: "status", eventId, menuItemId, status: "COMPLETE" })
    );

    expect(response.status).toBe(200);
    expect(prisma.kitchenItemStatus.upsert).toHaveBeenCalledTimes(1);
  });
});
