import { NextResponse } from "next/server";
import { z } from "zod";
import { readPackageItemIdsError } from "@/features/menu/server/menu-package-items";
import { readPicturePathError } from "@/features/menu/server/menu-picture";
import { menuItemFieldsSchema } from "@/features/menu/validations/menu-item.schema";
import { menuPackageFieldsSchema } from "@/features/menu/validations/menu-package.schema";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";
import { createSignedFileUrls } from "@/lib/storage/files";
import { moneySchema } from "@/lib/validation/number";

const menuMutationSchema = z.discriminatedUnion("resource", [
  menuItemFieldsSchema.extend({ resource: z.literal("item") }),
  menuPackageFieldsSchema.extend({ resource: z.literal("package") }),
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
        // `pictureBucket` is never read back: every stored picture lives in
        // MENU_IMAGE_BUCKET by construction, and the client is given a signed
        // URL, not a location. `countingRules` is superseded by `services` and
        // kept only as a migration safety net - not shipping it is what keeps it
        // dead until the column is dropped.
        omit: { pictureBucket: true, countingRules: true },
        // The Buffet and Plated tabs are "items having a rule for this style",
        // so the rules have to travel with the item or the grid would need a
        // request per card.
        include: {
          services: {
            select: {
              serviceStyle: true,
              quantity: true,
              unit: true,
              per: true,
              perBasis: true,
              rounding: true,
              minimumUnits: true
            },
            orderBy: { serviceStyle: "asc" }
          }
        },
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

    const itemsWithPictures = items.map(({ picturePath, services, ...item }) => ({
      ...item,
      // `quantity` is a Prisma `Decimal`, which JSON-encodes as a string. The
      // client parses these rules with a schema that expects numbers, so the
      // conversion belongs here rather than in every reader.
      services: (services ?? []).map((service) => ({
        ...service,
        quantity: Number(service.quantity)
      })),
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
        const picturePathError = readPicturePathError(
          actor.organizationId,
          input.picturePath
        );
        if (picturePathError) {
          return NextResponse.json(
            { error: picturePathError },
            { status: 400 }
          );
        }
      }

      // The item and its service rules are one thing to a caller, so they are
      // one transaction here. A dish that saved without the rule it was created
      // with would sit on no service tab and read as a failed save.
      const item = await prisma.menuItem.create({
        data: {
          organizationId: actor.organizationId,
          name: input.name,
          category: input.category,
          usageType: input.usageType,
          kind: input.kind,
          kosherType: input.kosherType,
          allergens: input.allergens ?? [],
          notes: input.notes,
          picturePath: input.picturePath,
          // Set here, not taken from the request - the same reason
          // organizationId is injected rather than accepted.
          pictureBucket: input.picturePath ? MENU_IMAGE_BUCKET : null,
          services: {
            create: (input.services ?? []).map((service) => ({
              organizationId: actor.organizationId,
              ...service
            }))
          }
        },
        include: { services: true }
      });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (input.resource === "package") {
      const itemIdsError = await readPackageItemIdsError(
        actor.organizationId,
        input.includedMenuItemIds
      );
      if (itemIdsError) {
        return NextResponse.json({ error: itemIdsError }, { status: 400 });
      }

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
