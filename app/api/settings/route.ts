import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const settingsSchema = z.object({
  language: z.enum(["en-US", "en-GB", "he-IL", "es-US"]).optional(),
  timezone: z.string().trim().min(1).optional(),
  twoFactorRequired: z.boolean().optional(),
  sessionTimeoutMinutes: z.number().int().min(5).max(1440).optional(),
  emailNotifications: z.boolean().optional(),
  eventConfirmations: z.boolean().optional(),
  billingAlerts: z.boolean().optional(),
  systemAnnouncements: z.boolean().optional()
});

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

    return NextResponse.json({ organization, settings, notifications });
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
      input.sessionTimeoutMinutes !== undefined
    ) {
      await requirePermission(request, "canEditSettings");
    }
    const organizationChanges = {
      language: input.language,
      timezone: input.timezone,
      twoFactorRequired: input.twoFactorRequired,
      sessionTimeoutMinutes: input.sessionTimeoutMinutes
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

    return NextResponse.json({ settings, notifications });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
