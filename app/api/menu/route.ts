import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveMenuCategoryId } from "@/features/menu/server/menu-categories";
import { readPackageItemIdsError } from "@/features/menu/server/menu-package-items";
import { readPicturePathError } from "@/features/menu/server/menu-picture";
import { menuItemFieldsSchema } from "@/features/menu/validations/menu-item.schema";
import { menuPackageFieldsSchema } from "@/features/menu/validations/menu-package.schema";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { MENU_IMAGE_BUCKET } from "@/lib/storage/buckets";
import { createSignedFileUrls } from "@/lib/storage/files";
import { moneySchema } from "@/lib/validation/number";
import { log } from "@/lib/logging/context";
import { withRoute } from "@/lib/http/with-route";

const menuMutationSchema = z.discriminatedUnion("resource", [
  menuItemFieldsSchema.extend({ resource: z.literal("item") }),
  menuPackageFieldsSchema.extend({ resource: z.literal("package") }),
  z.object({
    resource: z.literal("addon"),
    name: z.string().trim().min(1),
    price: moneySchema({ label: "Price" }).optional(),
    pricingType: z.string().trim().min(1),
    hallIds: z.array(z.string().uuid()).default([]),
    notes: z.string().trim().optional(),
    // A storage path, never a bucket and never a URL - the same contract
    // `menuItemFieldsSchema` states for the column of the same name.
    picturePath: z.string().trim().min(1).optional()
  })
]);

export const GET = withRoute(
  "GET /api/menu",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "menu.read");
      const includePictures =
        new URL(request.url).searchParams.get("pictures") !== "0";
      const [items, packages, addOns, categories] = await Promise.all([
        prisma.menuItem.findMany({
          where: { organizationId: actor.organizationId },
          // Keep the list route lean: timestamps, tenant ids, storage buckets
          // and legacy counting rows are not part of the client contract.
          select: {
            id: true,
            name: true,
            // Deactivated rows travel with their flag rather than being
            // filtered out here: the library grid shows them, and the event
            // menu's selector is the one that drops them. Leaving this out of
            // the select does not fail - it hands every reader `undefined`,
            // which their `isActive` filters read as "not active", and the
            // drawer offers nothing at all.
            isActive: true,
            category: true,
            usageType: true,
            kind: true,
            kosherType: true,
            containsAlcohol: true,
            allergens: true,
            notes: true,
            picturePath: true,
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
          // The Buffet and Plated tabs are "items having a rule for this style",
          // so the rules have to travel with the item or the grid would need a
          // request per card.
          orderBy: { name: "asc" }
        }),
        prisma.eventPackage.findMany({
          where: { organizationId: actor.organizationId },
          select: {
            id: true,
            name: true,
            isActive: true,
            regularPrice: true,
            includedMenuItemIds: true
          },
          orderBy: { name: "asc" }
        }),
        prisma.addOn.findMany({
          where: { organizationId: actor.organizationId },
          select: {
            id: true,
            name: true,
            isActive: true,
            price: true,
            pricingType: true,
            notes: true,
            picturePath: true
          },
          orderBy: { name: "asc" }
        }),
        // Ordered by `sortOrder`, because these are the course tabs on the event
        // menu now and menu order is not alphabetical order.
        prisma.menuCategory.findMany({
          where: { organizationId: actor.organizationId },
          select: { id: true, name: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        })
      ]);

      let signedUrlsByPath = new Map<string, string>();
      if (includePictures) {
        // One batch call for the whole grid rather than one per card, and
        // add-ons ride along in it: they live in the same bucket under the same
        // tenant prefix, so splitting them out would only cost a second round
        // trip. The menu page can opt out for its first paint and hydrate
        // thumbnails after the usable rows are already on screen.
        const picturePaths = [...items, ...addOns]
          .map((row) => row.picturePath)
          .filter((path): path is string => Boolean(path));

        try {
          if (picturePaths.length > 0) {
            signedUrlsByPath = await createSignedFileUrls({
              organizationId: actor.organizationId,
              bucket: MENU_IMAGE_BUCKET,
              paths: picturePaths
            });
          }
        } catch (signingError) {
          // Storage being unreachable should cost the thumbnails, not the page.
          log.error(
            { count: picturePaths.length, err: String(signingError) },
            "menu_picture_signing_failed"
          );
        }
      }

      const readPictureUrl = (picturePath: string | null) =>
        picturePath ? (signedUrlsByPath.get(picturePath) ?? null) : null;

      const itemsWithPictures = items.map(({ picturePath, services, ...item }) => ({
        ...item,
        // `quantity` is a Prisma `Decimal`, which JSON-encodes as a string. The
        // client parses these rules with a schema that expects numbers, so the
        // conversion belongs here rather than in every reader.
        services: (services ?? []).map((service) => ({
          ...service,
          quantity: Number(service.quantity)
        })),
        pictureUrl: readPictureUrl(picturePath)
      }));

      const addOnsWithPictures = addOns.map(({ picturePath, ...addOn }) => ({
        ...addOn,
        pictureUrl: readPictureUrl(picturePath)
      }));

      return NextResponse.json({
        items: itemsWithPictures,
        packages,
        addOns: addOnsWithPictures,
        categories
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

export const POST = withRoute(
  "POST /api/menu",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "menu.create");
      const input = menuMutationSchema.parse(await request.json());

      // Checked once for every resource that stores a picture rather than inside
      // each branch: a path the library item refuses must not be one an add-on
      // accepts. `package` carries no picture, hence the `in` guard.
      const picturePath = "picturePath" in input ? input.picturePath : undefined;
      if (picturePath) {
        const picturePathError = readPicturePathError(
          actor.organizationId,
          picturePath
        );
        if (picturePathError) {
          return NextResponse.json({ error: picturePathError }, { status: 400 });
        }
      }

      if (input.resource === "item") {
        // The item and its service rules are one thing to a caller, so they are
        // one transaction here. A dish that saved without the rule it was created
        // with would sit on no service tab and read as a failed save.
        const item = await prisma.menuItem.create({
          data: {
            organizationId: actor.organizationId,
            name: input.name,
            // Both are written: `category` is the deprecated free-text column,
            // still populated for readers on other branches, and `categoryId` is
            // the row the event menu's course tabs are built from.
            category: input.category,
            categoryId: await resolveMenuCategoryId(
              actor.organizationId,
              input.category
            ),
            usageType: input.usageType,
            kind: input.kind,
            kosherType: input.kosherType,
            containsAlcohol: input.containsAlcohol,
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
          notes: input.notes,
          picturePath: input.picturePath,
          // Set here, not taken from the request - the same reason
          // organizationId is injected rather than accepted.
          pictureBucket: input.picturePath ? MENU_IMAGE_BUCKET : null
        }
      });
      return NextResponse.json({ addOn }, { status: 201 });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
