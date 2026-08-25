import { NextResponse } from "next/server";
import { z } from "zod";

import { authorize, authorizeMember } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const dateSchema = z.string().date();
const createNoteSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  tone: z.enum(["default", "attention"]).default("default")
});

function operatingDateFromRequest(request: Request) {
  const value = new URL(request.url).searchParams.get("date");
  const dateKey = dateSchema.parse(value);
  return {
    dateKey,
    date: new Date(`${dateKey}T00:00:00.000Z`)
  };
}

export async function GET(request: Request) {
  try {
    const actor = await authorizeMember(request);
    const { dateKey, date } = operatingDateFromRequest(request);
    const notes = await prisma.todayNote.findMany({
      where: {
        organizationId: actor.organizationId,
        operatingDate: date
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        message: true,
        tone: true,
        createdAt: true,
        createdBy: { select: { name: true } }
      }
    });

    return NextResponse.json({ date: dateKey, notes });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await authorize(request, "note.manage");
    const { dateKey, date } = operatingDateFromRequest(request);
    const input = createNoteSchema.parse(await request.json());
    const note = await prisma.todayNote.create({
      data: {
        organizationId: actor.organizationId,
        operatingDate: date,
        message: input.message,
        tone: input.tone,
        createdById: actor.userId
      },
      select: {
        id: true,
        message: true,
        tone: true,
        createdAt: true,
        createdBy: { select: { name: true } }
      }
    });

    return NextResponse.json({ date: dateKey, note }, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
