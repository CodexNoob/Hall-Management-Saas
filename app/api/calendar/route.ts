import { NextResponse } from "next/server";
import { z } from "zod";

import { authorize, scoped, tenant } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const rangeSchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date()
});

/**
 * The Settings > Calendar preferences the calendar draws itself from.
 *
 * They are written by /api/settings into `integrations.controlCenter.calendar`
 * and read here rather than fetched separately, so the calendar does not render
 * a Sunday-start grid for a moment before a second request tells it otherwise.
 * Anything missing or malformed falls back to the shipped default: an
 * organization that has never opened Settings still gets a working calendar.
 *
 * The two display toggles default to on and `clickAnywhereToAdd` to off, which
 * is what /api/settings writes into a settings document it creates - reading a
 * missing value as anything else would show an organization a calendar its own
 * Settings page disagrees with.
 */
function calendarDisplayFromIntegrations(integrations: unknown) {
  const calendar =
    integrations &&
    typeof integrations === "object" &&
    "controlCenter" in integrations
      ? (
          (integrations as { controlCenter?: { calendar?: unknown } })
            .controlCenter ?? {}
        ).calendar
      : undefined;

  const preference = <Key extends string>(key: Key): unknown =>
    calendar && typeof calendar === "object"
      ? (calendar as Record<string, unknown>)[key]
      : undefined;

  const weekStartsOn = preference("weekStartsOn");
  const defaultView = preference("defaultView");

  return {
    defaultView:
      defaultView === "week" || defaultView === "agenda"
        ? defaultView
        : ("month" as const),
    weekStartsOn:
      weekStartsOn === "monday" ||
      weekStartsOn === "saturday" ||
      weekStartsOn === "sunday"
        ? weekStartsOn
        : ("sunday" as const),
    showHebrewDate: preference("showHebrewDate") !== false,
    showAvailability: preference("showAvailability") !== false,
    clickAnywhereToAdd: preference("clickAnywhereToAdd") === true
  };
}

function dailyEventLimitFromIntegrations(integrations: unknown) {
  if (
    integrations &&
    typeof integrations === "object" &&
    "calendar" in integrations
  ) {
    const calendar = (integrations as { calendar?: unknown }).calendar;
    if (calendar && typeof calendar === "object") {
      const value = (calendar as { dailyEventLimit?: unknown }).dailyEventLimit;
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
  }
  return 2;
}

export async function GET(request: Request) {
  try {
    const actor = await authorize(request, "calendar.read");
    const url = new URL(request.url);
    const range = rangeSchema.parse({
      startDate: url.searchParams.get("startDate"),
      endDate: url.searchParams.get("endDate")
    });
    const startDate = new Date(`${range.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${range.endDate}T00:00:00.000Z`);
    if (endDate < startDate) throw new z.ZodError([]);

    const [events, halls, eventTypes, settings, blockedDates] =
      await Promise.all([
        prisma.event.findMany({
          where: {
            ...tenant(actor),
            deleted: false,
            ...scoped(actor, "hall"),
            bookingStatus: { in: ["CONFIRMED", "TENTATIVE_HOLD", "COMPLETED"] },
            eventDate: { gte: startDate, lte: endDate }
          },
          orderBy: [{ eventDate: "asc" }, { startsAt: "asc" }],
          select: {
            id: true,
            clientName: true,
            eventDate: true,
            eventStatus: true,
            bookingStatus: true,
            eventType: true,
            packageName: true,
            hall: { select: { id: true, name: true, color: true } }
          }
        }),
        prisma.hall.findMany({
          where: {
            ...tenant(actor),
            isActive: true,
            isBookable: true,
            ...scoped(actor, "hall", { field: "id" })
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, color: true, dailyEventLimit: true }
        }),
        prisma.eventType.findMany({
          where: { ...tenant(actor), isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true }
        }),
        prisma.organizationSetting.upsert({
          where: { ...tenant(actor) },
          update: {},
          create: { organizationId: actor.organizationId },
          select: { integrations: true }
        }),
        prisma.holidayBlockedDate.findMany({
          where: {
            ...tenant(actor),
            isBlocked: true
          },
          orderBy: [{ startDate: "asc" }, { endDate: "asc" }]
        })
      ]);

    return NextResponse.json({
      events,
      halls,
      eventTypes,
      blockedDates,
      calendarSettings: {
        dailyEventLimit: dailyEventLimitFromIntegrations(settings.integrations),
        ...calendarDisplayFromIntegrations(settings.integrations)
      }
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
