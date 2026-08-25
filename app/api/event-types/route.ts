import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const fieldsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  isActive: z.boolean().optional(),
  validDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  isShabbosShevaBrachos: z.boolean().optional()
});
const updateSchema = fieldsSchema.partial().extend({ id: z.string().uuid() });
const deleteSchema = z.object({ id: z.string().uuid() });

export async function GET(request: Request) {
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

export async function POST(request: Request) {
  try {
    const actor = await authorize(request, "eventtype.manage");
    const input = fieldsSchema.parse(await request.json());
    const duplicate = await prisma.eventType.findFirst({
      where: { organizationId: actor.organizationId, name: { equals: input.name, mode: "insensitive" } },
      select: { id: true }
    });
    if (duplicate) return NextResponse.json({ error: "An event type with this name already exists." }, { status: 409 });
    const eventType = await prisma.eventType.create({
      data: { organizationId: actor.organizationId, name: input.name, isActive: input.isActive ?? true, validDays: input.validDays ?? [], isShabbosShevaBrachos: input.isShabbosShevaBrachos ?? false },
      include: { _count: { select: { events: true } } }
    });
    return NextResponse.json({ eventType }, { status: 201 });
  } catch (error) { return createApiErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const actor = await authorize(request, "eventtype.manage");
    const input = updateSchema.parse(await request.json());
    const current = await prisma.eventType.findFirst({ where: { id: input.id, organizationId: actor.organizationId }, select: { id: true } });
    if (!current) return NextResponse.json({ error: "Event type not found." }, { status: 404 });
    if (input.name) {
      const duplicate = await prisma.eventType.findFirst({ where: { organizationId: actor.organizationId, name: { equals: input.name, mode: "insensitive" }, id: { not: current.id } }, select: { id: true } });
      if (duplicate) return NextResponse.json({ error: "An event type with this name already exists." }, { status: 409 });
    }
    const eventType = await prisma.eventType.update({
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
    return NextResponse.json({ eventType });
  } catch (error) { return createApiErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const actor = await authorize(request, "eventtype.manage");
    const input = deleteSchema.parse(await request.json());
    const eventType = await prisma.eventType.findFirst({ where: { id: input.id, organizationId: actor.organizationId }, include: { _count: { select: { events: true } } } });
    if (!eventType) return NextResponse.json({ error: "Event type not found." }, { status: 404 });
    if (eventType._count.events > 0) return NextResponse.json({ error: "This event type is already used by events. Deactivate it instead." }, { status: 409 });
    await prisma.eventType.delete({ where: { id: eventType.id } });
    return NextResponse.json({ deleted: true });
  } catch (error) { return createApiErrorResponse(error); }
}
