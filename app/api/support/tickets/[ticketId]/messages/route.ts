import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth/server-auth";
import { isAdministrativeRole } from "@/lib/auth/roles";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const schema = z.object({ body: z.string().trim().min(2).max(3_000) });

export async function POST(request: Request, context: { params: Promise<{ ticketId: string }> }) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "support-ticket-message",
      limit: 20,
      windowMs: 10 * 60 * 1000
    });
    if (limited) return limited;
    const actor = await requireAuthenticatedUser(request);
    const { ticketId } = await context.params;
    const { body } = schema.parse(await request.json());
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        organizationId: actor.organizationId,
        ...(isAdministrativeRole(actor.membership.role) ? {} : { createdById: actor.id })
      },
      select: { id: true }
    });
    if (!ticket) return NextResponse.json({ error: "Support ticket not found." }, { status: 404 });
    const message = await prisma.$transaction(async (transaction) => {
      const created = await transaction.supportTicketMessage.create({
        data: {
          organizationId: actor.organizationId,
          ticketId,
          authorId: actor.id,
          body
        },
        select: {
          id: true,
          body: true,
          isStaffReply: true,
          createdAt: true,
          author: { select: { name: true } }
        }
      });
      await transaction.supportTicket.update({
        where: { id: ticketId },
        data: { status: "CUSTOMER_REPLIED" }
      });
      return created;
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
