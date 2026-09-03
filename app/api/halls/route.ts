import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { getActiveHallLimit } from "@/lib/subscription/limits";
import { countSchema, moneySchema } from "@/lib/validation/number";
import { withRoute } from "@/lib/http/with-route";

type HallMapPresetCount = {
  hall_id: string;
  count: bigint;
};

function withHallMapPresetCounts<
  THall extends { id: string; _count: Record<string, number> }
>(halls: THall[], counts: HallMapPresetCount[]) {
  const countByHallId = new Map(
    counts.map((item) => [item.hall_id, Number(item.count)])
  );

  return halls.map((hall) => ({
    ...hall,
    _count: {
      ...hall._count,
      hallMapPresets: countByHallId.get(hall.id) ?? 0
    }
  }));
}

// `null` means the user emptied the field, which is a legitimate "Not set".
// Because JSON.stringify turns NaN into null, a garbage entry and a deliberate
// clear are indistinguishable on the wire - the client is what has to
// guarantee null only ever comes from genuinely empty input.
const hallFieldsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  capacity: countSchema({ min: 1, label: "Capacity" }).nullable().optional(),
  dailyEventLimit: countSchema({
    min: 1,
    max: 50,
    label: "Events allowed per day"
  })
    .nullable()
    .optional(),
  basePrice: moneySchema({ label: "Base price" }).nullable().optional(),
  perCouplePrice: moneySchema({ label: "Per couple price" })
    .nullable()
    .optional(),
  memberBasePrice: moneySchema({ label: "Member base price" })
    .nullable()
    .optional(),
  memberPerCouplePrice: moneySchema({ label: "Member per couple price" })
    .nullable()
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
  isBookable: z.boolean().optional()
});

const createHallSchema = hallFieldsSchema;
const updateHallSchema = hallFieldsSchema
  .partial()
  .extend({ id: z.string().uuid() });
const deleteHallSchema = z.object({ id: z.string().uuid() });

function mergeCalendarDailyEventLimit(
  integrations: unknown,
  dailyEventLimit: number
): Prisma.InputJsonValue {
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

function dailyEventLimitFromIntegrations(integrations: unknown) {
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
        return dailyEventLimit;
      }
    }
  }

  return 2;
}

