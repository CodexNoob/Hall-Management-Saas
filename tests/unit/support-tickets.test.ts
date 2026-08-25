import { beforeEach, describe, expect, it, vi } from "vitest";
import { authzContext } from "@/tests/unit/authz-test-helpers";

const mocks = vi.hoisted(() => ({
  authorizeMember: vi.fn(),
  hasPermission: vi.fn(),
  enforceRateLimit: vi.fn(),
  notify: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  activityCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz/authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authz/authorize")>()),
  authorizeMember: mocks.authorizeMember,
  // "May I read a colleague's ticket" is a second question the handler asks
  // after the door check. The resolver's answer has its own suite.
  hasPermission: mocks.hasPermission
}));
vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit
}));
vi.mock("@/features/support/server/support-notifications", () => ({
  notifySupportTicketCreated: mocks.notify
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    supportTicket: { findMany: mocks.findMany },
    $transaction: mocks.transaction
  }
}));

import { GET, POST } from "@/app/api/support/tickets/route";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const actor = {
  userId: "22222222-2222-4222-8222-222222222222",
  actorName: "Test User",
  userEmail: "user@example.com",
  organizationId,
  organization: {
    id: organizationId,
    name: "Test Venue",
    slug: "test-venue",
    subscriptionPlan: null,
    subscriptionStatus: "active"
  }
};

const ticket = {
  id: "33333333-3333-4333-8333-333333333333",
  reference: "EC-20260807-ABC123",
  subject: "Booking does not save",
  description: "The booking form remains open after I submit it.",
  category: "BUG",
  priority: "NORMAL",
  status: "SUBMITTED",
  pageUrl: "https://eventcore.app/dashboard/calendar",
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: actor.userId, name: actor.actorName, email: actor.userEmail },
  messages: []
};

describe("support tickets API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeMember.mockResolvedValue(authzContext(actor));
    mocks.hasPermission.mockResolvedValue(false);
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.findMany.mockResolvedValue([ticket]);
    mocks.create.mockResolvedValue(ticket);
    mocks.activityCreate.mockResolvedValue({ id: "log" });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        supportTicket: { create: mocks.create },
        activityLog: { create: mocks.activityCreate }
      })
    );
  });

  it("limits non-admin ticket history to the signed-in user and organization", async () => {
    const response = await GET(
      new Request("https://eventcore.app/api/support/tickets")
    );
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: actor.organizationId, createdById: actor.userId }
      })
    );
  });

  it("creates a ticket with server-controlled tenant and reporter fields", async () => {
    const response = await POST(
      new Request("https://eventcore.app/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: ticket.subject,
          description: ticket.description,
          category: "BUG",
          priority: "NORMAL",
          pageUrl: ticket.pageUrl
        })
      })
    );
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: actor.organizationId,
          createdById: actor.userId
        })
      })
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ reference: ticket.reference })
    );
  });
});
