import "server-only";

import { resolveReplacementStyle } from "@/features/kitchen/components/kitchen-shared";
import { DEFAULT_MEAL } from "@/features/kitchen/server/kitchen-sheet";
import { prisma } from "@/lib/prisma";

/**
 * Swapping one dish for another from the kitchen board.
 *
 * The board carried a `replace-menu-item` action once before and it was taken
 * out, for a good reason: it wrote `Event.menuItemIds` - the legacy mirror - and
 * never touched `EventMenuLine`, which is what the board's own quantity
 * arithmetic, the event's Menu tab and the client portal all read. A dish
 * swapped there changed nothing anybody cooked from.
 *
 * This writes the line. The kitchen genuinely needs the swap - a delivery is
 * short, a dish comes off the fire - and the board is where the person holding
 * that problem is standing. What it must not do is leave the two views of one
 * menu disagreeing again, so a replacement here does everything a save on the
 * Menu tab does: the line, the version bump that makes a concurrent edit fail
 * loudly, and the mirror the older readers still depend on.
 *
 * It deliberately does *not* refuse on a confirmed menu, which the Menu tab's
 * PUT does. A menu is confirmed before the food is cooked, so refusing would
 * leave this working only for events nobody had signed off yet - which is to
 * say, not for the case it exists for. The frozen name travels with the swap
 * instead.
 */

export type ReplaceKitchenDishResult =
  | { outcome: "replaced"; name: string; serviceStyle: string | null }
  /// No line on this event's menu for the dish being taken off.
  | { outcome: "line-not-found" }
  /// The dish going on is not in this organization's library, or is retired.
  | { outcome: "replacement-not-found" }
  | { outcome: "already-on-menu"; name: string }
  /// Somebody else saved this menu first.
  | { outcome: "conflict" };

export async function replaceKitchenDish({
  actorId,
  organizationId,
  eventId,
  menuItemId,
  replacementMenuItemId
}: {
  actorId: string;
  organizationId: string;
  eventId: string;
  menuItemId: string;
  replacementMenuItemId: string;
}): Promise<ReplaceKitchenDishResult> {
  const replacement = await prisma.menuItem.findFirst({
    // Retired dishes stay on the menus that already carry them but are not
    // offered for anything new, which is the rule the menu drawer follows.
    where: { id: replacementMenuItemId, organizationId, isActive: true },
    select: {
      id: true,
      name: true,
      services: { select: { serviceStyle: true } }
    }
  });

  if (!replacement) return { outcome: "replacement-not-found" };

  return prisma.$transaction(async (transaction) => {
    const menu = await transaction.eventMenu.findUnique({
      where: { eventId_meal: { eventId, meal: DEFAULT_MEAL } },
      select: {
        id: true,
        version: true
      }
    });

    if (!menu) return { outcome: "line-not-found" as const };

    // A Prisma transaction uses one pg client. Keep relation reads as explicit
    // awaited queries rather than nested selects that Prisma may fan out while
    // the same transaction client is already busy.
    const swapLines = await transaction.eventMenuLine.findMany({
      where: {
        eventMenuId: menu.id,
        menuItemId: { in: [menuItemId, replacementMenuItemId] }
      },
      select: {
        id: true,
        menuItemId: true,
        serviceStyle: true,
        itemName: true
      }
    });

    const line = swapLines.find((entry) => entry.menuItemId === menuItemId);

    if (!line) return { outcome: "line-not-found" as const };

    if (swapLines.some((entry) => entry.menuItemId === replacement.id)) {
      return { outcome: "already-on-menu" as const, name: replacement.name };
    }

    const serviceStyle = resolveReplacementStyle(
      line.serviceStyle,
      replacement.services.map((service) => service.serviceStyle)
    );

    // The same guard the menu PUT uses. Without it a swap made here and a save
    // made on the Menu tab would each land on top of the other's read.
    const bumped = await transaction.eventMenu.updateMany({
      where: { id: menu.id, version: menu.version },
      data: { version: { increment: 1 } }
    });

    if (bumped.count === 0) return { outcome: "conflict" as const };

    await transaction.eventMenuLine.update({
      where: { id: line.id },
      data: {
        menuItemId: replacement.id,
        serviceStyle,
        // Only a confirmed menu carries a frozen name. Leaving the old one on
        // the line would have every reader print the dish that came off against
        // the dish that went on.
        itemName: line.itemName === null ? null : replacement.name,
        // A note is written about a dish, not about a slot on the menu - "extra
        // crispy" does not survive the salmon it was about.
        notes: null,
        addedById: actorId
      }
    });

    // Rebuilt from the lines rather than patched in place: the mirror has no
    // foreign key holding it to them, and rebuilding is what makes a swap heal
    // drift instead of preserving it. This is the same set the menu PUT writes.
    const remaining = await transaction.eventMenuLine.findMany({
      where: { eventMenuId: menu.id },
      select: { menuItemId: true }
    });

    await transaction.event.update({
      where: { id: eventId, organizationId },
      data: {
        menuItemIds: [
          ...new Set(
            remaining
              .map((entry) => entry.menuItemId)
              .filter((value): value is string => Boolean(value))
          )
        ],
        updatedById: actorId
      }
    });

    const current = await transaction.kitchenItemStatus.findUnique({
      where: { eventId_menuItemId: { eventId, menuItemId } },
      select: { assignedWorkerId: true }
    });

    await transaction.kitchenItemStatus.deleteMany({
      where: { eventId, menuItemId }
    });

    // Whoever was on the old dish is on the new one - the swap changes what is
    // being cooked, not who is cooking it. Progress does not travel: a dish
    // nobody has started must not arrive already ticked. An earlier swap may
    // have left the replacement a row of its own, which is why this upserts
    // rather than creates, and clears rather than trusts.
    if (current?.assignedWorkerId) {
      await transaction.kitchenItemStatus.upsert({
        where: {
          eventId_menuItemId: { eventId, menuItemId: replacement.id }
        },
        update: {
          status: null,
          assignedWorkerId: current.assignedWorkerId,
          updatedById: actorId
        },
        create: {
          organizationId,
          eventId,
          menuItemId: replacement.id,
          status: null,
          assignedWorkerId: current.assignedWorkerId,
          updatedById: actorId
        }
      });
    } else {
      await transaction.kitchenItemStatus.deleteMany({
        where: { eventId, menuItemId: replacement.id }
      });
    }

    return {
      outcome: "replaced" as const,
      name: replacement.name,
      serviceStyle
    };
  });
}
