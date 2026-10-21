import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";

/**
 * The caller's own notification preferences.
 *
 * The same `notification_preferences` row the Settings page has always edited -
 * one per (organization, person) - reachable without `settings.read`. Those
 * toggles were never an organization setting; they sat behind that permission
 * only because Settings was the one screen that drew them, which left every
 * cook and receptionist with no say over what they are emailed.
 *
 * Keyed by the verified caller and the organization they are acting in. Nothing
 * in the request names either.
 */
const preferencesSchema = z
  .object({
    emailNotifications: z.boolean().optional(),
    eventConfirmations: z.boolean().optional(),
    billingAlerts: z.boolean().optional(),
    systemAnnouncements: z.boolean().optional()
  })
  .strict();

const PREFERENCES_SELECT = {
  emailNotifications: true,
  eventConfirmations: true,
  billingAlerts: true,
  systemAnnouncements: true
} as const;

export const GET = withRoute(
  "GET /api/me/notifications",
  async (request: Request) => {
    try {
      const actor = await authorizeMember(request);
      const userId = requireUserActor(actor);

      // Upsert rather than find: somebody who has never opened a preference
      // screen has no row yet, and the schema defaults are their real answer.
      const preferences = await prisma.notificationPreference.upsert({
        where: {
          organizationId_userId: { organizationId: actor.organizationId, userId }
        },
        update: {},
        create: { organizationId: actor.organizationId, userId },
        select: PREFERENCES_SELECT
      });

      return NextResponse.json({ preferences });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

export const PATCH = withRoute(
  "PATCH /api/me/notifications",
  async (request: Request) => {
    try {
      const actor = await authorizeMember(request);
      const userId = requireUserActor(actor);
      const changes = preferencesSchema.parse(await request.json());

      const preferences = await prisma.notificationPreference.upsert({
        where: {
          organizationId_userId: { organizationId: actor.organizationId, userId }
        },
        update: changes,
        create: { organizationId: actor.organizationId, userId, ...changes },
        select: PREFERENCES_SELECT
      });

      // Which switches moved, not the person: a "why did I stop getting
      // confirmations" ticket starts here.
      log.info(
        { fields: Object.keys(changes) },
        "own_notification_preferences_updated"
      );

      return NextResponse.json({ preferences });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
