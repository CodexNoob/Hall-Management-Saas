import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    kitchenItemStatus: { findMany: vi.fn() },
    kitchenNotification: { findMany: vi.fn() }
  }
}));

import {
  listKitchenNotifications,
  listKitchenNotificationsForEvent
} from "@/features/kitchen/server/kitchen-notifications";
import { WHOLE_KITCHEN } from "@/features/kitchen/server/kitchen-visibility";
import { prisma } from "@/lib/prisma";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const workerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const eventId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  notificationType: "MENU_CHANGED",
  message: "The menu changed.",
  eventDate: new Date("2026-08-28T00:00:00.000Z"),
  hallOrRoom: "Main Hall",
  eventType: "Wedding",
  oldValue: null,
  newValue: null,
  requiresAcknowledgment: true,
  acknowledgedAt: null,
  emailSent: false,
  emailSentAt: null,
  createdAt: new Date("2026-08-27T10:00:00.000Z"),
  event: { clientName: "Client", eventType: "Wedding" },
  changedBy: { name: "Manager", email: "manager@example.com" },
  acknowledgedBy: null
};

/**
 * The feed answers to `KitchenVisibility` like every other kitchen surface.
 *
 * A cook is shown the events they are cooking on and nothing else; before this
 * the notification list was scoped by organization alone, so a cook read the
 * client names, halls and changes for events their own board deliberately
 * withheld from them - and the bell counted those events too.
 */
describe("kitchen notification scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.kitchenNotification.findMany).mockResolvedValue([
      row
    ] as never);
  });

  it("sends the whole organization's feed to an unrestricted caller", async () => {
    const notifications = await listKitchenNotifications(
      organizationId,
      WHOLE_KITCHEN
    );

    expect(prisma.kitchenItemStatus.findMany).not.toHaveBeenCalled();
    expect(prisma.kitchenNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId } })
    );
    expect(notifications).toHaveLength(1);
  });

  it("restricts a cook to the events they are assigned a dish on", async () => {
    vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([
      { eventId, menuItem: { name: "Roast chicken" } }
    ] as never);

    await listKitchenNotifications(organizationId, {
      seesWholeBoard: false,
      workerId
    });

    expect(prisma.kitchenItemStatus.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId, assignedWorkerId: workerId }
      })
    );
    expect(prisma.kitchenNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId, eventId: { in: [eventId] } }
      })
    );
  });

  it("sends a cook with no dishes nothing at all", async () => {
    vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([] as never);

    await expect(
      listKitchenNotifications(organizationId, {
        seesWholeBoard: false,
        workerId
      })
    ).resolves.toEqual([]);
    expect(prisma.kitchenNotification.findMany).not.toHaveBeenCalled();
  });

  // Not on the roster and without the key: the safe direction, and the same one
  // `visibleKitchenLines` takes for dishes.
  it("sends a scoped caller with no worker row nothing at all", async () => {
    await expect(
      listKitchenNotifications(organizationId, {
        seesWholeBoard: false,
        workerId: null
      })
    ).resolves.toEqual([]);
    expect(prisma.kitchenItemStatus.findMany).not.toHaveBeenCalled();
    expect(prisma.kitchenNotification.findMany).not.toHaveBeenCalled();
  });

  // Within an event that is theirs, the dish list is still somebody else's work
  // for the most part. The cook's copy carries their own dishes and a count of
  // the rest, so a shortened list never reads as a smaller night.
  describe("the dish list on a cook's copy", () => {
    const withItems = (
      items: Array<{ item: string; type: string; serviceStyle: string }>
    ) => ({
      ...row,
      eventId,
      newValue: { status: "Confirmed", meal: "Main", items }
    });

    beforeEach(() => {
      vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([
        { eventId, menuItem: { name: "Roast chicken" } }
      ] as never);
    });

    it("keeps their own dishes and counts the rest", async () => {
      vi.mocked(prisma.kitchenNotification.findMany).mockResolvedValue([
        withItems([
          { item: "Roast chicken", type: "Dish", serviceStyle: "Plated" },
          { item: "Rice pilaf", type: "Dish", serviceStyle: "Buffet" },
          { item: "Salmon", type: "Dish", serviceStyle: "Plated" }
        ])
      ] as never);

      const [notification] = await listKitchenNotifications(organizationId, {
        seesWholeBoard: false,
        workerId
      });

      expect(
        notification.changeSummary?.items.map((item) => item.name)
      ).toEqual(["Roast chicken"]);
      expect(notification.changeSummary?.otherItemCount).toBe(2);
    });

    // Add-ons carry no assignment and are part of what the kitchen puts out
    // whoever is on them, exactly as `visibleKitchenLines` treats them.
    it("keeps add-ons, which are nobody's in particular", async () => {
      vi.mocked(prisma.kitchenNotification.findMany).mockResolvedValue([
        withItems([
          { item: "Sushi station", type: "AddOn", serviceStyle: "None" },
          { item: "Rice pilaf", type: "Dish", serviceStyle: "Buffet" }
        ])
      ] as never);

      const [notification] = await listKitchenNotifications(organizationId, {
        seesWholeBoard: false,
        workerId
      });

      expect(
        notification.changeSummary?.items.map((item) => item.name)
      ).toEqual(["Sushi station"]);
      expect(notification.changeSummary?.otherItemCount).toBe(1);
    });

    it("leaves a supervisor's list whole and unannotated", async () => {
      vi.mocked(prisma.kitchenNotification.findMany).mockResolvedValue([
        withItems([
          { item: "Roast chicken", type: "Dish", serviceStyle: "Plated" },
          { item: "Rice pilaf", type: "Dish", serviceStyle: "Buffet" }
        ])
      ] as never);

      const [notification] = await listKitchenNotifications(
        organizationId,
        WHOLE_KITCHEN
      );

      expect(notification.changeSummary?.items).toHaveLength(2);
      expect(notification.changeSummary?.otherItemCount).toBeUndefined();
    });
  });

  // The details dialog is the other way into the same rows. A restriction that
  // held on the board but not here would be no restriction at all.
  it("applies the same rule to one event's feed", async () => {
    vi.mocked(prisma.kitchenItemStatus.findMany).mockResolvedValue([] as never);

    await expect(
      listKitchenNotificationsForEvent({
        eventId,
        organizationId,
        visibility: { seesWholeBoard: false, workerId }
      })
    ).resolves.toEqual([]);
    expect(prisma.kitchenNotification.findMany).not.toHaveBeenCalled();
  });
});
