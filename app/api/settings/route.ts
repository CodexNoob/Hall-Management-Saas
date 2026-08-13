import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { countSchema } from "@/lib/validation/number";

const settingsSchema = z.object({
  language: z.enum(["en-US", "en-GB", "he-IL", "es-US"]).optional(),
  timezone: z.string().trim().min(1).optional(),
  twoFactorRequired: z.boolean().optional(),
  sessionTimeoutMinutes: countSchema({
    min: 5,
    max: 1440,
    label: "Session timeout"
  }).optional(),
  dailyEventLimit: countSchema({
    min: 1,
    max: 50,
    label: "Daily event limit"
  }).optional(),
  emailNotifications: z.boolean().optional(),
  eventConfirmations: z.boolean().optional(),
  billingAlerts: z.boolean().optional(),
  systemAnnouncements: z.boolean().optional(),
  billing: z
    .object({
      businessName: z.string().trim().min(1).max(200),
      paymentTerms: z.string().trim().min(1).max(100),
      invoiceFooter: z.string().trim().max(2000)
    })
    .optional()
});

function calendarSettingsFromIntegrations(integrations: unknown) {
  if (
    integrations &&
    typeof integrations === "object" &&
    "calendar" in integrations
  ) {
    const calendar = (integrations as { calendar?: unknown }).calendar;
    if (calendar && typeof calendar === "object") {
      const dailyEventLimit = (calendar as { dailyEventLimit?: unknown })
        .dailyEventLimit;
      if (
        typeof dailyEventLimit === "number" &&
        Number.isFinite(dailyEventLimit)
      ) {
        return { dailyEventLimit };
      }
    }
  }

  return { dailyEventLimit: 2 };
}

function mergeCalendarSettings(
  integrations: unknown,
  dailyEventLimit: number | undefined
): Prisma.InputJsonValue | undefined {
  if (dailyEventLimit === undefined) return undefined;
  const base =
    integrations && typeof integrations === "object"
      ? { ...(integrations as Record<string, unknown>) }
      : {};
  const calendar =
    base.calendar && typeof base.calendar === "object"
      ? { ...(base.calendar as Record<string, unknown>) }
      : {};

  return {
    ...base,
    calendar: {
      ...calendar,
      dailyEventLimit
    }
  };
}

function mergeBillingSettings(
  integrations: unknown,
  billing: z.infer<typeof settingsSchema>["billing"]
): Prisma.InputJsonValue | undefined {
  if (!billing) return undefined;
  const base =
    integrations && typeof integrations === "object"
      ? { ...(integrations as Record<string, unknown>) }
      : {};
  return { ...base, billing } as Prisma.InputJsonValue;
}

export async function GET(request: Request) {
  try {
    const actor = await requirePermission(request, "canViewSettings");
    const [organization, settings, notifications] = await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: actor.organizationId }
      }),
      prisma.organizationSetting.upsert({
        where: { organizationId: actor.organizationId },
        update: {},
        create: { organizationId: actor.organizationId }
      }),
      prisma.notificationPreference.upsert({
        where: {
          organizationId_userId: {
            organizationId: actor.organizationId,
            userId: actor.id
          }
        },
        update: {},
        create: { organizationId: actor.organizationId, userId: actor.id }
      })
    ]);

    return NextResponse.json({
      organization,
      settings: {
        ...settings,
        calendar: calendarSettingsFromIntegrations(settings.integrations)
      },
      notifications
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requirePermission(request, "canViewSettings");
    const input = settingsSchema.parse(await request.json());
    if (
      input.language !== undefined ||
      input.timezone !== undefined ||
      input.twoFactorRequired !== undefined ||
      input.sessionTimeoutMinutes !== undefined ||
      input.dailyEventLimit !== undefined ||
      input.billing !== undefined
    ) {
      await requirePermission(request, "canEditSettings");
    }
    const currentSettings = await prisma.organizationSetting.upsert({
      where: { organizationId: actor.organizationId },
      update: {},
      create: { organizationId: actor.organizationId }
    });
    const organizationChanges = {
      language: input.language,
      timezone: input.timezone,
      twoFactorRequired: input.twoFactorRequired,
      sessionTimeoutMinutes: input.sessionTimeoutMinutes,
      integrations:
        mergeBillingSettings(
          mergeCalendarSettings(
            currentSettings.integrations,
            input.dailyEventLimit
          ) ?? currentSettings.integrations,
          input.billing
        ) ??
        mergeCalendarSettings(
          currentSettings.integrations,
          input.dailyEventLimit
        )
    };
    const notificationChanges = {
      emailNotifications: input.emailNotifications,
      eventConfirmations: input.eventConfirmations,
      billingAlerts: input.billingAlerts,
      systemAnnouncements: input.systemAnnouncements
    };

    const [settings, notifications] = await prisma.$transaction([
      prisma.organizationSetting.upsert({
        where: { organizationId: actor.organizationId },
        update: organizationChanges,
        create: { organizationId: actor.organizationId, ...organizationChanges }
      }),
      prisma.notificationPreference.upsert({
        where: {
          organizationId_userId: {
            organizationId: actor.organizationId,
            userId: actor.id
          }
        },
        update: notificationChanges,
        create: {
          organizationId: actor.organizationId,
          userId: actor.id,
          ...notificationChanges
        }
      })
    ]);

    return NextResponse.json({
      settings: {
        ...settings,
        calendar: calendarSettingsFromIntegrations(settings.integrations)
      },
      notifications
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
