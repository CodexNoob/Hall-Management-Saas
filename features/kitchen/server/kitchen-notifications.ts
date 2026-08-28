import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { KitchenVisibility } from "@/features/kitchen/server/kitchen-visibility";

const SHORT_NOTICE_DAYS = 5;

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC"
});

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit"
});

const valueToText = (value: Prisma.JsonValue | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(valueToText).join(", ") || "—";

  const record = value as Record<string, Prisma.JsonValue>;
  if ("status" in record || "items" in record) {
    const status = valueToText(record.status);
    const meal = valueToText(record.meal);
    const headline =
      status !== "â€”"
        ? `${status}${meal !== "â€”" ? ` menu (${meal})` : " menu"}`
        : meal !== "â€”"
          ? `${meal} menu`
          : null;
    const items = Array.isArray(record.items)
      ? record.items
          .map((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
              return valueToText(entry);
            }

            const item = entry as Record<string, Prisma.JsonValue>;
            const name = valueToText(item.item);
            const type = valueToText(item.type);
            const serviceStyle = valueToText(item.serviceStyle);

            return `- ${name}${type !== "â€”" ? ` (${type})` : ""}${
              serviceStyle !== "â€”" && serviceStyle !== "None"
                ? ` - ${serviceStyle}`
                : ""
            }`;
          })
          .join("\n")
      : "";

    return [headline, items ? `Menu items:\n${items}` : null]
      .filter((part): part is string => Boolean(part))
      .join("\n");
  }

  return Object.entries(record)
    .map(([key, entry]) => `${key}: ${valueToText(entry)}`)
    .join(", ");
};

type KitchenNotificationChangeItem = {
  name: string;
  type: string;
  serviceStyle: string | null;
};

type KitchenNotificationChangeSummary = {
  beforeStatus?: string;
  afterStatus?: string;
  meal?: string;
  items: KitchenNotificationChangeItem[];
  /**
   * How many dishes on this event were left out of `items`.
   *
   * Set only for a cook, whose list is narrowed to their own dishes. Sent so
   * the card can say how much bigger the event is than the part that is theirs:
   * a silently shortened list would misrepresent the size of the night, which
   * is exactly what somebody reads a menu change to judge. Absent for a
   * supervisor, whose list is the whole menu already.
   */
  otherItemCount?: number;
};

const parseChangeSummary = (
  oldValue: Prisma.JsonValue | null | undefined,
  newValue: Prisma.JsonValue | null | undefined
): KitchenNotificationChangeSummary | undefined => {
  const oldRecord =
    oldValue && typeof oldValue === "object" && !Array.isArray(oldValue)
      ? (oldValue as Record<string, Prisma.JsonValue>)
      : null;
  const newRecord =
    newValue && typeof newValue === "object" && !Array.isArray(newValue)
      ? (newValue as Record<string, Prisma.JsonValue>)
      : null;

  if (!oldRecord && !newRecord) return undefined;

  const rawItems = Array.isArray(newRecord?.items) ? newRecord.items : [];
  const items = rawItems.flatMap((entry): KitchenNotificationChangeItem[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];

    const item = entry as Record<string, Prisma.JsonValue>;
    const name = valueToText(item.item);
    if (name === "â€”") return [];

    const serviceStyle = valueToText(item.serviceStyle);

    return [
      {
        name,
        type: valueToText(item.type),
        serviceStyle:
          serviceStyle === "â€”" || serviceStyle === "None"
            ? null
            : serviceStyle
      }
    ];
  });

  return {
    beforeStatus: oldRecord?.status ? valueToText(oldRecord.status) : undefined,
    afterStatus: newRecord?.status ? valueToText(newRecord.status) : undefined,
    meal: newRecord?.meal
      ? valueToText(newRecord.meal)
      : oldRecord?.meal
        ? valueToText(oldRecord.meal)
        : undefined,
    items
  };
};

export type PresentedKitchenNotification = {
  id: string;
  title: string;
  description: string;
  event: string;
  hall: string;
  date: string;
  oldValue: string;
  newValue: string;
  by: string;
  when: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  emailSent?: string;
  changeSummary?: KitchenNotificationChangeSummary;
};

