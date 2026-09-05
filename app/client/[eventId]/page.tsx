import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientPortalPreviewContent } from "@/features/events/components/event-client-portal-content";
import { getClientPortalEvent } from "@/features/events/server/client-portal-data";
import { getOrganizationPaymentLink } from "@/lib/payments/payment-settings";

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

  const lookup = await getClientPortalEvent(eventId);

  if (!lookup) notFound();

  // Per organization. A global link here previously sent every venue's clients
  // to the same merchant account.
  const paymentUrl = await getOrganizationPaymentLink(lookup.organizationId);

  return (
    <main className="min-h-screen bg-[#eef4fa] px-3 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <ClientPortalPreviewContent
          paymentUrl={paymentUrl}
          portal={lookup.portal}
        />
      </div>
    </main>
  );
}
