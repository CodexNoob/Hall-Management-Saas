import { NextResponse } from "next/server";
import { z } from "zod";

import { changedFields, recordActivity } from "@/lib/audit/activity-log";
import { authorizeMember, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";
import { log } from "@/lib/logging/context";
import { prisma } from "@/lib/prisma";
import { phoneSchema } from "@/lib/validation/phone";

/**
 * The signed-in person's own profile - the My Account page.
 *
 * MEMBER-GATED, AND THE ONLY ROW IT CAN REACH IS THE CALLER'S. The user id comes
 * from the verified token through `requireUserActor`; nothing in the request
 * names a person, so there is nothing to point at somebody else.
 *
 * NAME AND PHONE ONLY. Email is the sign-in identity, and department and title
 * are how the organization files somebody - both belong to whoever holds
 * `staff.update`, through `PATCH /api/staff/[principalId]`. The schema is
 * STRICT: a body carrying `title`, `department`, `roleIds` or anything else is
 * refused with a 400 rather than quietly trimmed, so an attempt to widen one's
 * own record fails loudly instead of appearing to work.
 */
const profilePhoneSchema = phoneSchema({ label: "Phone number" });

const updateOwnProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().nullish()
  })
  .strict();

const PROFILE_SELECT = {
  name: true,
  email: true,
  phone: true,
  venueName: true,
  title: true
} as const;

function toProfile(
  user: {
    name: string;
    email: string;
    phone: string | null;
    venueName: string | null;
    title: string | null;
  },
  organizationName: string
) {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone,
    department: user.venueName,
    title: user.title,
    organizationName
  };
}

async function organizationNameOf(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true }
  });

  return organization?.name ?? "";
}

export const GET = withRoute("GET /api/me/profile", async (request: Request) => {
  try {
    const actor = await authorizeMember(request);
    const userId = requireUserActor(actor);

    const [user, organizationName] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: PROFILE_SELECT
      }),
      organizationNameOf(actor.organizationId)
    ]);

    return NextResponse.json({ profile: toProfile(user, organizationName) });
  } catch (error) {
    return createApiErrorResponse(error);
  }
});

export const PATCH = withRoute(
  "PATCH /api/me/profile",
  async (request: Request) => {
    try {
      const actor = await authorizeMember(request);
      const userId = requireUserActor(actor);
      const input = updateOwnProfileSchema.parse(await request.json());

      const phone =
        input.phone === undefined
          ? undefined
          : (profilePhoneSchema.parse(input.phone ?? "") ?? null);
      const changes = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(phone !== undefined ? { phone } : {})
      };

      const user = await prisma.$transaction(async (transaction) => {
        const previous = await transaction.user.findUniqueOrThrow({
          where: { id: userId },
          select: { name: true, phone: true }
        });
        const moved = changedFields(previous, changes);

        const saved = await transaction.user.update({
          where: { id: userId },
          data: changes,
          select: PROFILE_SELECT
        });

        // FIELD NAMES ONLY, as on the staff edit: `phone` is personal data and
        // `activity_logs` carries no redaction.
        if (moved.length > 0) {
          await recordActivity(transaction, actor, {
            // The same row the staff directory writes: it IS their staff
            // profile. The message says who made the change.
            action: "staff.profile.updated",
            message: `Updated their own profile: ${moved.join(", ")}.`,
            changed: { after: { userId, fields: moved } }
          });
          log.info({ fields: moved }, "own_profile_updated");
        }

        return saved;
      });

      return NextResponse.json({
        profile: toProfile(user, await organizationNameOf(actor.organizationId))
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
