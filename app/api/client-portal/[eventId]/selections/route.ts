import { NextResponse } from "next/server";
import { z } from "zod";

import { discardOrphanedKitchenStatuses } from "@/features/events/server/event-menu-document";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * Client-facing menu selections for the public portal at /client/[eventId].
 *
 * This route is unauthenticated by design - the client holding the portal link
 * is not an Event Core user. That makes three things load-bearing:
 *
 * 1. `organizationId` comes from the event row, never from the request. The
 *    body carries option ids only.
 * 2. Every referenced id is checked to belong to that organization and to be
 *    active. Without this, a client could attach another venue's package to
 *    their event just by guessing an id.
 * 3. Once staff confirm the menu, the event is closed to client edits, so the
 *    portal cannot silently change what the kitchen already committed to.
 */

const selectionsSchema = z
  .object({
    packageId: z.string().uuid().nullable().optional(),
    tableclothId: z.string().uuid().nullable().optional(),
    menuItemIds: z.array(z.string().uuid()).max(200).optional(),
    addOnIds: z.array(z.string().uuid()).max(100).optional()
  })
  .strict();

const eventIdSchema = z.string().uuid();

function unknownSelection(label: string) {
  return NextResponse.json(
    { error: `That ${label} is not available for this event.` },
    { status: 400 }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "client-portal-selections",
      limit: 20,
      windowMs: 60_000
    });

    if (limited) return limited;

    const { eventId } = await context.params;
    const parsedEventId = eventIdSchema.safeParse(eventId);

    if (!parsedEventId.success) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const event = await prisma.event.findFirst({
      where: { id: parsedEventId.data, deleted: false },
      select: {
        id: true,
        organizationId: true,
        packageId: true,
        tableclothId: true,
        menuItemIds: true,
        addOnIds: true,
        workspaceData: true
      }
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const workspaceData = event.workspaceData;
    const menuConfirmed =
      typeof workspaceData === "object" &&
      workspaceData !== null &&
      (workspaceData as { menuConfirmed?: unknown }).menuConfirmed === true;

    if (menuConfirmed) {
      return NextResponse.json(
        {
          error:
            "This menu has been confirmed by the venue and can no longer be changed here."
        },
        { status: 409 }
      );
    }

    const input = selectionsSchema.parse(await request.json());
    const { organizationId } = event;

    // Every id below is verified against this organization's active records.
    // The names come back from the same lookup so the denormalised
    // Event.packageName / tableclothName columns stay in step.
    let selectedPackage: { name: string } | null = null;
    let selectedTablecloth: { name: string } | null = null;

    if (input.packageId) {
      selectedPackage = await prisma.eventPackage.findFirst({
        where: { id: input.packageId, organizationId, isActive: true },
        select: { name: true }
      });

      if (!selectedPackage) return unknownSelection("package");
    }

    if (input.tableclothId) {
      selectedTablecloth = await prisma.tableclothOption.findFirst({
        where: { id: input.tableclothId, organizationId, isActive: true },
        select: { name: true }
      });

      if (!selectedTablecloth) return unknownSelection("tablecloth option");
    }

    if (input.menuItemIds?.length) {
      const owned = await prisma.menuItem.count({
        where: {
          id: { in: input.menuItemIds },
          organizationId,
          isActive: true
        }
      });

      if (owned !== new Set(input.menuItemIds).size) {
        return unknownSelection("menu item");
      }
    }

    if (input.addOnIds?.length) {
      const owned = await prisma.addOn.count({
        where: { id: { in: input.addOnIds }, organizationId, isActive: true }
      });

      if (owned !== new Set(input.addOnIds).size) {
        return unknownSelection("add-on");
      }
    }

    const updated = await prisma.$transaction(async (transaction) => {
      const next = await transaction.event.update({
        where: { id: event.id, organizationId },
        data: {
          ...(input.packageId !== undefined
            ? {
                packageId: input.packageId,
                packageName: selectedPackage?.name ?? null
              }
            : {}),
          ...(input.tableclothId !== undefined
            ? {
                tableclothId: input.tableclothId,
                tableclothName: selectedTablecloth?.name ?? null
              }
            : {}),
          ...(input.menuItemIds !== undefined
            ? { menuItemIds: input.menuItemIds }
            : {}),
          ...(input.addOnIds !== undefined ? { addOnIds: input.addOnIds } : {})
        },
        select: {
          id: true,
          packageId: true,
          tableclothId: true,
          menuItemIds: true,
          addOnIds: true
        }
      });

      // The event menu is a document now, so the client's picks have to land on
      // it as lines and not only in the mirrored id array - otherwise staff open
      // the menu tab and cannot see what the client chose.
      //
      // `ClientSubmitted` is exactly the middle state the status column exists
      // for: the client has answered, staff have not signed it off yet. A
      // confirmed menu never reaches here; the guard above already refused it.
      if (input.menuItemIds !== undefined || input.addOnIds !== undefined) {
        // Whichever list this request did not carry keeps what the event
        // already had, or replacing the lines would wipe the other half.
        const menuItemIds = [
          ...new Set(input.menuItemIds ?? event.menuItemIds)
        ];
        const addOnIds = [...new Set(input.addOnIds ?? event.addOnIds)];

        const menu = await transaction.eventMenu.upsert({
          where: { eventId_meal: { eventId: event.id, meal: "Main" } },
          create: {
            organizationId,
            eventId: event.id,
            meal: "Main",
            status: "ClientSubmitted",
            version: 1
          },
          update: { status: "ClientSubmitted", version: { increment: 1 } },
          select: { id: true }
        });

        // A dish served exactly one way needs no decision; one that carries
        // both a Buffet and a Plated rule is left unset for staff to answer,
        // because the portal never asked the client and guessing would put the
        // wrong quantity rule in front of the kitchen.
        const stylesByMenuItemId = new Map(
          (
            await transaction.menuItem.findMany({
              where: { id: { in: menuItemIds }, organizationId },
              select: { id: true, services: { select: { serviceStyle: true } } }
            })
          ).map((item) => [
            item.id,
            [...new Set(item.services.map((service) => service.serviceStyle))]
          ])
        );

        await transaction.eventMenuLine.deleteMany({
          where: { eventMenuId: menu.id }
        });
        await transaction.eventMenuLine.createMany({
          data: [
            ...menuItemIds.map((menuItemId, index) => {
              const styles = stylesByMenuItemId.get(menuItemId) ?? [];

              return {
                organizationId,
                eventMenuId: menu.id,
                menuItemId,
                serviceStyle: styles.length === 1 ? styles[0] : null,
                sortOrder: index,
                // Recorded rather than assumed: a line staff added and a line
                // the client picked are not the same thing when they disagree.
                source: "ClientPortal"
              };
            }),
            ...addOnIds.map((addOnId, index) => ({
              organizationId,
              eventMenuId: menu.id,
              addOnId,
              sortOrder: menuItemIds.length + index,
              source: "ClientPortal"
            }))
          ]
        });

        // A client dropping a dish removes it as surely as staff doing it, so
        // the kitchen rows behind it go too.
        await discardOrphanedKitchenStatuses(transaction, {
          organizationId,
          eventId: event.id
        });
      }

      await transaction.activityLog.create({
        data: {
          organizationId,
          eventId: event.id,
          actionType: "Client Portal Selection Updated",
          message: "The client updated their selections from the event portal.",
          oldValue: {
            packageId: event.packageId,
            tableclothId: event.tableclothId,
            menuItemIds: event.menuItemIds,
            addOnIds: event.addOnIds
          },
          newValue: {
            packageId: next.packageId,
            tableclothId: next.tableclothId,
            menuItemIds: next.menuItemIds,
            addOnIds: next.addOnIds
          }
        }
      });

      return next;
    });

    return NextResponse.json({ selections: updated });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
