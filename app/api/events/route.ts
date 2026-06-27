import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createEventSchema = z.object({
  name: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  guestCount: z.number().int().positive(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  hallId: z.string().min(1),
  packageId: z.string().optional(),
  createdById: z.string().min(1),
  notes: z.string().optional()
});

export type CreateEventRequest = z.infer<typeof createEventSchema>;

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { startsAt: "asc" },
    include: {
      hall: true,
      package: true
    },
    take: 50
  });

  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const json = await request.json();
  const input = createEventSchema.parse(json);

  const event = await prisma.event.create({
    data: {
      ...input,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt)
    }
  });

  return NextResponse.json({ event }, { status: 201 });
}
