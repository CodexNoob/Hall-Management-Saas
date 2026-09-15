import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { KitchenVisibility } from "@/features/kitchen/server/kitchen-visibility";

/**
 * What `valueToText` returns for a value that is not there.
 *
 * Named rather than written out at each comparison. Seven of those comparisons
 * had been saved through a Latin-1 round trip at some point and were testing
 * against the mojibake form of this dash, so every one of them was dead: a
 * nameless item was never dropped from a change list, and a dish with no
 * service style was drawn with a dash where the style should be. One constant
 * cannot drift away from itself.
 */
const NO_VALUE = "—";

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
  if (value === null || value === undefined) return NO_VALUE;
  if (typeof value === "string") return value || NO_VALUE;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(valueToText).join(", ") || NO_VALUE;

  const record = value as Record<string, Prisma.JsonValue>;
  if ("status" in record || "items" in record) {
    const status = valueToText(record.status);
    const meal = valueToText(record.meal);
    const headline =
      status !== NO_VALUE
        ? `${status}${meal !== NO_VALUE ? ` menu (${meal})` : " menu"}`
        : meal !== NO_VALUE
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

            return `- ${name}${type !== NO_VALUE ? ` (${type})` : ""}${
              serviceStyle !== NO_VALUE && serviceStyle !== "None"
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
    if (name === NO_VALUE) return [];

    const serviceStyle = valueToText(item.serviceStyle);

    return [
      {
        name,
        type: valueToText(item.type),
        serviceStyle:
          serviceStyle === NO_VALUE || serviceStyle === "None"
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
    hall: notification.hallOrRoom ?? NO_VALUE,
    date: notification.eventDate
      ? dateFormat.format(notification.eventDate)
      : NO_VALUE,
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

/**
 * How many notifications the feed carries at once.
 *
 * A cap rather than paging, because the drawer is a "what changed while I was
 * away" list rather than an archive. One row beyond it is read on purpose, so
 * the answer to "is this everything" is a fact rather than a guess made from
 * the list happening to be exactly full.
 */
export const KITCHEN_NOTIFICATION_LIMIT = 50;

export async function listKitchenNotifications(
  organizationId: string,
  visibility: KitchenVisibility
) {
  const audience = await resolveKitchenNotificationAudience(
    organizationId,
    visibility
  );
  if (!audience) return { notifications: [], hasMore: false };

  const rows = await prisma.kitchenNotification.findMany({
    where: { organizationId, ...audience.where },
    orderBy: { createdAt: "desc" },
    select: kitchenNotificationSelect,
    take: KITCHEN_NOTIFICATION_LIMIT + 1
  });

  return {
    notifications: rows
      .slice(0, KITCHEN_NOTIFICATION_LIMIT)
      .map((row) => presentForAudience(row, audience)),
    hasMore: rows.length > KITCHEN_NOTIFICATION_LIMIT
  };
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
/**
 * How many of one event's notifications the Kitchen tab carries.
 *
 * Lower than the board's feed because this is one event's history rather than
 * the organization's, and read one row beyond for the same reason: a panel that
 * says "20 notifications sent" while a booking has had thirty is not reporting
 * a smaller number, it is reporting a wrong one.
 */
export const KITCHEN_EVENT_NOTIFICATION_LIMIT = 20;

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
  if (!audience) return { notifications: [], hasMore: false };

  const rows = await prisma.kitchenNotification.findMany({
    where: { eventId, organizationId, ...audience.where },
    orderBy: { createdAt: "desc" },
    select: kitchenNotificationSelect,
    take: KITCHEN_EVENT_NOTIFICATION_LIMIT + 1
  });

  return {
    notifications: rows
      .slice(0, KITCHEN_EVENT_NOTIFICATION_LIMIT)
      .map((row) => presentForAudience(row, audience)),
    hasMore: rows.length > KITCHEN_EVENT_NOTIFICATION_LIMIT
  };
}

export async function createMenuChangedKitchenNotification({
  organizationId,
  eventId,
  eventType,
  eventDate,
  hallOrRoom,
  changedById,
  oldValue,
  newValue,
  message,
  requiresAcknowledgment = true
}: {
  organizationId: string;
  eventId: string;
  eventType: string | null;
  eventDate: Date | null;
  hallOrRoom: string | null;
  changedById: string;
  oldValue: Prisma.InputJsonValue;
  newValue: Prisma.InputJsonValue;
  /**
   * Overrides the default wording. The office changing a menu and the kitchen
   * swapping a dish on its own board are the same fact to everyone reading the
   * feed later, but they read differently in the moment, and "Menu was changed"
   * against a swap the kitchen itself just made is confusing rather than
   * informative.
   */
  message?: string;
  /**
   * Whether somebody has to tick this off.
   *
   * True for a change made somewhere else, which is the whole point of the
   * feed: the kitchen has to be able to prove it saw it. False when the kitchen
   * is the one who made the change - asking a cook to acknowledge their own
   * decision trains people to clear the badge without reading it, which is
   * exactly how the acknowledgement stops meaning anything.
   */
  requiresAcknowledgment?: boolean;
}) {
  await prisma.kitchenNotification.create({
    data: {
      organizationId,
      eventId,
      notificationType: "MENU_CHANGED",
      eventDate,
      hallOrRoom,
      eventType,
      message: message ?? `Menu was changed for ${eventType ?? "event"}`,
      oldValue,
      newValue,
      changedById,
      requiresAcknowledgment
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
      oldValue: NO_VALUE,
      newValue: `${eventDate.toISOString().slice(0, 10)} (${daysAway} days away)`,
      changedById
    }
  });
}
