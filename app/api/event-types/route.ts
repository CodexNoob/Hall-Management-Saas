import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActivity } from "@/lib/audit/activity-log";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http/with-route";

const fieldsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  isActive: z.boolean().optional(),
  validDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  isShabbosShevaBrachos: z.boolean().optional()
});
const updateSchema = fieldsSchema.partial().extend({ id: z.string().uuid() });
const deleteSchema = z.object({ id: z.string().uuid() });

export const GET = withRoute(
  "GET /api/event-types",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "event.read");
      const eventTypes = await prisma.eventType.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        include: { _count: { select: { events: true } } }
      });
      return NextResponse.json({ eventTypes });
    } catch (error) { return createApiErrorResponse(error); }
  }
);

export const POST = withRoute(
  "POST /api/event-types",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "eventtype.manage");
      const input = fieldsSchema.parse(await request.json());
      const duplicate = await prisma.eventType.findFirst({
        where: { organizationId: actor.organizationId, name: { equals: input.name, mode: "insensitive" } },
        select: { id: true }
      });
      if (duplicate) return NextResponse.json({ error: "An event type with this name already exists." }, { status: 409 });
      const eventType = await prisma.$transaction(async (transaction) => {
        const created = await transaction.eventType.create({
          data: { organizationId: actor.organizationId, name: input.name, isActive: input.isActive ?? true, validDays: input.validDays ?? [], isShabbosShevaBrachos: input.isShabbosShevaBrachos ?? false },
          include: { _count: { select: { events: true } } }
        });

        await recordActivity(transaction, actor, {
          action: "settings.event_type.created",
          message: `Added the ${created.name} event type.`,
          changed: { after: { eventTypeId: created.id, name: created.name } }
        });

        return created;
      });
      return NextResponse.json({ eventType }, { status: 201 });
    } catch (error) { return createApiErrorResponse(error); }
  }
);

export const PATCH = withRoute(
  "PATCH /api/event-types",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "eventtype.manage");
      const input = updateSchema.parse(await request.json());
      // `name` and `isActive` are read for the activity diff, not for the
      // duplicate check below.
      const current = await prisma.eventType.findFirst({ where: { id: input.id, organizationId: actor.organizationId }, select: { id: true, name: true, isActive: true } });
      if (!current) return NextResponse.json({ error: "Event type not found." }, { status: 404 });
      if (input.name) {
        const duplicate = await prisma.eventType.findFirst({ where: { organizationId: actor.organizationId, name: { equals: input.name, mode: "insensitive" }, id: { not: current.id } }, select: { id: true } });
        if (duplicate) return NextResponse.json({ error: "An event type with this name already exists." }, { status: 409 });
      }
      const eventType = await prisma.$transaction(async (transaction) => {
        const saved = await transaction.eventType.update({
          where: { id: current.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            ...(input.validDays !== undefined ? { validDays: input.validDays } : {}),
            ...(input.isShabbosShevaBrachos !== undefined
              ? { isShabbosShevaBrachos: input.isShabbosShevaBrachos }
              : {})
          },
          include: { _count: { select: { events: true } } }
        });

        await recordActivity(transaction, actor, {
          action: "settings.event_type.updated",
          message: `Edited the ${current.name} event type.`,
          changed: {
            before: { name: current.name, isActive: current.isActive },
            after: { eventTypeId: saved.id, name: saved.name, isActive: saved.isActive }
          }
        });

        return saved;
      });
      return NextResponse.json({ eventType });
    } catch (error) { return createApiErrorResponse(error); }
  }
);

export const DELETE = withRoute(
  "DELETE /api/event-types",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "eventtype.manage");
      const input = deleteSchema.parse(await request.json());
      const eventType = await prisma.eventType.findFirst({ where: { id: input.id, organizationId: actor.organizationId }, include: { _count: { select: { events: true } } } });
      if (!eventType) return NextResponse.json({ error: "Event type not found." }, { status: 404 });
      if (eventType._count.events > 0) return NextResponse.json({ error: "This event type is already used by events. Deactivate it instead." }, { status: 409 });
      await prisma.$transaction(async (transaction) => {
        await transaction.eventType.delete({ where: { id: eventType.id } });

        await recordActivity(transaction, actor, {
          action: "settings.event_type.deleted",
          message: `Removed the ${eventType.name} event type.`,
          changed: { before: { eventTypeId: eventType.id, name: eventType.name } }
        });
      });
      return NextResponse.json({ deleted: true });
    } catch (error) { return createApiErrorResponse(error); }
  }
);
