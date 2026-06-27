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
  paid: "PAID",
  failed: "FAILED",
  cancelled: "CANCELLED"
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const input = confirmationSchema.parse(await request.json());

  const payment = await prisma.payment.create({
    data: {
      eventId,
      amountCents: input.amountCents,
      status: paymentStatusByResult[input.result],
      confirmedById: input.confirmedByUserId,
      note: input.note
    }
  });

  await prisma.event.update({
    where: { id: eventId },
    data: {
      paymentStatus: payment.status
    }
  });

  return NextResponse.json({ payment }, { status: 201 });
}
