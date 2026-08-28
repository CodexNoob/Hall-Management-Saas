import { NextResponse } from "next/server";
import { z } from "zod";

import { authorize, tenant } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const blockedDateSchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),
    label: z.string().trim().min(1).max(160),
    reason: z.string().trim().max(500).optional()
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"]
  });

export async function POST(request: Request) {
  try {
    const actor = await authorize(request, "settings.update");
    const input = blockedDateSchema.parse(await request.json());
    const blockedDate = await prisma.holidayBlockedDate.create({
      data: {
        organizationId: actor.organizationId,
        startDate: new Date(`${input.startDate}T00:00:00.000Z`),
        endDate: new Date(`${input.endDate}T00:00:00.000Z`),
        label: input.label,
        reason: input.reason
      }
    });
    return NextResponse.json({ blockedDate }, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await authorize(request, "settings.update");
    const { id } = z
      .object({ id: z.string().uuid() })
      .parse(await request.json());
    const result = await prisma.holidayBlockedDate.deleteMany({
      where: { id, ...tenant(actor) }
    });
    if (!result.count) {
      return NextResponse.json(
        { error: "Blocked date was not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
