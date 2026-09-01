import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  discardOrganizationBrandingImage,
  readBrandingPathError
} from "@/features/settings/server/organization-branding";
import {
  assertPermission,
  authorize,
  requireUserActor,
  tenant
} from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PORTAL_HEADER_COLOR,
  isPortalHeaderColor
} from "@/lib/ui/portal-header-theme";
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
  organizationName: z.string().trim().min(1).max(200).optional(),
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
  controlCenter: z
    .object({
      general: z.object({
        // A storage path, not a URL: the logo lives in a private bucket and is
        // read back through a short-lived signed URL. Defaulted so a settings
        // document written before the uploader existed still parses - see the
        // note on `clickAnywhereToAdd` below for what a missing default costs.
        logoPath: z.string().trim().max(512).default(""),
        // Defaulted as a whole and field by field: an organization that saved
        // its settings before the portal header was configurable has no
        // `portalHeader` at all, and this parse is what every read of the
        // document goes through.
        portalHeader: z
          .object({
            style: z.enum(["color", "image"]).default("color"),
            // Six-digit hex only. It is dropped into an inline style on the
            // portal, so what is stored has to be a colour and nothing else.
            color: z
              .string()
              .trim()
              .refine(
                (value) => value === "" || isPortalHeaderColor(value),
                "Header colour must be a hex value such as #1f4d73."
              )
              .default(DEFAULT_PORTAL_HEADER_COLOR),
            imagePath: z.string().trim().max(512).default("")
          })
          .default({}),
        contactEmail: z.union([z.literal(""), z.string().email()]).default(""),
        dateFormat: z.enum(["MMM d, yyyy", "MM/dd/yyyy", "dd/MM/yyyy"]),
        timeFormat: z.enum(["12-hour", "24-hour"])
      }),
      calendar: z.object({
        defaultView: z.enum(["month", "week", "agenda"]),
        weekStartsOn: z.enum(["sunday", "monday", "saturday"]),
        showHebrewDate: z.boolean(),
        showAvailability: z.boolean(),
        // Defaulted, not required: `controlCenterFromIntegrations` falls back to
        // the whole default block when this schema fails, so a field added
        // without a default would discard every calendar and kitchen preference
        // an organization had already saved.
        clickAnywhereToAdd: z.boolean().default(false),
        holdExpirationHours: z.union([
          z.literal(24),
          z.literal(48),
          z.literal(72),
          z.literal(168)
        ]),
        shortNoticeDays: z.union([
          z.literal(3),
          z.literal(7),
          z.literal(14),
          z.literal(30)
        ])
      }),
      kitchen: z.object({
        defaultView: z.enum(["today", "week", "four-weeks"]),
        shortNoticeDays: z.union([z.literal(1), z.literal(3), z.literal(7)]),
        notificationsEnabled: z.boolean(),
        requireMenuAcknowledgment: z.boolean()
      })
    })
    .optional(),
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

const defaultControlCenter = {
  general: {
    logoPath: "",
    portalHeader: {
      style: "color" as const,
      color: DEFAULT_PORTAL_HEADER_COLOR,
      imagePath: ""
    },
    contactEmail: "",
    dateFormat: "MMM d, yyyy" as const,
    timeFormat: "12-hour" as const
  },
  calendar: {
    defaultView: "month" as const,
    weekStartsOn: "sunday" as const,
    showHebrewDate: true,
    showAvailability: true,
    clickAnywhereToAdd: false,
    holdExpirationHours: 48 as const,
    shortNoticeDays: 7 as const
  },
  kitchen: {
    defaultView: "week" as const,
    shortNoticeDays: 3 as const,
    notificationsEnabled: true,
    requireMenuAcknowledgment: true
  }
};

function controlCenterFromIntegrations(integrations: unknown) {
  const candidate =
    integrations &&
    typeof integrations === "object" &&
    "controlCenter" in integrations
      ? (integrations as { controlCenter?: unknown }).controlCenter
      : undefined;
  const parsed = settingsSchema.shape.controlCenter.safeParse(candidate);
  return parsed.success && parsed.data ? parsed.data : defaultControlCenter;
}