export const kitchenNotificationSelect = {
  id: true,
  // Not presented - the grouping key for narrowing a cook's dish list to the
  // dishes they are assigned on this particular event.
  eventId: true,
  notificationType: true,
  eventDate: true,
  hallOrRoom: true,
  eventType: true,
  message: true,
  oldValue: true,
  newValue: true,
  requiresAcknowledgment: true,
  acknowledgedAt: true,
  emailSent: true,
  emailSentAt: true,
  createdAt: true,
  changedBy: { select: { name: true, email: true } },
  acknowledgedBy: { select: { name: true, email: true } },
  event: { select: { clientName: true, eventType: true } }
} satisfies Prisma.KitchenNotificationSelect;

export type KitchenNotificationRow = Prisma.KitchenNotificationGetPayload<{
  select: typeof kitchenNotificationSelect;
}>;

export function presentKitchenNotification(
  notification: KitchenNotificationRow
): PresentedKitchenNotification {
  const title =
    notification.notificationType === "SUDDEN_EVENT"
      ? "Sudden Event"
      : notification.notificationType === "MENU_CHANGED"
        ? "Menu Changed"
        : notification.notificationType;
  const eventTitle =
    notification.event?.eventType ||
    notification.eventType ||
    notification.event?.clientName ||
    "Kitchen event";
  const changedBy =
    notification.changedBy?.name || notification.changedBy?.email || "Staff";
  const acknowledgedBy =
    notification.acknowledgedBy?.name || notification.acknowledgedBy?.email;

  return {
    id: notification.id,
    title,
    description: notification.message,
    event: eventTitle,
    hall: notification.hallOrRoom ?? "—",
    date: notification.eventDate
      ? dateFormat.format(notification.eventDate)
      : "—",
    oldValue: valueToText(notification.oldValue),
    newValue: valueToText(notification.newValue),
    by: changedBy,
    when: dateTimeFormat.format(notification.createdAt),
    acknowledged:
      !notification.requiresAcknowledgment ||
      Boolean(notification.acknowledgedAt),
    acknowledgedBy,
    acknowledgedAt: notification.acknowledgedAt
      ? dateTimeFormat.format(notification.acknowledgedAt)
      : undefined,
    emailSent: notification.emailSentAt
      ? `Email sent ${dateTimeFormat.format(notification.emailSentAt)}`
      : notification.emailSent
        ? "Email sent"
        : undefined,
    changeSummary: parseChangeSummary(
      notification.oldValue,
      notification.newValue
    )
  };
}

/**
 * Which notifications one caller may be sent.
 *
 * The same rule the sheet already applies to dishes, asked of the feed: an
 * unrestricted caller reads the organization's notifications, and a scoped cook
 * reads only those about events they are actually cooking on. Until this
 * existed the feed was the one kitchen surface that ignored
 * `KitchenVisibility` entirely, so a cook whose board deliberately withheld an
 * event was still told the client's name, the hall and the change made to it -
 * and the bell counted it.
 *
 * `null` means "none at all", which is a different answer from "no filter" and
 * has to stay distinguishable: an empty `{ eventId: { in: [] } }` would read as
 * the whole organization if a caller spread it into a `where` by mistake.
 *
 * Assignment is per dish (`KitchenItemStatus`), so the events are derived
 * rather than stored. A dish assigned to nobody belongs to nobody - claiming it
 * is `kitchen.worker.assign`, which a cook does not hold - so it does not widen
 * this set.
 */
export type KitchenNotificationAudience = {
  where: Prisma.KitchenNotificationWhereInput;
  /**
   * The dishes this caller is cooking, per event, or null for a caller who is
   * sent every dish anyway. Read to narrow each notification's list to the part
   * that is theirs.
   */
  ownDishNamesByEventId: Map<string, Set<string>> | null;
};

export async function resolveKitchenNotificationAudience(
  organizationId: string,
  visibility: KitchenVisibility
): Promise<KitchenNotificationAudience | null> {
  if (visibility.seesWholeBoard) {
    return { where: {}, ownDishNamesByEventId: null };
  }
  if (!visibility.workerId) return null;

  const assignments = await prisma.kitchenItemStatus.findMany({
    where: { organizationId, assignedWorkerId: visibility.workerId },
    select: { eventId: true, menuItem: { select: { name: true } } }
  });

  if (assignments.length === 0) return null;

  const ownDishNamesByEventId = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    const names =
      ownDishNamesByEventId.get(assignment.eventId) ?? new Set<string>();
    names.add(assignment.menuItem.name);
    ownDishNamesByEventId.set(assignment.eventId, names);
  }

  return {
    where: { eventId: { in: [...ownDishNamesByEventId.keys()] } },
    ownDishNamesByEventId
  };
}