export const GET = withRoute(
  "GET /api/halls",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "hall.read");
      const [organization, settings, halls] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: actor.organizationId },
          select: { subscriptionPlan: true, subscriptionStatus: true }
        }),
        prisma.organizationSetting.upsert({
          where: { organizationId: actor.organizationId },
          update: {},
          create: { organizationId: actor.organizationId },
          select: { integrations: true }
        }),
        prisma.hall.findMany({
          where: { organizationId: actor.organizationId },
          orderBy: [{ isActive: "desc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            capacity: true,
            dailyEventLimit: true,
            basePrice: true,
            perCouplePrice: true,
            memberBasePrice: true,
            memberPerCouplePrice: true,
            color: true,
            isActive: true,
            isBookable: true,
            _count: {
              select: {
                events: true,
                bookingReservations: true
              }
            }
          }
        })
      ]);
      const hallLimit = getActiveHallLimit(
        organization?.subscriptionStatus,
        organization?.subscriptionPlan
      );
      const hallMapPresetCounts = halls.length
        ? await prisma.$queryRaw<HallMapPresetCount[]>`
            SELECT hall_id, COUNT(*)::bigint AS count
            FROM hall_map_presets
            WHERE organization_id = ${actor.organizationId}::uuid
              AND hall_id = ANY(${halls.map((hall) => hall.id)}::uuid[])
            GROUP BY hall_id
          `
        : [];
      const calendarDefaultLimit = dailyEventLimitFromIntegrations(
        settings.integrations
      );

      return NextResponse.json({
        halls: withHallMapPresetCounts(
          halls.map((hall) => ({
            ...hall,
            dailyEventLimit: hall.dailyEventLimit ?? calendarDefaultLimit
          })),
          hallMapPresetCounts
        ),
        limits: {
          activeHallLimit: hallLimit,
          subscriptionPlan: organization?.subscriptionPlan ?? null,
          subscriptionStatus: organization?.subscriptionStatus ?? "active"
        }
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

export const POST = withRoute(
  "POST /api/halls",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "hall.manage");
      const input = createHallSchema.parse(await request.json());
      const organization = await prisma.organization.findUnique({
        where: { id: actor.organizationId },
        select: { subscriptionPlan: true, subscriptionStatus: true }
      });
      const hallLimit = getActiveHallLimit(
        organization?.subscriptionStatus,
        organization?.subscriptionPlan
      );

      if (hallLimit !== null) {
        const activeHallCount = await prisma.hall.count({
          where: {
            organizationId: actor.organizationId,
            isActive: true
          }
        });

        if ((input.isActive ?? true) && activeHallCount >= hallLimit) {
          return NextResponse.json(
            {
              error:
                "Free trial organizations can only use 1 active hall. Upgrade your plan to add more halls."
            },
            { status: 403 }
          );
        }
      }

      const duplicate = await prisma.hall.findFirst({
        where: {
          organizationId: actor.organizationId,
          name: { equals: input.name, mode: "insensitive" }
        },
        select: { id: true }
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "A hall with this name already exists." },
          { status: 409 }
        );
      }

      const hall = await prisma.$transaction(async (transaction) => {
        const hall = await transaction.hall.create({
          data: {
            organizationId: actor.organizationId,
            name: input.name,
            capacity: input.capacity ?? null,
            dailyEventLimit: input.dailyEventLimit ?? null,
            basePrice: input.basePrice ?? null,
            perCouplePrice: input.perCouplePrice ?? null,
            memberBasePrice: input.memberBasePrice ?? null,
            memberPerCouplePrice: input.memberPerCouplePrice ?? null,
            color: input.color ?? "#1f5f91",
            isActive: input.isActive ?? true,
            isBookable: input.isBookable ?? true
          }
        });

        if (input.dailyEventLimit !== undefined && input.dailyEventLimit !== null) {
          const settings = await transaction.organizationSetting.upsert({
            where: { organizationId: actor.organizationId },
            update: {},
            create: { organizationId: actor.organizationId }
          });
          await transaction.organizationSetting.update({
            where: { organizationId: actor.organizationId },
            data: {
              integrations: mergeCalendarDailyEventLimit(
                settings.integrations,
                input.dailyEventLimit
              )
            }
          });
        }

        return hall;
      });
      return NextResponse.json({ hall }, { status: 201 });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

export const PATCH = withRoute(
  "PATCH /api/halls",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "hall.manage");
      const input = updateHallSchema.parse(await request.json());
      const current = await prisma.hall.findFirst({
        where: { id: input.id, organizationId: actor.organizationId },
        select: { id: true, isActive: true }
      });
      if (!current) {
        return NextResponse.json({ error: "Hall not found." }, { status: 404 });
      }
      if (input.name) {
        const duplicate = await prisma.hall.findFirst({
          where: {
            organizationId: actor.organizationId,
            name: { equals: input.name, mode: "insensitive" },
            id: { not: current.id }
          },
          select: { id: true }
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "A hall with this name already exists." },
            { status: 409 }
          );
        }
      }

      if (input.isActive === true && !current.isActive) {
        const organization = await prisma.organization.findUnique({
          where: { id: actor.organizationId },
          select: { subscriptionPlan: true, subscriptionStatus: true }
        });
        const hallLimit = getActiveHallLimit(
          organization?.subscriptionStatus,
          organization?.subscriptionPlan
        );

        if (hallLimit !== null) {
          const activeHallCount = await prisma.hall.count({
            where: {
              organizationId: actor.organizationId,
              isActive: true,
              id: { not: current.id }
            }
          });

          if (activeHallCount >= hallLimit) {
            return NextResponse.json(
              {
                error:
                  "Free trial organizations can only use 1 active hall. Upgrade your plan to activate more halls."
              },
              { status: 403 }
            );
          }
        }
      }

      const hall = await prisma.$transaction(async (transaction) => {
        const hall = await transaction.hall.update({
          where: { id: current.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
            ...(input.dailyEventLimit !== undefined
              ? { dailyEventLimit: input.dailyEventLimit }
              : {}),
            ...(input.basePrice !== undefined
              ? { basePrice: input.basePrice }
              : {}),
            ...(input.perCouplePrice !== undefined
              ? { perCouplePrice: input.perCouplePrice }
              : {}),
            ...(input.memberBasePrice !== undefined
              ? { memberBasePrice: input.memberBasePrice }
              : {}),
            ...(input.memberPerCouplePrice !== undefined
              ? { memberPerCouplePrice: input.memberPerCouplePrice }
              : {}),
            ...(input.color !== undefined ? { color: input.color } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            ...(input.isBookable !== undefined
              ? { isBookable: input.isBookable }
              : {})
          }
        });

        if (input.dailyEventLimit !== undefined && input.dailyEventLimit !== null) {
          const settings = await transaction.organizationSetting.upsert({
            where: { organizationId: actor.organizationId },
            update: {},
            create: { organizationId: actor.organizationId }
          });
          await transaction.organizationSetting.update({
            where: { organizationId: actor.organizationId },
            data: {
              integrations: mergeCalendarDailyEventLimit(
                settings.integrations,
                input.dailyEventLimit
              )
            }
          });
        }

        return hall;
      });
      return NextResponse.json({ hall });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

export const DELETE = withRoute(
  "DELETE /api/halls",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "hall.manage");
      const input = deleteHallSchema.parse(await request.json());
      const hall = await prisma.hall.findFirst({
        where: { id: input.id, organizationId: actor.organizationId },
        select: {
          id: true,
          _count: {
            select: {
              events: true,
              bookingReservations: true
            }
          }
        }
      });
      if (!hall) {
        return NextResponse.json({ error: "Hall not found." }, { status: 404 });
      }

      const [hallMapPresetCount] = await prisma.$queryRaw<HallMapPresetCount[]>`
        SELECT hall_id, COUNT(*)::bigint AS count
        FROM hall_map_presets
        WHERE organization_id = ${actor.organizationId}::uuid
          AND hall_id = ${hall.id}::uuid
        GROUP BY hall_id
      `;
      const references =
        hall._count.events +
        hall._count.bookingReservations +
        Number(hallMapPresetCount?.count ?? 0);
      if (references > 0) {
        return NextResponse.json(
          {
            error:
              "This hall is already used by events, reservations, or map presets. Deactivate it instead."
          },
          { status: 409 }
        );
      }

      await prisma.hall.delete({ where: { id: hall.id } });
      return NextResponse.json({ deleted: true });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
