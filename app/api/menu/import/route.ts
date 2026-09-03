import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_MENU_CSV_ROWS } from "@/features/menu/lib/menu-csv";
import { resolveMenuCategoryId } from "@/features/menu/server/menu-categories";
import { menuItemFieldsSchema } from "@/features/menu/validations/menu-item.schema";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { withRoute } from "@/lib/http/with-route";

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

export const POST = withRoute(
  "POST /api/menu/import",
  async (request: Request) => {
    try {
      // Higher than the billing import's 5: fixing the rows this endpoint's
      // review step rejected and re-uploading is the expected loop, not abuse.
      const limited = await enforceRateLimit(request, {
        scope: "menu-import",
        limit: 10,
        windowMs: 10 * 60 * 1000
      });
      if (limited) return limited;

      const actor = await authorize(request, "menu.import");
      const input = schema.parse(await request.json());

      // Resolved once per distinct name rather than once per row: a 500-row sheet
      // is usually a handful of courses, and a name that reaches this twice must
      // come back as the same category both times. Sequential for the same
      // reason - two creates of one new course would otherwise race.
      const categoryIdByName = new Map<string, string | null>();
      for (const { category } of input.items) {
        const key = category?.trim().toLowerCase() ?? "";

        if (categoryIdByName.has(key)) continue;

        categoryIdByName.set(
          key,
          await resolveMenuCategoryId(actor.organizationId, category)
        );
      }

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
              // Imported dishes get a real course too, or they would all arrive
              // unfiled on the event menu's tabs.
              categoryId:
                categoryIdByName.get(fields.category?.trim().toLowerCase() ?? "") ??
                null,
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
          userId: actor.userId,
          userName: actor.actorName,
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
);
