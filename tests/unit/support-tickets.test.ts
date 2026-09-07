import { beforeEach, describe, expect, it, vi } from "vitest";
import { authzContext } from "@/tests/unit/authz-test-helpers";

const mocks = vi.hoisted(() => ({
  authorizeMember: vi.fn(),
  hasPermission: vi.fn(),
  enforceRateLimit: vi.fn(),
  notify: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  messageCreate: vi.fn(),
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
    supportTicket: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update
    },
    supportTicketMessage: { create: mocks.messageCreate },
    $transaction: mocks.transaction
  }
}));

import { GET as GET_TICKETS, POST as POST_TICKET } from "@/app/api/support/tickets/route";
import {
  GET as GET_TICKET_MESSAGES,
  POST as POST_TICKET_MESSAGE
} from "@/app/api/support/tickets/[ticketId]/messages/route";

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
    mocks.findFirst.mockResolvedValue({ messages: ticket.messages });
    mocks.create.mockResolvedValue(ticket);
    mocks.update.mockResolvedValue({ id: ticket.id });
    mocks.messageCreate.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      body: "More details",
      isStaffReply: false,
      createdAt: new Date(),
      author: { name: actor.actorName }
    });
    mocks.activityCreate.mockResolvedValue({ id: "log" });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        supportTicket: { create: mocks.create, update: mocks.update },
        supportTicketMessage: { create: mocks.messageCreate },
        activityLog: { create: mocks.activityCreate }
      })
    );
  });

  it("limits non-admin ticket history to the signed-in user and organization", async () => {
    const response = await GET_TICKETS(
      new Request("https://eventcore.app/api/support/tickets")
    );
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: actor.organizationId, createdById: actor.userId }
      })
    );
  });

  it("loads only the ticket summary rows for support history", async () => {
    const response = await GET_TICKETS(
      new Request("https://eventcore.app/api/support/tickets")
    );

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 8,
        select: expect.not.objectContaining({ messages: expect.anything() })
      })
    );
  });

  it("creates a ticket with server-controlled tenant and reporter fields", async () => {
    const response = await POST_TICKET(
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

  it("loads messages only for an authorized ticket", async () => {
    const response = await GET_TICKET_MESSAGES(
      new Request(`https://eventcore.app/api/support/tickets/${ticket.id}/messages`),
      { params: Promise.resolve({ ticketId: ticket.id }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: ticket.id,
          organizationId: actor.organizationId,
          createdById: actor.userId
        },
        select: expect.objectContaining({ messages: expect.anything() })
      })
    );
  });

  it("adds a customer reply to an authorized ticket", async () => {
    mocks.findFirst.mockResolvedValue({ id: ticket.id });

    const response = await POST_TICKET_MESSAGE(
      new Request(`https://eventcore.app/api/support/tickets/${ticket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Here are more details." })
      }),
      { params: Promise.resolve({ ticketId: ticket.id }) }
    );

    expect(response.status).toBe(201);
    expect(mocks.messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: actor.organizationId,
          ticketId: ticket.id,
          authorId: actor.userId,
          body: "Here are more details."
        })
      })
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ticket.id },
        data: { status: "CUSTOMER_REPLIED" }
      })
    );
  });
});
