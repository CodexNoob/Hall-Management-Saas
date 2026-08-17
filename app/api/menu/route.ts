import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";
import { createSignedFileUrls } from "@/lib/storage/files";
import { moneySchema } from "@/lib/validation/number";

const menuMutationSchema = z.discriminatedUnion("resource", [
  z.object({
    resource: z.literal("item"),
    name: z.string().trim().min(1),
    category: z.string().trim().optional(),
    usageType: z.string().trim().min(1),
    kosherType: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    // A storage path, never a bucket and never a URL. The bucket is decided
    // server-side; a signed URL would be dead within five minutes.
    picturePath: z.string().trim().min(1).optional()
  }),
  z.object({
    resource: z.literal("package"),
    name: z.string().trim().min(1),
    regularPrice: moneySchema({ label: "Regular price" }).optional(),
    memberPrice: moneySchema({ label: "Member price" }).optional(),
    hallIds: z.array(z.string().uuid()).default([]),
    eventTypeIds: z.array(z.string().uuid()).default([]),
    includedMenuItemIds: z.array(z.string().uuid()).default([]),
    notes: z.string().trim().optional()
  }),
  z.object({
    resource: z.literal("addon"),
    name: z.string().trim().min(1),
    price: moneySchema({ label: "Price" }).optional(),
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
        // Never read back: every stored picture lives in MENU_IMAGE_BUCKET by
        // construction, and the client is given a signed URL, not a location.
        omit: { pictureBucket: true },
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

    // One batch call for the whole grid rather than one per card. The 300s URL
    // outlives the 2 minute client query cache, so a cached response never
    // holds an expired URL.
    let signedUrlsByPath = new Map<string, string>();
    const picturePaths = items
      .map((item) => item.picturePath)
      .filter((path): path is string => Boolean(path));

    if (picturePaths.length > 0) {
      try {
        signedUrlsByPath = await createSignedFileUrls({
          organizationId: actor.organizationId,
          bucket: MENU_IMAGE_BUCKET,
          paths: picturePaths
        });
      } catch (signingError) {
        // Storage being unreachable should cost the thumbnails, not the page.
        console.error("Failed to sign menu item pictures", signingError);
      }
    }

    const itemsWithPictures = items.map(({ picturePath, ...item }) => ({
      ...item,
      pictureUrl: picturePath
        ? (signedUrlsByPath.get(picturePath) ?? null)
        : null
    }));

    return NextResponse.json({
      items: itemsWithPictures,
      packages,
      addOns,
      categories
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canEditMenu");
    const input = menuMutationSchema.parse(await request.json());

    if (input.resource === "item") {
      if (input.picturePath) {
        if (!input.picturePath.startsWith(`${actor.organizationId}/`)) {
          return NextResponse.json(
            { error: "Picture path must begin with the active organization ID." },
            { status: 400 }
          );
        }

        if (
          input.picturePath.includes("..") ||
          input.picturePath.includes("\\")
        ) {
          return NextResponse.json(
            { error: "Invalid picture path." },
            { status: 400 }
          );
        }
      }

      const item = await prisma.menuItem.create({
        data: {
          organizationId: actor.organizationId,
          name: input.name,
          category: input.category,
          usageType: input.usageType,
          kosherType: input.kosherType,
          notes: input.notes,
          picturePath: input.picturePath,
          // Set here, not taken from the request - the same reason
          // organizationId is injected rather than accepted.
          pictureBucket: input.picturePath ? MENU_IMAGE_BUCKET : null
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
