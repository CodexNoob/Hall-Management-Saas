import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    event: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn()
  },
  requireAnyPermission: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth/server-auth", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireAnyPermission: mocks.requireAnyPermission
}));

import { PATCH } from "@/app/api/dining/route";

describe("dining route", () => {
  const organizationId = "11111111-1111-4111-8111-111111111111";
  const eventId = "22222222-2222-4222-8222-222222222222";
  const hallId = "33333333-3333-4333-8333-333333333333";
  const presetId = "44444444-4444-4444-8444-444444444444";
  const planId = "55555555-5555-4555-8555-555555555555";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, "randomUUID").mockReturnValue(planId);
    mocks.requireAnyPermission.mockResolvedValue({
      id: "user-1",
      organizationId
    });
    mocks.prisma.event.findFirst.mockResolvedValue({ id: eventId, hallId });
    mocks.prisma.event.update.mockResolvedValue({ id: eventId });
    mocks.prisma.$transaction.mockImplementation((callback) =>
      callback({
        event: { update: mocks.prisma.event.update },
        $queryRaw: mocks.prisma.$queryRaw
      })
    );
  });

  it("generates a dining plan id when saving a new plan", async () => {
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([{ id: presetId }])
      .mockResolvedValueOnce([
        {
          id: planId,
          organizationId,
          eventId,
          hallMapPresetId: presetId,
          countType: "People",
          adultCount: 10,
          childrenCount: 2,
          menWaiters: 1,
          womenWaiters: 1,
          tablecloth: null,
          washingTime: null,
          specialNotes: "VIP table beside stage.",
          tables: [],
          createdAt: new Date("2026-08-11T00:00:00.000Z"),
          updatedAt: new Date("2026-08-11T00:00:00.000Z")
        }
      ]);

    const request = new Request("http://localhost/api/dining", {
      method: "PATCH",
      body: JSON.stringify({
        eventId,
        hallMapPresetId: presetId,
        countType: "People",
        adultCount: 10,
        childrenCount: 2,
        menWaiters: 1,
        womenWaiters: 1,
        tablecloth: "Ivory",
        washingTime: "22:30",
        specialNotes: "VIP table beside stage.",
        tables: []
      })
    });

    const response = await PATCH(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.plan.id).toBe(planId);
    expect(mocks.prisma.$transaction).toHaveBeenCalledOnce();
    expect(mocks.prisma.$queryRaw).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([
        expect.stringContaining("INSERT INTO dining_plans"),
        expect.stringContaining("created_at"),
        expect.stringContaining("updated_at")
      ]),
      planId,
      organizationId,
      eventId,
      presetId,
      "People",
      10,
      2,
      1,
      1,
      "Ivory",
      "22:30",
      "VIP table beside stage.",
      "[]"
    );
    expect(mocks.prisma.event.update).toHaveBeenCalledWith({
      where: { id: eventId, organizationId },
      data: {
        tableclothName: "Ivory",
        waitersCount: 2,
        washingTime: "22:30",
        updatedById: "user-1",
        version: { increment: 1 }
      }
    });
  });
});
