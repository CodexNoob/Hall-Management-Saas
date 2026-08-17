import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { existsSync, readFileSync } from "node:fs";

/**
 * One-time migration off the global CARDKNOX_PAYMENT_LINK env var.
 *
 * The public client portal used to read that single variable for every
 * organization, so one tenant's merchant account collected everyone's
 * payments. The portal now reads PaymentSetting.paymentLink per organization
 * and hides Pay balance when it is unset.
 *
 * Run this BEFORE deploying the env change, otherwise the organization that
 * was relying on the global value loses Pay balance until someone sets it in
 * Settings -> Payments & Gmail.
 *
 * Idempotent: organizations that already have a payment link are left alone.
 *
 *   CARDKNOX_PAYMENT_LINK="https://..." npx tsx scripts/backfill-payment-links.ts
 */

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!match) continue;

    const name = match[1].trim();
    const value = match[2].trim().replace(/^"(.*)"$/, "$1");
    process.env[name] ??= value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function databaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const url = new URL(process.env.DATABASE_URL);
  if (
    url.searchParams.get("sslmode") === "require" &&
    !url.searchParams.has("uselibpqcompat")
  ) {
    url.searchParams.set("uselibpqcompat", "true");
  }
  return url.toString();
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl() })
});

async function main() {
  const paymentLink = process.env.CARDKNOX_PAYMENT_LINK?.trim();

  if (!paymentLink) {
    console.log(
      "CARDKNOX_PAYMENT_LINK is not set - nothing to backfill. Configure each organization in Settings -> Payments & Gmail."
    );
    return;
  }

  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" }
  });

  let created = 0;

  for (const organization of organizations) {
    const existing = await prisma.paymentSetting.findUnique({
      where: { organizationId: organization.id },
      select: { paymentLink: true }
    });

    if (existing?.paymentLink?.trim()) {
      console.log(
        `- skipped "${organization.name}" (${organization.slug}); payment link already configured.`
      );
      continue;
    }

    await prisma.paymentSetting.upsert({
      where: { organizationId: organization.id },
      update: { paymentLink },
      create: { organizationId: organization.id, paymentLink }
    });

    created += 1;
    console.log(
      `- set payment link for "${organization.name}" (${organization.slug}).`
    );
  }

  console.log(
    `Backfilled ${created} of ${organizations.length} organizations. Review each one in Settings -> Payments & Gmail; they all currently point at the same merchant.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
