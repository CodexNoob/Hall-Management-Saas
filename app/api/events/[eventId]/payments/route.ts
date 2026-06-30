import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const confirmationSchema = z.object({
  amountCents: z.number().int().positive(),
  result: z.enum(["paid", "failed", "cancelled"]),
  confirmedByUserId: z.string().min(1),
  note: z.string().optional()
});

const paymentStatusByResult = {
  paid: "Paid in Full",
  failed: "Paid Partially",
  cancelled: "Paid Partially"
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const input = confirmationSchema.parse(await request.json());

  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      paymentStatus: paymentStatusByResult[input.result],
      amountDue: input.result === "paid" ? 0 : undefined,
      updatedById: input.confirmedByUserId
    }
  });

  const activityLog = await prisma.activityLog.create({
    data: {
      eventId,
      userId: input.confirmedByUserId,
      actionType: "Payment Confirmation",
      message: `Payment marked ${input.result}.`,
      newValue: {
        amountCents: input.amountCents,
        result: input.result,
        note: input.note
      }
    }
  });

  return NextResponse.json({ event, activityLog }, { status: 201 });
}
