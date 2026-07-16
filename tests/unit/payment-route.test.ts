import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server-auth", () => ({
  AuthorizationError: class AuthorizationError extends Error {
    constructor(
      public readonly status: 401 | 403,
      message: string
    ) {
      super(message);
    }
  },
  assertHallAccess: vi.fn(),
  requirePermission: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn()
  }
}));

import { POST } from "@/app/api/events/[eventId]/payments/route";
import { assertHallAccess, requirePermission } from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";

describe("payment confirmation authorization", () => {
  const actor = {
    id: "22222222-2222-4222-8222-222222222222",
    organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Authorized Admin",
    role: "admin",
    access: null
  };
  const transaction = {
    event: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    },
    activityLog: {
      create: vi.fn()
    },
    paymentTransaction: {
      create: vi.fn()
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(actor as never);
    transaction.event.findUniqueOrThrow.mockResolvedValue({
      hallId: "33333333-3333-4333-8333-333333333333"
    });
    transaction.event.update.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444"
    });
    transaction.activityLog.create.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555"
    });
    transaction.paymentTransaction.create.mockResolvedValue({
      id: "66666666-6666-4666-8666-666666666666"
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback(transaction as never)
    );
  });

  it("uses the authenticated actor instead of a forged client user ID", async () => {
    const request = new Request(
      "http://localhost/api/events/44444444-4444-4444-8444-444444444444/payments",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amountCents: 25000,
          result: "paid",
          confirmedByUserId: "99999999-9999-4999-8999-999999999999"
        })
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({
        eventId: "44444444-4444-4444-8444-444444444444"
      })
    });

    expect(response.status).toBe(201);
    expect(requirePermission).toHaveBeenCalledWith(
      request,
      "canManagePayments"
    );
    expect(assertHallAccess).toHaveBeenCalledWith(
      actor,
      "33333333-3333-4333-8333-333333333333"
    );
    expect(transaction.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: actor.organizationId
        }),
        data: expect.objectContaining({ updatedById: actor.id })
      })
    );
    expect(transaction.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: actor.organizationId,
          userId: actor.id,
          userName: actor.name
        })
      })
    );
    expect(transaction.paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: actor.organizationId,
          confirmedById: actor.id,
          amountCents: 25000
        })
      })
    );
  });
});
