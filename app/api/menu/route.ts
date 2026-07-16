import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const menuMutationSchema = z.discriminatedUnion("resource", [
  z.object({
    resource: z.literal("item"),
    name: z.string().trim().min(1),
    category: z.string().trim().optional(),
    usageType: z.string().trim().min(1),
    kosherType: z.string().trim().optional(),
    notes: z.string().trim().optional()
  }),
  z.object({
    resource: z.literal("package"),
    name: z.string().trim().min(1),
    regularPrice: z.number().nonnegative().optional(),
    memberPrice: z.number().nonnegative().optional(),
    hallIds: z.array(z.string().uuid()).default([]),
    eventTypeIds: z.array(z.string().uuid()).default([]),
    includedMenuItemIds: z.array(z.string().uuid()).default([]),
    notes: z.string().trim().optional()
  }),
  z.object({
    resource: z.literal("addon"),
    name: z.string().trim().min(1),
    price: z.number().nonnegative().optional(),
    pricingType: z.string().trim().min(1),
    hallIds: z.array(z.string().uuid()).default([]),
    notes: z.string().trim().optional()
  })
]);

export async function GET(request: Request) {
  try {
    const actor = await requirePermission(request, "canViewMenu");
    const [items, packages, addOns, categories] = await Promise.all([
      prisma.menuItem.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { name: "asc" }
      }),
      prisma.eventPackage.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { name: "asc" }
      }),
      prisma.addOn.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { name: "asc" }
      }),
      prisma.menuCategory.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { name: "asc" }
      })
    ]);
    return NextResponse.json({ items, packages, addOns, categories });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canEditMenu");
    const input = menuMutationSchema.parse(await request.json());

    if (input.resource === "item") {
      const item = await prisma.menuItem.create({
        data: {
          organizationId: actor.organizationId,
          name: input.name,
          category: input.category,
          usageType: input.usageType,
          kosherType: input.kosherType,
          notes: input.notes
        }
      });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (input.resource === "package") {
      const itemPackage = await prisma.eventPackage.create({
        data: {
          organizationId: actor.organizationId,
          name: input.name,
          regularPrice: input.regularPrice,
          memberPrice: input.memberPrice,
          hallIds: input.hallIds,
          eventTypeIds: input.eventTypeIds,
          includedMenuItemIds: input.includedMenuItemIds,
          notes: input.notes
        }
      });
      return NextResponse.json({ package: itemPackage }, { status: 201 });
    }

    const addOn = await prisma.addOn.create({
      data: {
        organizationId: actor.organizationId,
        name: input.name,
        price: input.price,
        pricingType: input.pricingType,
        hallIds: input.hallIds,
        notes: input.notes
      }
    });
    return NextResponse.json({ addOn }, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
