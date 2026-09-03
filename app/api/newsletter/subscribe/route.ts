import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { log } from "@/lib/logging/context";

const subscriptionSchema = z.object({
  email: z.string().trim().email().max(254),
  website: z.string().max(0).optional()
});

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "newsletter-subscribe",
      limit: 5,
      windowMs: 10 * 60 * 1000
    });
    if (limited) return limited;

    const input = subscriptionSchema.parse(await request.json());
    const email = input.email.toLowerCase();

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email },
      update: {
        status: "subscribed",
        source: "website_footer",
        subscribedAt: new Date(),
        unsubscribedAt: null
      }
    });

    return NextResponse.json({
      message: "Thank you for subscribing!"
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    log.error(
      {
        err:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { name: "NonError", message: String(error) },
        status: 500
      },
      "newsletter_subscription_failed"
    );
    return NextResponse.json(
      { error: "We could not complete your subscription. Please try again." },
      { status: 500 }
    );
  }
}
