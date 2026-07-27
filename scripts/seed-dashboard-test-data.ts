import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { existsSync, readFileSync } from "node:fs";

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

function utcDate(daysFromToday: number, hour = 0) {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysFromToday,
      hour
    )
  );
}

function utcYearDate(month: number, day: number, hour = 0) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), month, day, hour));
}

async function main() {
  const requestedSlug = process.env.DASHBOARD_TEST_ORG_SLUG;
  const organizations = await prisma.organization.findMany({
    where: {
      isActive: true,
      ...(requestedSlug ? { slug: requestedSlug } : {})
    },
    include: {
      halls: { where: { isActive: true }, take: 1 },
      eventTypes: { where: { isActive: true }, take: 1 },
      primaryUsers: { where: { isActive: true }, take: 5 }
    },
    orderBy: { updatedAt: "desc" }
  });

  const organization =
    organizations.find((candidate) =>
      candidate.primaryUsers.some((user) => user.email !== "admin@example.com")
    ) ?? organizations[0];

  if (!organization) {
    throw new Error("No active organization was found.");
  }

  const hall = organization.halls[0];
  const eventType = organization.eventTypes[0];
  const user =
    organization.primaryUsers.find(
      (candidate) => candidate.email !== "admin@example.com"
    ) ?? organization.primaryUsers[0];

  if (!hall || !user) {
    throw new Error(
      `Organization "${organization.name}" needs an active hall and user before dashboard data can be seeded.`
    );
  }

  await prisma.paymentRefund.deleteMany({
    where: {
      organizationId: organization.id,
      provider: { in: ["dashboard-test", "dashboard-graph-demo"] }
    }
  });
  await prisma.paymentTransaction.deleteMany({
    where: {
      organizationId: organization.id,
      provider: { in: ["dashboard-test", "dashboard-graph-demo"] }
    }
  });
  await prisma.event.deleteMany({
    where: {
      organizationId: organization.id,
      OR: [
        { email: "dashboard-test@example.com" },
        { email: "dashboard-graph-demo@example.com" },
        { clientName: { startsWith: "Dashboard Test -" } }
      ]
    }
  });

  const now = new Date();
  const currentMonth = now.getUTCMonth();
  const monthlyCounts = [1, 2, 3, 1, 4, 2, 3, 1, 3, 2, 1, 2];
  const startHours = [14, 16, 18, 19, 20, 21];
  const eventFixtures: Array<{
    id: string;
    clientName: string;
    eventDate: Date;
    startsAt: Date;
    createdAt: Date;
    bookingStatus: "CONFIRMED" | "HOLD";
    eventStatus: string;
    paymentStatus: string;
    amountDue: number;
  }> = [];

  let eventIndex = 0;
  for (const [month, count] of monthlyCounts.entries()) {
    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      const day = 5 + itemIndex * 6 + (month % 3);
      const eventDate =
        month === currentMonth
          ? utcDate(itemIndex, startHours[eventIndex % startHours.length])
          : utcYearDate(
              month,
              day,
              startHours[eventIndex % startHours.length]
            );
      const createdAt = new Date(
        eventDate.getTime() - (14 + (eventIndex % 5) * 7) * 86_400_000
      );

      const bookingStatus = eventIndex % 5 === 3 ? "HOLD" : "CONFIRMED";
      const needsMenuReview = bookingStatus === "CONFIRMED" && eventIndex % 4 === 2;
      const hasBalanceDue = bookingStatus === "CONFIRMED" && eventIndex % 4 === 1;

      eventFixtures.push({
        id: `d1000000-0000-4000-8000-${String(eventIndex + 1).padStart(12, "0")}`,
        clientName: `Graph Demo Event ${eventIndex + 1}`,
        eventDate,
        startsAt: eventDate,
        createdAt,
        bookingStatus,
        eventStatus: needsMenuReview
          ? "Menu review"
          : bookingStatus === "HOLD"
            ? "Hold"
            : "Confirmed",
        paymentStatus: hasBalanceDue
          ? "Deposit Paid"
          : bookingStatus === "HOLD"
            ? "Not sent"
            : "Paid",
        amountDue: hasBalanceDue ? 7500 : 0
      });
      eventIndex += 1;
    }
  }

  for (const fixture of eventFixtures) {
    await prisma.event.create({
      data: {
        id: fixture.id,
        organizationId: organization.id,
        clientName: fixture.clientName,
        phone: "+1 555 0199",
        email: "dashboard-graph-demo@example.com",
        eventDate: fixture.eventDate,
        startsAt: fixture.startsAt,
        hallId: hall.id,
        hallName: hall.name,
        eventTypeId: eventType?.id,
        eventType: eventType?.name ?? "Celebration",
        eventStatus: fixture.eventStatus,
        bookingStatus: fixture.bookingStatus,
        paymentStatus: fixture.paymentStatus,
        couplesCount: 30 + (eventIndex % 25),
        menCount: 35,
        ladiesCount: 35,
        kidsCount: 8,
        finalTotal: 15000,
        amountDue: fixture.amountDue,
        createdAt: fixture.createdAt,
        createdById: user.id
      }
    });
  }

  const currentMonthEvents = eventFixtures.filter(
    (fixture) => fixture.eventDate.getUTCMonth() === currentMonth
  );
  const paymentAmounts = [1_500_000, 1_000_000, 500_000, 800_000];
  const paymentDays = [4, 10, 16, 22];
  const paymentIds: string[] = [];

  for (const [index, amountCents] of paymentAmounts.entries()) {
    const id = `e1000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    paymentIds.push(id);
    await prisma.paymentTransaction.create({
      data: {
        id,
        organizationId: organization.id,
        eventId: currentMonthEvents[index % currentMonthEvents.length].id,
        amountCents,
        status: "paid",
        provider: "dashboard-graph-demo",
        providerReference: id,
        processedAt: utcYearDate(currentMonth, paymentDays[index], 12),
        note: "Graph demonstration income"
      }
    });
  }

  const refundAmounts = [225_000, 350_000, 175_000];
  const refundDays = [7, 14, 20];
  for (const [index, amountCents] of refundAmounts.entries()) {
    const id = `f1000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    await prisma.paymentRefund.create({
      data: {
        id,
        organizationId: organization.id,
        paymentTransactionId: paymentIds[index],
        amountCents,
        status: "PROCESSED",
        provider: "dashboard-graph-demo",
        providerReference: id,
        reason: "Graph demonstration expense",
        processedAt: utcYearDate(currentMonth, refundDays[index], 12)
      }
    });
  }

  console.log(
    `Replaced Dashboard test data with ${eventFixtures.length} varied events, 4 payments, and 3 refunds for "${organization.name}" (${organization.slug}).`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
