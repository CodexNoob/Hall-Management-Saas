import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

const valueToText = (
  value: Prisma.JsonValue | null | undefined
): string => {
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
      !notification.requiresAcknowledgment || Boolean(notification.acknowledgedAt),
    acknowledgedBy,
    acknowledgedAt: notification.acknowledgedAt
      ? dateTimeFormat.format(notification.acknowledgedAt)
      : undefined,
    emailSent: notification.emailSentAt
      ? `Email sent ${dateTimeFormat.format(notification.emailSentAt)}`
      : notification.emailSent
        ? "Email sent"
        : undefined,
    changeSummary: parseChangeSummary(notification.oldValue, notification.newValue)
  };
}

export async function listKitchenNotifications(organizationId: string) {
  const rows = await prisma.kitchenNotification.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: kitchenNotificationSelect,
    take: 50
  });

  return rows.map(presentKitchenNotification);
}

export async function listKitchenNotificationsForEvent({
  eventId,
  organizationId
}: {
  eventId: string;
  organizationId: string;
}) {
  const rows = await prisma.kitchenNotification.findMany({
    where: { eventId, organizationId },
    orderBy: { createdAt: "desc" },
    select: kitchenNotificationSelect,
    take: 20
  });

  return rows.map(presentKitchenNotification);
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
