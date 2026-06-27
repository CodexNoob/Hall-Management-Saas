import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Platform Admin",
      access: {
        create: {
          roleName: "admin",
          canManageUsers: true,
          canManageEvents: true,
          canManageMenus: true,
          canManagePayments: true,
          canGeneratePdfs: true,
          canSyncCalendar: true
        }
      }
    }
  });

  const mainHall = await prisma.hall.upsert({
    where: { id: "seed-main-hall" },
    update: {},
    create: {
      id: "seed-main-hall",
      name: "Main Hall",
      capacity: 500
    }
  });

  const weddingPackage = await prisma.eventPackage.create({
    data: {
      name: "Standard Wedding",
      description: "Base wedding package for seeded development data.",
      basePrice: 1200000
    }
  });

  await prisma.event.create({
    data: {
      name: "Sample Wedding",
      customerName: "Goldman Family",
      guestCount: 250,
      startsAt: new Date("2026-07-12T18:00:00.000Z"),
      endsAt: new Date("2026-07-13T02:00:00.000Z"),
      status: "CONFIRMED",
      paymentStatus: "DEPOSIT_PAID",
      hallId: mainHall.id,
      packageId: weddingPackage.id,
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
