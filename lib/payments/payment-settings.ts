import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Where one organization's clients should send money.
 *
 * This replaces a global `CARDKNOX_PAYMENT_LINK` env var whose default was a
 * single tenant's live Cardknox account. The public client portal renders for
 * every organization, so a shared constant meant one venue could collect
 * another venue's payments.
 *
 * There is deliberately no fallback. An organization that has not configured a
 * link gets `null`, and the portal hides the Pay balance action - showing no
 * button is recoverable, sending a client to the wrong merchant is not.
 */
export async function getOrganizationPaymentLink(
  organizationId: string
): Promise<string | null> {
  const setting = await prisma.paymentSetting.findUnique({
    where: { organizationId },
    select: { paymentLink: true }
  });

  const paymentLink = setting?.paymentLink?.trim();

  return paymentLink ? paymentLink : null;
}
