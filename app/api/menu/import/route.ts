import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_MENU_CSV_ROWS } from "@/features/menu/lib/menu-csv";
import { menuItemFieldsSchema } from "@/features/menu/validations/menu-item.schema";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * The same fields `POST /api/menu` accepts for one item, minus the picture.
 *
 * Reusing `menuItemFieldsSchema` rather than restating it is the point its own
 * docstring makes about create and update: two handlers writing one row must
 * not drift into accepting different shapes for it. This is the third.
 *
 * `picturePath` is omitted rather than left optional because a CSV carries no
 * file - pictures are added per item afterwards - and an endpoint that cannot
 * receive a path is one that needs no `readPicturePathError` check.
 */
const schema = z.object({
  items: z
    .array(menuItemFieldsSchema.omit({ picturePath: true }))
    .min(1)
    .max(MAX_MENU_CSV_ROWS)
});

export async function POST(request: Request) {
  try {
    // Higher than the billing import's 5: fixing the rows this endpoint's
    // review step rejected and re-uploading is the expected loop, not abuse.
    const limited = await enforceRateLimit(request, {
      scope: "menu-import",
      limit: 10,
      windowMs: 10 * 60 * 1000
    });
    if (limited) return limited;

    const actor = await requirePermission(request, "canEditMenu");
    const input = schema.parse(await request.json());

    // `createMany` cannot write the nested service rows, and a bulk import is
    // all-or-nothing by intent: the operator reviewed the file and confirmed a
    // count, so a partial write would leave them with a menu they cannot
    // reconcile against the sheet and no bulk delete to undo it with.
    const created = await prisma.$transaction(
      input.items.map(({ services, allergens, ...fields }) =>
        prisma.menuItem.create({
          data: {
            // Injected, never accepted from the body - the same rule every
            // other tenant-owned write in this app follows.
            organizationId: actor.organizationId,
            ...fields,
            allergens: allergens ?? [],
            services: {
              create: (services ?? []).map((service) => ({
                organizationId: actor.organizationId,
                ...service
              }))
            }
          },
          // The client refetches the menu rather than reading these back, and
          // 500 hydrated rows is a response nobody consumes.
          select: { id: true }
        })
      )
    );

    // The only trace a 500-row write leaves. Every other menu mutation is one
    // visible card; this one is not.
    await prisma.activityLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        userName: actor.name,
        actionType: "Menu Items Imported",
        message: `Imported ${created.length} menu items from a CSV file.`,
        newValue: { count: created.length }
      }
    });

    return NextResponse.json({ imported: created.length }, { status: 201 });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
