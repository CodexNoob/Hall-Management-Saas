import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { countSchema } from "@/lib/validation/number";

// The portal shows this link to clients, so an empty string is a meaningful
// value: it clears the link and hides the Pay balance action rather than
// leaving a stale merchant configured.
const paymentLinkSchema = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) => value === "" || z.string().url().safeParse(value).success,
    "Payment link must be a valid URL."
  );

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
    .optional(),
  payments: z
    .object({
      paymentLink: paymentLinkSchema
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
    const [organization, settings, notifications, paymentSetting] =
      await Promise.all([
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
        }),
        prisma.paymentSetting.findUnique({
          where: { organizationId: actor.organizationId },
          select: { paymentLink: true }
        })
      ]);

    return NextResponse.json({
      organization,
      settings: {
        ...settings,
        calendar: calendarSettingsFromIntegrations(settings.integrations)
      },
      notifications,
      payments: { paymentLink: paymentSetting?.paymentLink ?? "" }
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
    // Changing where client payments land is a money decision, not a general
    // settings edit, so it needs the dedicated payments permission.
    if (input.payments !== undefined) {
      await requirePermission(request, "canManagePayments");
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

    const { settings, notifications } = await prisma.$transaction(
      async (transaction) => {
        const settings = await transaction.organizationSetting.upsert({
          where: { organizationId: actor.organizationId },
          update: organizationChanges,
          create: {
            organizationId: actor.organizationId,
            ...organizationChanges
          }
        });

        if (input.dailyEventLimit !== undefined) {
          await transaction.hall.updateMany({
            where: { organizationId: actor.organizationId },
            data: { dailyEventLimit: input.dailyEventLimit }
          });
        }

        const notifications = await transaction.notificationPreference.upsert({
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
        });

        return { settings, notifications };
      }
    );
    const payments =
      input.payments !== undefined
        ? await prisma.paymentSetting.upsert({
            where: { organizationId: actor.organizationId },
            update: { paymentLink: input.payments.paymentLink },
            create: {
              organizationId: actor.organizationId,
              paymentLink: input.payments.paymentLink
            },
            select: { paymentLink: true }
          })
        : await prisma.paymentSetting.findUnique({
            where: { organizationId: actor.organizationId },
            select: { paymentLink: true }
          });

    return NextResponse.json({
      settings: {
        ...settings,
        calendar: calendarSettingsFromIntegrations(settings.integrations)
      },
      notifications,
      payments: { paymentLink: payments?.paymentLink ?? "" }
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
