import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);

    if (!match) {
      continue;
    }

    const name = match[1].trim();
    const value = match[2].trim().replace(/^"(.*)"$/, "$1");

    process.env[name] ??= value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const url = new URL(databaseUrl);

  if (
    url.searchParams.get("sslmode") === "require" &&
    !url.searchParams.has("uselibpqcompat")
  ) {
    url.searchParams.set("uselibpqcompat", "true");
  }

  return url.toString();
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: getDatabaseUrl()
  })
});

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "demo-hall-management" },
    update: { name: "Demo Hall Management", isActive: true },
    create: { name: "Demo Hall Management", slug: "demo-hall-management" }
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      name: "Platform Admin",
      role: "admin",
      isActive: true,
      organizationId: organization.id
    },
    create: {
      email: "admin@example.com",
      name: "Platform Admin",
      role: "admin",
      organizationId: organization.id
    }
  });

  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: admin.id
      }
    },
    update: { role: "owner", isActive: true },
    create: {
      organizationId: organization.id,
      userId: admin.id,
      role: "owner"
    }
  });

  await prisma.userAccess.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: admin.id
      }
    },
    update: {},
    create: {
      organizationId: organization.id,
      userId: admin.id,
      canViewHome: true,
      canViewCalendar: true,
      canCreateBooking: true,
      canViewEventManager: true,
      canViewKitchenDashboard: true,
      canViewMenu: true,
      canEditMenu: true,
      canViewSettings: true,
      canEditSettings: true,
      canAssignWorkers: true,
      canUpdateKitchenStatus: true,
      canAddKitchenEvents: true,
      canViewPaymentInfo: true,
      canManagePayments: true,
      canSendPaymentEmail: true
    }
  });

  const mainHall = await prisma.hall.upsert({
    where: { id: "11111111-1111-4111-8111-111111111111" },
    update: {
      organizationId: organization.id,
      name: "Hall 1",
      isActive: true,
      isBookable: true,
      capacity: 400
    },
    create: {
      id: "11111111-1111-4111-8111-111111111111",
      organizationId: organization.id,
      name: "Hall 1",
      isActive: true,
      isBookable: true,
      basePrice: 12000,
      perCouplePrice: 85,
      capacity: 400,
      color: "#3155ff"
    }
  });

  const secondHall = await prisma.hall.upsert({
    where: { id: "22222222-2222-4222-8222-222222222222" },
    update: {
      organizationId: organization.id,
      name: "Hall 2",
      isActive: true,
      isBookable: true,
      capacity: 250
    },
    create: {
      id: "22222222-2222-4222-8222-222222222222",
      organizationId: organization.id,
      name: "Hall 2",
      isActive: true,
      isBookable: true,
      basePrice: 9000,
      perCouplePrice: 70,
      capacity: 250,
      color: "#7138f5"
    }
  });

  const weddingType = await prisma.eventType.upsert({
    where: { id: "33333333-3333-4333-8333-333333333333" },
    update: {
      organizationId: organization.id,
      name: "Wedding",
      isActive: true
    },
    create: {
      id: "33333333-3333-4333-8333-333333333333",
      organizationId: organization.id,
      name: "Wedding",
      isActive: true,
      validDays: [0, 1, 2, 3, 4]
    }
  });

  const weddingPackage = await prisma.eventPackage.upsert({
    where: { id: "44444444-4444-4444-8444-444444444444" },
    update: {
      organizationId: organization.id,
      name: "Standard Wedding",
      isActive: true
    },
    create: {
      id: "44444444-4444-4444-8444-444444444444",
      organizationId: organization.id,
      name: "Standard Wedding",
      hallIds: [mainHall.id, secondHall.id],
      eventTypeIds: [weddingType.id],
      regularPrice: 12000,
      memberPrice: 10000,
      notes: "Base wedding package for seeded development data."
    }
  });

  await prisma.paymentSetting.upsert({
    where: { id: "55555555-5555-4555-8555-555555555555" },
    update: {
      organizationId: organization.id,
      paymentLink: "https://secure.cardknox.com/belzcheiderevents"
    },
    create: {
      id: "55555555-5555-4555-8555-555555555555",
      organizationId: organization.id,
      paymentLink: "https://secure.cardknox.com/belzcheiderevents",
      paymentEmailSubject: "Payment Link for Your Event"
    }
  });

  const vendorCount = await prisma.vendor.count({
    where: { organizationId: organization.id }
  });

  if (vendorCount === 0) {
    await prisma.vendor.createMany({
      data: [
        {
          organizationId: organization.id,
          name: "Gourmet Delights Catering",
          description: "Full-service kosher catering",
          category: "Catering",
          contactName: "Sarah Gold",
          email: "sarah@gourmet-delights.example",
          phone: "718-555-0142",
          status: "Active",
          rating: 4.6,
          notes: "Sample vendor record for UI demonstration."
        },
        {
          organizationId: organization.id,
          name: "Linen Touch",
          description: "Table linens and event rentals",
          category: "Linens",
          contactName: "Michael Levine",
          email: "michael@linen-touch.example",
          phone: "718-555-0198",
          status: "Active",
          rating: 4.4,
          notes: "Sample vendor record for UI demonstration."
        },
        {
          organizationId: organization.id,
          name: "Blossom & Bloom",
          description: "Floral design and centerpieces",
          category: "Flowers",
          contactName: "Rachel Green",
          email: "rachel@blossom-bloom.example",
          phone: "718-555-0233",
          status: "Active",
          rating: 4.9,
          notes: "Sample vendor record for UI demonstration."
        },
        {
          organizationId: organization.id,
          name: "Premier Party Rentals",
          description: "Furniture, decor, and equipment rentals",
          category: "Rentals",
          contactName: "David Cohen",
          email: "david@premier-rentals.example",
          phone: "718-555-0177",
          status: "Active",
          rating: 4.3,
          notes: "Sample vendor record for UI demonstration."
        },
        {
          organizationId: organization.id,
          name: "AV Pro Solutions",
          description: "Audio, lighting, and presentation systems",
          category: "AV Services",
          contactName: "Jason Patel",
          email: "jason@av-pro.example",
          phone: "718-555-0288",
          status: "Active",
          rating: 4.5,
          notes: "Sample vendor record for UI demonstration."
        },
        {
          organizationId: organization.id,
          name: "Sweet Endings Bakery",
          description: "Desserts, pastries, and custom cakes",
          category: "Bakery",
          contactName: "Avi Stern",
          email: "avi@sweet-endings.example",
          phone: "718-555-0204",
          status: "Active",
          rating: 4.7,
          notes: "Sample vendor record for UI demonstration."
        }
      ]
    });
  }

  await prisma.event.upsert({
    where: { id: "66666666-6666-4666-8666-666666666666" },
    update: { organizationId: organization.id },
    create: {
      id: "66666666-6666-4666-8666-666666666666",
      organizationId: organization.id,
      clientName: "Goldman Family",
      phone: "+1 555 0100",
      email: "goldman@example.com",
      eventDate: new Date("2026-07-12T00:00:00.000Z"),
      hallId: mainHall.id,
      hallName: mainHall.name,
      eventTypeId: weddingType.id,
      eventType: weddingType.name,
      eventStatus: "Confirmed",
      paymentStatus: "Deposit Paid",
      packageId: weddingPackage.id,
      packageName: weddingPackage.name,
      couplesCount: 125,
      menCount: 120,
      ladiesCount: 120,
      kidsCount: 10,
      waitersCount: 12,
      finalTotal: 12000,
      amountDue: 8000,
      createdById: admin.id
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
