import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientPortalPreviewContent } from "@/features/events/components/event-client-portal-content";
import { getCardknoxPaymentLink } from "@/lib/payments/cardknox";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Client event portal | Event Core",
  robots: { index: false, follow: false }
};

export default async function ClientEventPortalPage({
  params
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      eventId
    )
  ) {
    notFound();
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, deleted: false },
    select: {
      clientName: true,
      eventType: true,
      eventDate: true,
      startsAt: true,
      eventStatus: true,
      couplesCount: true,
      boysCount: true,
      girlsCount: true,
      kidsCount: true,
      hall: { select: { name: true } }
    }
  });

  if (!event) notFound();

  const title = `${event.clientName}${event.eventType ? ` ${event.eventType}` : ""}`;
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(event.eventDate);
  const time = event.startsAt
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit"
      }).format(event.startsAt)
    : "Time not set";

  return (
    <main className="min-h-screen bg-[#eef4fa] px-3 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <ClientPortalPreviewContent
          event={{
            title,
            date,
            time,
            room: event.hall.name,
            status: event.eventStatus.toLowerCase().includes("confirm")
              ? "Confirmed"
              : "Hold",
            couples: String(event.couplesCount),
            children: String(
              event.kidsCount + event.boysCount + event.girlsCount
            )
          }}
          paymentUrl={getCardknoxPaymentLink()}
        />
      </div>
    </main>
  );
}