/**
 * Narrows one notification's dish list to the dishes the reader is cooking.
 *
 * By name, because that is what the change was recorded as: the summary is a
 * snapshot of the menu written when it was confirmed, and it carries dish names
 * rather than ids. Assignments are per dish and per event, so the set handed in
 * is the one for this notification's event and no other.
 *
 * Add-ons stay whoever is reading. They carry no assignment - `visibleKitchenLines`
 * already rides them along for every rostered cook, because they are part of
 * what the kitchen puts out and nobody is named on them.
 */
export function narrowNotificationToOwnDishes(
  notification: PresentedKitchenNotification,
  ownDishNames: ReadonlySet<string>
): PresentedKitchenNotification {
  if (!notification.changeSummary) return notification;

  const { items } = notification.changeSummary;
  const own = items.filter(
    (item) => item.type === "AddOn" || ownDishNames.has(item.name)
  );

  return {
    ...notification,
    changeSummary: {
      ...notification.changeSummary,
      items: own,
      otherItemCount: items.length - own.length
    }
  };
}

export async function listKitchenNotifications(
  organizationId: string,
  visibility: KitchenVisibility
) {
  const audience = await resolveKitchenNotificationAudience(
    organizationId,
    visibility
  );
  if (!audience) return [];

  const rows = await prisma.kitchenNotification.findMany({
    where: { organizationId, ...audience.where },
    orderBy: { createdAt: "desc" },
    select: kitchenNotificationSelect,
    take: 50
  });

  return rows.map((row) => presentForAudience(row, audience));
}

function presentForAudience(
  row: KitchenNotificationRow,
  audience: KitchenNotificationAudience
) {
  const presented = presentKitchenNotification(row);
  if (!audience.ownDishNamesByEventId) return presented;

  return narrowNotificationToOwnDishes(
    presented,
    (row.eventId
      ? audience.ownDishNamesByEventId.get(row.eventId)
      : undefined) ?? new Set<string>()
  );
}

/**
 * One event's notifications.
 *
 * The details dialog is the second way into the same rows, so it asks the same
 * question - a cook who is on no dish of this event is told about none of its
 * changes, exactly as the board withholds the card itself.
 */
export async function listKitchenNotificationsForEvent({
  eventId,
  organizationId,
  visibility
}: {
  eventId: string;
  organizationId: string;
  visibility: KitchenVisibility;
}) {
  const audience = await resolveKitchenNotificationAudience(
    organizationId,
    visibility
  );
  if (!audience) return [];

  const rows = await prisma.kitchenNotification.findMany({
    where: { eventId, organizationId, ...audience.where },
    orderBy: { createdAt: "desc" },
    select: kitchenNotificationSelect,
    take: 20
  });

  return rows.map((row) => presentForAudience(row, audience));
}

export async function createMenuChangedKitchenNotification({
  organizationId,
  eventId,
  eventType,
  eventDate,
  hallOrRoom,
  changedById,
  oldValue,
  newValue
}: {
  organizationId: string;
  eventId: string;
  eventType: string | null;
  eventDate: Date | null;
  hallOrRoom: string | null;
  changedById: string;
  oldValue: Prisma.InputJsonValue;
  newValue: Prisma.InputJsonValue;
}) {
  await prisma.kitchenNotification.create({
    data: {
      organizationId,
      eventId,
      notificationType: "MENU_CHANGED",
      eventDate,
      hallOrRoom,
      eventType,
      message: `Menu was changed for ${eventType ?? "event"}`,
      oldValue,
      newValue,
      changedById
    }
  });
}

export async function createShortNoticeKitchenNotification({
  organizationId,
  eventId,
  eventType,
  eventDate,
  hallOrRoom,
  changedById,
  now = new Date()
}: {
  organizationId: string;
  eventId: string;
  eventType: string | null;
  eventDate: Date | null;
  hallOrRoom: string | null;
  changedById: string;
  now?: Date;
}) {
  if (!eventDate) return;

  const daysAway = Math.ceil(
    (eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (daysAway < 0 || daysAway > SHORT_NOTICE_DAYS) return;

  await prisma.kitchenNotification.create({
    data: {
      organizationId,
      eventId,
      notificationType: "SUDDEN_EVENT",
      eventDate,
      hallOrRoom,
      eventType,
      message: `New event booked with short notice (within ${SHORT_NOTICE_DAYS} days): ${eventType ?? "event"} on ${eventDate.toISOString().slice(0, 10)}`,
      oldValue: "—",
      newValue: `${eventDate.toISOString().slice(0, 10)} (${daysAway} days away)`,
      changedById
    }
  });
}
