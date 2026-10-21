import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  deliveryCreate: vi.fn(),
  deliveryUpdateMany: vi.fn(),
  membershipFindMany: vi.fn(),
  kitchenFindMany: vi.fn(),
  effectiveAccessByPrincipal: vi.fn(),
  trackedFetch: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationDelivery: {
      create: mocks.deliveryCreate,
      updateMany: mocks.deliveryUpdateMany
    },
    organizationMembership: { findMany: mocks.membershipFindMany },
    kitchenItemStatus: { findMany: mocks.kitchenFindMany }
  }
}));

vi.mock("@/lib/authz/decide", () => ({
  effectiveAccessByPrincipal: mocks.effectiveAccessByPrincipal
}));

vi.mock("@/lib/logging/outbound", () => ({ trackedFetch: mocks.trackedFetch }));

import { sendNotification } from "@/lib/notifications/send";

/**
 * SENDING, AND NOT SENDING TWICE.
 *
 * The selector decides who; these are about everything around it - that a
 * replayed request produces one email, that a provider outage cannot undo a
 * booking, and that nothing identifying reaches the log stream.
 */

const ORGANIZATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const context = {
  organizationId: ORGANIZATION,
  epoch: BigInt(1),
  eventId: "event-1",
  hallId: null,
  coordinatorMembershipId: null
};

const email = { subject: "Booking confirmed", html: "<p>Confirmed</p>" };

const send = (dedupeKey = "event.created:event-1:key-1") =>
  sendNotification({
    context,
    subject: { kind: "event.created", hallId: null },
    dedupeKey,
    email
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("BREVO_API_KEY", "test-key");
  vi.stubEnv("SUPPORT_EMAIL_FROM", "noreply@example.com");

  mocks.deliveryCreate.mockResolvedValue({ id: "delivery-1" });
  mocks.deliveryUpdateMany.mockResolvedValue({ count: 1 });
  mocks.membershipFindMany.mockResolvedValue([
    {
      principalId: "principal-1",
      user: {
        id: "user-1",
        email: "manager@example.com",
        isActive: true,
        notificationPreferences: []
      }
    }
  ]);
  mocks.kitchenFindMany.mockResolvedValue([]);
  mocks.effectiveAccessByPrincipal.mockResolvedValue({
    permissions: new Map([
      ["event.read", { hallIds: "all", eventTypeIds: "all" }]
    ]),
    denied: new Set(),
    expired: new Set()
  });
  mocks.trackedFetch.mockResolvedValue({ ok: true, status: 200 });
});

describe("sending", () => {
  it("emails the people the selector chose", async () => {
    const result = await send();

    expect(result).toEqual({ sent: 1 });
    expect(mocks.trackedFetch).toHaveBeenCalledTimes(1);
  });

  /**
   * One request per recipient, deliberately. A single message addressed to
   * eight people shows all eight addresses to all eight - the classic way this
   * feature leaks a venue's staff list to its own staff.
   */
  it("sends one message per recipient rather than one to everybody", async () => {
    mocks.membershipFindMany.mockResolvedValue([
      {
        principalId: "p1",
        user: { id: "u1", email: "a@example.com", isActive: true, notificationPreferences: [] }
      },
      {
        principalId: "p2",
        user: { id: "u2", email: "b@example.com", isActive: true, notificationPreferences: [] }
      }
    ]);

    await send();

    expect(mocks.trackedFetch).toHaveBeenCalledTimes(2);

    for (const call of mocks.trackedFetch.mock.calls) {
      const body = JSON.parse((call[2] as { body: string }).body) as {
        to: Array<{ email: string }>;
      };

      // Brevo takes an array of recipient objects; one entry per request is
      // what stops eight people seeing each other's addresses.
      expect(body.to).toHaveLength(1);
    }
  });

  it("goes through trackedFetch with a bounded vendor and operation", async () => {
    await send();

    expect(mocks.trackedFetch.mock.calls[0]?.[0]).toEqual({
      vendor: "brevo",
      operation: "smtp.email"
    });
  });

  it("records how many it reached", async () => {
    await send();

    expect(mocks.deliveryUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { recipientCount: 1 } })
    );
  });
});