function mergeControlCenterSettings(
  integrations: unknown,
  controlCenter: z.infer<typeof settingsSchema>["controlCenter"]
): Prisma.InputJsonValue | undefined {
  if (!controlCenter) return undefined;
  const base =
    integrations && typeof integrations === "object"
      ? { ...(integrations as Record<string, unknown>) }
      : {};
  return { ...base, controlCenter } as Prisma.InputJsonValue;
}

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
    const actor = await authorize(request, "settings.read");
    const [organization, settings, notifications, paymentSetting] =
      await Promise.all([
        // Selected, not the whole row. `permissionsEpoch` is a BigInt, which
        // JSON.stringify throws on, so an unselected organization row turns
        // this endpoint into a 500 the moment the column exists. Naming the two
        // fields the response contract actually promises also means the next
        // column added to Organization cannot silently join the payload.
        prisma.organization.findUniqueOrThrow({
          where: { id: actor.organizationId },
          select: { id: true, name: true }
        }),
        prisma.organizationSetting.upsert({
          where: { ...tenant(actor) },
          update: {},
          create: { organizationId: actor.organizationId }
        }),
        prisma.notificationPreference.upsert({
          where: {
            organizationId_userId: {
              organizationId: actor.organizationId,
              userId: requireUserActor(actor)
            }
          },
          update: {},
          create: {
            organizationId: actor.organizationId,
            userId: requireUserActor(actor)
          }
        }),
        prisma.paymentSetting.findUnique({
          where: { ...tenant(actor) },
          select: { paymentLink: true }
        })
      ]);

    return NextResponse.json({
      organization,
      settings: {
        ...settings,
        calendar: calendarSettingsFromIntegrations(settings.integrations),
        controlCenter: controlCenterFromIntegrations(settings.integrations)
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
    const actor = await authorize(request, "settings.read");
    const input = settingsSchema.parse(await request.json());
    if (
      input.language !== undefined ||
      input.timezone !== undefined ||
      input.organizationName !== undefined ||
      input.twoFactorRequired !== undefined ||
      input.sessionTimeoutMinutes !== undefined ||
      input.dailyEventLimit !== undefined ||
      input.controlCenter !== undefined ||
      input.billing !== undefined
    ) {
      await assertPermission(actor, "settings.update");
    }
    // Changing where client payments land is a money decision, not a general
    // settings edit, so it needs the dedicated payments permission.
    if (input.payments !== undefined) {
      await assertPermission(actor, "payment.record");
    }
    // The browser writes the objects to storage itself, so this is where a path
    // pointing outside the caller's own folder gets refused - for both of the
    // branding images this payload can carry.
    for (const [subject, path] of [
      ["Logo", input.controlCenter?.general.logoPath],
      ["Header image", input.controlCenter?.general.portalHeader.imagePath]
    ] as const) {
      const pathError = path
        ? readBrandingPathError(actor.organizationId, path, subject)
        : null;
      if (pathError) {
        return NextResponse.json({ error: pathError }, { status: 400 });
      }
    }
    const currentSettings = await prisma.organizationSetting.upsert({
      where: { ...tenant(actor) },
      update: {},
      create: { organizationId: actor.organizationId }
    });
    if (input.organizationName !== undefined) {
      await prisma.organization.update({
        where: { id: actor.organizationId },
        data: { name: input.organizationName }
      });
    }
    const organizationChanges = {
      language: input.language,
      timezone: input.timezone,
      twoFactorRequired: input.twoFactorRequired,
      sessionTimeoutMinutes: input.sessionTimeoutMinutes,
      integrations:
        mergeControlCenterSettings(
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
            ) ??
            currentSettings.integrations,
          input.controlCenter
        ) ??
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
          where: { ...tenant(actor) },
          update: organizationChanges,
          create: {
            organizationId: actor.organizationId,
            ...organizationChanges
          }
        });

        if (input.dailyEventLimit !== undefined) {
          await transaction.hall.updateMany({
            where: { ...tenant(actor) },
            data: { dailyEventLimit: input.dailyEventLimit }
          });
        }

        const notifications = await transaction.notificationPreference.upsert({
          where: {
            organizationId_userId: {
              organizationId: actor.organizationId,
              userId: requireUserActor(actor)
            }
          },
          update: notificationChanges,
          create: {
            organizationId: actor.organizationId,
            userId: requireUserActor(actor),
            ...notificationChanges
          }
        });

        return { settings, notifications };
      }
    );

    // After the write, and best effort: an image replaced or removed leaves an
    // object nothing points at, but a storage failure must not undo a save the
    // caller has already been told nothing about.
    //
    // Keyed on the path changing, not on which style is selected: an operator
    // who switches the header back to a colour keeps the image they uploaded,
    // so switching to it again costs them nothing.
    if (input.controlCenter) {
      const previous = controlCenterFromIntegrations(
        currentSettings.integrations
      ).general;
      const next = input.controlCenter.general;
      for (const [previousPath, nextPath] of [
        [previous.logoPath, next.logoPath],
        [previous.portalHeader.imagePath, next.portalHeader.imagePath]
      ]) {
        if (previousPath && previousPath !== nextPath) {
          await discardOrganizationBrandingImage(
            actor.organizationId,
            previousPath
          );
        }
      }
    }

    const payments =
      input.payments !== undefined
        ? await prisma.paymentSetting.upsert({
            where: { ...tenant(actor) },
            update: { paymentLink: input.payments.paymentLink },
            create: {
              organizationId: actor.organizationId,
              paymentLink: input.payments.paymentLink
            },
            select: { paymentLink: true }
          })
        : await prisma.paymentSetting.findUnique({
            where: { ...tenant(actor) },
            select: { paymentLink: true }
          });

    return NextResponse.json({
      settings: {
        ...settings,
        calendar: calendarSettingsFromIntegrations(settings.integrations),
        controlCenter: controlCenterFromIntegrations(settings.integrations)
      },
      notifications,
      payments: { paymentLink: payments?.paymentLink ?? "" }
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
