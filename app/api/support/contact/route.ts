import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { notifyPublicSupportRequest } from "@/features/support/server/support-notifications";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10).max(5_000),
  pageUrl: z.string().url().max(2_048).optional(),
  website: z.string().max(0).optional()
}).strict();

function createReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `EC-CONTACT-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "public-support-contact",
      limit: 5,
      windowMs: 10 * 60 * 1000
    });
    if (limited) return limited;

    const input = contactSchema.parse(await request.json());
    const created = await prisma.contactSupportRequest.create({
      data: {
        reference: createReference(),
        name: input.name,
        email: input.email.toLowerCase(),
        company: input.company || null,
        message: input.message,
        pageUrl: input.pageUrl
      },
      select: { reference: true, name: true, email: true, company: true, message: true }
    });

    await notifyPublicSupportRequest(created);
    return NextResponse.json({ reference: created.reference }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Please check the form and enter a valid message." }, { status: 400 });
    }
    console.error("Public support request failed", error);
    return NextResponse.json({ error: "We could not send your request. Please try again." }, { status: 500 });
  }
}
