import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeMember, hasPermission, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createActivityLog } from "@/lib/audit/activity-log";
import { notifySupportTicketCreated } from "@/features/support/server/support-notifications";

const diagnosticSchema = z.object({
  viewport: z.string().max(80).optional(),
  platform: z.string().max(160).optional(),
  locale: z.string().max(40).optional(),
  timezone: z.string().max(100).optional()
}).strict();

const createTicketSchema = z.object({
  subject: z.string().trim().min(5).max(160),
  description: z.string().trim().min(20).max(5_000),
  category: z.enum(["BUG", "ACCOUNT", "BILLING", "FEATURE_REQUEST", "OTHER"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]),
  pageUrl: z.string().url().max(2_048).optional(),
  browser: z.string().max(500).optional(),
  device: z.string().max(160).optional(),
  appVersion: z.string().max(80).optional(),
  diagnosticContext: diagnosticSchema.optional()
});

function createReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `EC-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

const ticketSelect = {
  id: true,
  reference: true,
  subject: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  pageUrl: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  messages: {
    select: {
      id: true,
      body: true,
      isStaffReply: true,
      createdAt: true,
      author: { select: { name: true } }
    },
    orderBy: { createdAt: "asc" as const }
  }
};

export async function GET(request: Request) {
  try {
    const actor = await authorizeMember(request);
    // Reading a colleague's ticket is a people-management read, so it asks for
    // the catalog's people-management key rather than for "is an administrator".
    // Everyone else sees the tickets they raised.
    const canViewOrganizationTickets = await hasPermission(actor, "staff.read");
    const tickets = await prisma.supportTicket.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(canViewOrganizationTickets ? {} : { createdById: requireUserActor(actor) })
      },
      select: ticketSelect,
      orderBy: { updatedAt: "desc" },
      take: 50
    });
    return NextResponse.json({ tickets, supportEmail: process.env.SUPPORT_EMAIL ?? null });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "support-ticket-create",
      limit: 5,
      windowMs: 10 * 60 * 1000
    });
    if (limited) return limited;
    const actor = await authorizeMember(request);
    const input = createTicketSchema.parse(await request.json());
    const ticket = await prisma.$transaction(async (transaction) => {
      const created = await transaction.supportTicket.create({
        data: {
          organizationId: actor.organizationId,
          createdById: requireUserActor(actor),
          reference: createReference(),
          ...input
        },
        select: ticketSelect
      });
      await createActivityLog(transaction, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        userName: actor.actorName,
        actionType: "Support Ticket Created",
        message: `Created support ticket ${created.reference}.`,
        newValue: {
          ticketId: created.id,
          reference: created.reference,
          category: created.category,
          priority: created.priority
        }
      });
      return created;
    });
    await notifySupportTicketCreated({
      reference: ticket.reference,
      subject: ticket.subject,
      priority: ticket.priority,
      category: ticket.category,
      organizationName: actor.organization.name,
      reporterName: actor.actorName,
      reporterEmail: actor.userEmail ?? ""
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