/**
 * THE REPLAY CASE. `POST /api/events` accepts an `Idempotency-Key`, and a
 * client retrying a timed-out request is doing the right thing - the booking is
 * created once, so the confirmation has to go out once with it.
 */
describe("a replayed request", () => {
  it("sends nothing the second time", async () => {
    await send();
    expect(mocks.trackedFetch).toHaveBeenCalledTimes(1);

    // The unique index refuses the second claim.
    mocks.deliveryCreate.mockRejectedValueOnce(new Error("unique violation"));
    const result = await send();

    expect(result).toEqual({ skipped: "duplicate" });
    expect(mocks.trackedFetch).toHaveBeenCalledTimes(1);
  });

  /**
   * CLAIMED BEFORE SENDING, and the order is the whole mechanism. Claiming
   * afterwards would let two concurrent replays both find no row and both send.
   */
  it("claims the delivery before it sends anything", async () => {
    mocks.deliveryCreate.mockRejectedValue(new Error("unique violation"));

    await send();

    expect(mocks.deliveryCreate).toHaveBeenCalled();
    expect(mocks.membershipFindMany).not.toHaveBeenCalled();
    expect(mocks.trackedFetch).not.toHaveBeenCalled();
  });

  it("treats a different notification about the same event as its own", async () => {
    await send("event.created:event-1:key-1");
    await send("event.updated:event-1:key-2");

    expect(mocks.trackedFetch).toHaveBeenCalledTimes(2);
  });
});

/**
 * NOTHING HERE MAY FAIL THE MUTATION IT FOLLOWS. The booking is already
 * created; a 500 at this point tells somebody it failed when it did not, and
 * the natural response - pressing Save again - makes two.
 */
describe("when something goes wrong", () => {
  it("does not throw when the provider refuses", async () => {
    mocks.trackedFetch.mockResolvedValue({ ok: false, status: 502 });

    await expect(send()).resolves.toEqual({ sent: 0 });
  });

  it("does not throw when the provider is unreachable", async () => {
    mocks.trackedFetch.mockRejectedValue(new Error("network down"));

    await expect(send()).resolves.toEqual({ sent: 0 });
  });

  it("does not throw when the candidate query fails", async () => {
    mocks.membershipFindMany.mockRejectedValue(new Error("database down"));

    await expect(send()).resolves.toEqual({ skipped: "error" });
  });

  it("counts the ones that did land when some fail", async () => {
    mocks.membershipFindMany.mockResolvedValue([
      {
        principalId: "p1",
        user: { id: "u1", email: "a@example.com", isActive: true, notificationPreferences: [] }
      },
      {
        principalId: "p2",
        user: { id: "u2", email: "b@example.com", isActive: true, notificationPreferences: [] }
      }
    ]);
    mocks.trackedFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(send()).resolves.toEqual({ sent: 1 });
  });

  it("sends nothing when no provider is configured", async () => {
    // A venue running without an email provider should not have every booking
    // produce a warning.
    vi.stubEnv("BREVO_API_KEY", "");

    await expect(send()).resolves.toEqual({ sent: 0 });
    expect(mocks.trackedFetch).not.toHaveBeenCalled();
  });
});

describe("what reaches the log stream", () => {
  /**
   * The privacy rule this feature carries, checked rather than trusted. An
   * address in a log line is a disclosure that outlives the email.
   */
  it("never puts an address, a subject or a body in the payload", async () => {
    const { log } = await import("@/lib/logging/context");
    const lines: unknown[] = [];
    const info = vi.spyOn(log, "info").mockImplementation((payload) => {
      lines.push(payload);
      return undefined as never;
    });

    await send();

    const serialized = JSON.stringify(lines);

    expect(serialized).not.toContain("manager@example.com");
    expect(serialized).not.toContain("Booking confirmed");
    expect(serialized).not.toContain("<p>Confirmed</p>");
    expect(serialized).toContain("event.created");

    info.mockRestore();
  });
});
