import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createEventSchema = z.object({
  clientName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  eventDate: z.string().date(),
  hallId: z.string().min(1),
  eventTypeId: z.string().optional(),
  eventStatus: z.enum(["On Hold", "Confirmed"]).default("On Hold"),
  paymentStatus: z.enum(["Deposit Paid", "Paid Partially", "Paid in Full"]).optional(),
  packageId: z.string().optional(),
  couplesCount: z.number().int().min(0).default(0),
  menCount: z.number().int().min(0).default(0),
  ladiesCount: z.number().int().min(0).default(0),
  boysCount: z.number().int().min(0).default(0),
  girlsCount: z.number().int().min(0).default(0),
  kidsCount: z.number().int().min(0).default(0),
  waitersCount: z.number().int().min(0).default(0),
  createdById: z.string().optional(),
  notes: z.string().optional()
});

export type CreateEventRequest = z.infer<typeof createEventSchema>;

export async function GET() {
  const events = await prisma.event.findMany({
    where: { deleted: false },
    orderBy: { eventDate: "asc" },
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
  const [hall, eventType, eventPackage] = await Promise.all([
    prisma.hall.findUnique({ where: { id: input.hallId } }),
    input.eventTypeId ? prisma.eventType.findUnique({ where: { id: input.eventTypeId } }) : null,
    input.packageId ? prisma.eventPackage.findUnique({ where: { id: input.packageId } }) : null
  ]);

  const event = await prisma.event.create({
    data: {
      clientName: input.clientName,
      phone: input.phone,
      email: input.email,
      eventDate: new Date(`${input.eventDate}T00:00:00.000Z`),
      hallId: input.hallId,
      hallName: hall?.name,
      eventTypeId: input.eventTypeId,
      eventType: eventType?.name,
      eventStatus: input.eventStatus,
      paymentStatus: input.paymentStatus,
      packageId: input.packageId,
      packageName: eventPackage?.name,
      couplesCount: input.couplesCount,
      menCount: input.menCount,
      ladiesCount: input.ladiesCount,
      boysCount: input.boysCount,
      girlsCount: input.girlsCount,
      kidsCount: input.kidsCount,
      waitersCount: input.waitersCount,
      createdById: input.createdById,
      notes: input.notes
    }
  });

  return NextResponse.json({ event }, { status: 201 });
}
