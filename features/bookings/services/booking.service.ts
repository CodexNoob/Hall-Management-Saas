import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  BookingStatus,
  CreateBookingInput
} from "@/features/bookings/validations/booking.schema";

type Transaction = Prisma.TransactionClient;

type BookingActor = {
  id: string;
  name: string;
  organizationId: string;
  allowedHallIds?: string[];
};

export class BookingError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409 = 400,
    public readonly code = "BOOKING_INVALID"
  ) {
    super(message);
    this.name = "BookingError";
  }
}

const statusLabels: Record<BookingStatus, string> = {
  INQUIRY: "Inquiry",
  TENTATIVE_HOLD: "On Hold",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired"
};

const activeStatuses = new Set<BookingStatus>(["TENTATIVE_HOLD", "CONFIRMED"]);

function requestedStatus(input: CreateBookingInput): BookingStatus {
  if (input.bookingStatus) return input.bookingStatus;
  if (input.eventStatus === "Confirmed") return "CONFIRMED";
  if (input.eventStatus === "On Hold" || input.eventStatus === "Hold")
    return "TENTATIVE_HOLD";
  return "INQUIRY";
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60_000);
}

function resolveWindow(input: CreateBookingInput) {
  let startsAt: Date;
  let endsAt: Date;

  if (input.startsAt && input.endsAt) {
    startsAt = new Date(input.startsAt);
    endsAt = new Date(input.endsAt);
  } else {
    const date = input.eventDate!;
    const startTime = input.startTime ?? "18:00";
    const endTime = input.endTime ?? "23:00";
    startsAt = new Date(`${date}T${startTime}:00.000Z`);
    endsAt = new Date(`${date}T${endTime}:00.000Z`);
    if (endsAt <= startsAt) endsAt = addMinutes(endsAt, 1440);
  }

  const setupStartsAt = input.setupStartsAt
    ? new Date(input.setupStartsAt)
    : addMinutes(startsAt, -input.setupMinutes);
  const cleanupEndsAt = input.cleanupEndsAt
    ? new Date(input.cleanupEndsAt)
    : addMinutes(endsAt, input.cleanupMinutes);

  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    !Number.isFinite(setupStartsAt.getTime()) ||
    !Number.isFinite(cleanupEndsAt.getTime())
  ) {
    throw new BookingError("The booking time window is invalid.");
  }
  if (
    !(setupStartsAt <= startsAt && startsAt < endsAt && endsAt <= cleanupEndsAt)
  ) {
    throw new BookingError(
      "Times must follow setup start → event start → event end → cleanup end."
    );
  }
  if (cleanupEndsAt.getTime() - setupStartsAt.getTime() > 72 * 60 * 60 * 1000) {
    throw new BookingError(
      "A booking occupancy window cannot exceed 72 hours."
    );
  }

  return { startsAt, endsAt, setupStartsAt, cleanupEndsAt };
}

function requestHash(input: CreateBookingInput) {
  const payload = { ...input };
  delete payload.idempotencyKey;
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function isOverlapConstraintError(error: unknown) {
  const serialized = String(
    error instanceof Error
      ? `${error.message} ${(error as Error & { cause?: unknown }).cause ?? ""}`
      : error
  );
  return (
    serialized.includes("23P01") ||
    serialized.includes("booking_reservations_no_overlap")
  );
}

async function expireHolds(
  transaction: Transaction,
  organizationId: string,
  now: Date
) {
  const expired = await transaction.event.findMany({
    where: {
      organizationId,
      deleted: false,
      bookingStatus: "TENTATIVE_HOLD",
      holdExpiresAt: { lte: now }
    },
    select: { id: true }
  });
  if (expired.length === 0) return 0;

  const eventIds = expired.map(({ id }) => id);
  await transaction.bookingReservation.updateMany({
    where: { organizationId, eventId: { in: eventIds }, active: true },
    data: { active: false }
  });
  await transaction.event.updateMany({
    where: {
      organizationId,
      id: { in: eventIds },
      bookingStatus: "TENTATIVE_HOLD"
    },
    data: {
      bookingStatus: "EXPIRED",
      eventStatus: statusLabels.EXPIRED,
      statusChangedAt: now,
      version: { increment: 1 }
    }
  });
  return eventIds.length;
}

async function occupiedHallIds(
  transaction: Transaction,
  organizationId: string,
  hallId: string
) {
  const halls = await transaction.hall.findMany({
    where: {
      organizationId,
      OR: [{ id: hallId }, { connectedHallIds: { has: hallId } }]
    },
    select: { id: true, connectedHallIds: true }
  });
  const primary = halls.find((hall) => hall.id === hallId);
  if (!primary) return [];
  const ids = new Set([hallId, ...primary.connectedHallIds]);
  for (const hall of halls) ids.add(hall.id);
  const valid = await transaction.hall.findMany({
    where: { organizationId, id: { in: [...ids] } },
    select: { id: true }
  });
  return valid.map(({ id }) => id);
}

async function assertAvailable(
  transaction: Transaction,
  organizationId: string,
  hallIds: string[],
  setupStartsAt: Date,
  cleanupEndsAt: Date,
  excludeEventId?: string
) {
  const conflict = await transaction.bookingReservation.findFirst({
    where: {
      organizationId,
      active: true,
      hallId: { in: hallIds },
      startsAt: { lt: cleanupEndsAt },
      endsAt: { gt: setupStartsAt },
      ...(excludeEventId ? { eventId: { not: excludeEventId } } : {})
    },
    include: {
      hall: { select: { name: true } },
      event: { select: { clientName: true } }
    }
  });
  if (conflict) {
    throw new BookingError(
      `${conflict.hall.name} is already reserved during this setup-to-cleanup window.`,
      409,
      "BOOKING_CONFLICT"
    );
  }
}

async function runSerializable<T>(
  operation: (transaction: Transaction) => Promise<T>
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000
      });
    } catch (error) {
      if (isOverlapConstraintError(error)) {
        throw new BookingError(
          "That hall or a connected room was just reserved by another booking.",
          409,
          "BOOKING_CONFLICT"
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 2
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new BookingError(
    "The booking could not be committed. Please retry.",
    409,
    "BOOKING_RETRY"
  );
}

export async function createBooking(
  input: CreateBookingInput,
  actor: BookingActor
) {
  const status = requestedStatus(input);
  if (!["INQUIRY", "TENTATIVE_HOLD", "CONFIRMED"].includes(status)) {
    throw new BookingError(
      "New bookings must start as an inquiry, tentative hold, or confirmed booking."
    );
  }
  const window = resolveWindow(input);
  const idempotencyKey = input.idempotencyKey;
  if (!idempotencyKey) {
    throw new BookingError(
      "An idempotency key is required.",
      400,
      "IDEMPOTENCY_KEY_REQUIRED"
    );
  }
  const hash = requestHash(input);

  try {
    return await runSerializable(async (transaction) => {
      await expireHolds(transaction, actor.organizationId, new Date());

      const replay = await transaction.event.findFirst({
        where: { organizationId: actor.organizationId, idempotencyKey },
        include: { hall: true, package: true, client: true }
      });
      if (replay) {
        if (replay.idempotencyHash !== hash) {
          throw new BookingError(
            "This idempotency key was already used with different booking details.",
            409,
            "IDEMPOTENCY_KEY_REUSED"
          );
        }
        return { event: replay, replayed: true };
      }

      const [hall, eventType, eventPackage, selectedClient] = await Promise.all(
        [
          transaction.hall.findFirst({
            where: { id: input.hallId, organizationId: actor.organizationId }
          }),
          input.eventTypeId
            ? transaction.eventType.findFirst({
                where: {
                  id: input.eventTypeId,
                  organizationId: actor.organizationId
                }
              })
            : null,
          input.packageId
            ? transaction.eventPackage.findFirst({
                where: {
                  id: input.packageId,
                  organizationId: actor.organizationId
                }
              })
            : null,
          input.clientId
            ? transaction.client.findFirst({
                where: {
                  id: input.clientId,
                  organizationId: actor.organizationId
                }
              })
            : null
        ]
      );

      if (!hall || !hall.isActive || !hall.isBookable) {
        throw new BookingError("The selected hall is unavailable.");
      }
      if (
        actor.allowedHallIds?.length &&
        !actor.allowedHallIds.includes(hall.id)
      ) {
        throw new BookingError(
          "You do not have access to this hall.",
          404,
          "HALL_NOT_FOUND"
        );
      }
      if (input.eventTypeId && !eventType)
        throw new BookingError("The selected event type does not exist.");
      if (input.packageId && !eventPackage)
        throw new BookingError("The selected package does not exist.");
      if (input.clientId && !selectedClient)
        throw new BookingError("The selected client does not exist.");

      const eventDate = new Date(
        `${window.startsAt.toISOString().slice(0, 10)}T00:00:00.000Z`
      );
      const blocked = await transaction.holidayBlockedDate.findFirst({
        where: {
          organizationId: actor.organizationId,
          isBlocked: true,
          startDate: { lte: eventDate },
          endDate: { gte: eventDate }
        }
      });
      if (blocked) {
        throw new BookingError(
          `Bookings are blocked on this date: ${blocked.label}.`,
          409,
          "BLOCKED_DATE"
        );
      }
      if (
        eventType?.validDays.length &&
        !eventType.validDays.includes(window.startsAt.getUTCDay())
      ) {
        throw new BookingError(
          `${eventType.name} cannot be booked on the selected day.`,
          409,
          "INVALID_EVENT_DAY"
        );
      }

      const attendeeCount =
        input.couplesCount * 2 +
        input.menCount +
        input.ladiesCount +
        input.boysCount +
        input.girlsCount +
        input.kidsCount;
      if (
        hall.capacity !== null &&
        hall.capacity !== undefined &&
        attendeeCount > hall.capacity
      ) {
        throw new BookingError(
          `${hall.name} has capacity for ${hall.capacity} guests; this booking has ${attendeeCount}.`,
          409,
          "CAPACITY_EXCEEDED"
        );
      }

      const reservedHallIds = await occupiedHallIds(
        transaction,
        actor.organizationId,
        hall.id
      );
      if (activeStatuses.has(status)) {
        await assertAvailable(
          transaction,
          actor.organizationId,
          reservedHallIds,
          window.setupStartsAt,
          window.cleanupEndsAt
        );
      }

      const client =
        selectedClient ??
        (await transaction.client.findFirst({
          where: {
            organizationId: actor.organizationId,
            OR: [
              ...(input.email ? [{ email: input.email }] : []),
              { name: input.clientName, phone: input.phone }
            ]
          }
        })) ??
        (await transaction.client.create({
          data: {
            organizationId: actor.organizationId,
            name: input.clientName,
            email: input.email,
            phone: input.phone
          }
        }));

      const holdExpiresAt =
        status === "TENTATIVE_HOLD"
          ? addMinutes(new Date(), input.holdDurationMinutes)
          : null;
      const event = await transaction.event.create({
        data: {
          organizationId: actor.organizationId,
          clientId: client.id,
          clientName: input.clientName,
          phone: input.phone,
          email: input.email,
          eventDate,
          hallId: hall.id,
          hallName: hall.name,
          eventTypeId: input.eventTypeId,
          eventType: eventType?.name,
          eventStatus: statusLabels[status],
          bookingStatus: status,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          setupStartsAt: window.setupStartsAt,
          cleanupEndsAt: window.cleanupEndsAt,
          holdExpiresAt,
          paymentStatus: input.paymentStatus,
          packageId: input.packageId,
          packageName: eventPackage?.name,
          couplesCount: input.couplesCount,
          menCount: input.menCount,
          ladiesCount: input.ladiesCount,
          boysCount: input.boysCount,
          girlsCount: input.girlsCount,
          kidsCount: input.kidsCount,
          waitersCount: input.waitersCount,
          createdById: actor.id,
          notes: input.notes,
          idempotencyKey,
          idempotencyHash: hash
        },
        include: { hall: true, package: true, client: true }
      });

      if (activeStatuses.has(status)) {
        await transaction.bookingReservation.createMany({
          data: reservedHallIds.map((hallId) => ({
            organizationId: actor.organizationId,
            eventId: event.id,
            hallId,
            startsAt: window.setupStartsAt,
            endsAt: window.cleanupEndsAt
          }))
        });
      }

      await transaction.activityLog.create({
        data: {
          organizationId: actor.organizationId,
          clientId: client.id,
          eventId: event.id,
          userId: actor.id,
          userName: actor.name,
          actionType: "Booking Created",
          message: `Created ${statusLabels[status].toLowerCase()} booking for ${event.clientName} in ${hall.name}.`,
          newValue: {
            bookingStatus: status,
            startsAt: window.startsAt.toISOString(),
            endsAt: window.endsAt.toISOString(),
            setupStartsAt: window.setupStartsAt.toISOString(),
            cleanupEndsAt: window.cleanupEndsAt.toISOString(),
            reservedHallIds
          }
        }
      });
      return { event, replayed: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const replay = await prisma.event.findFirst({
        where: { organizationId: actor.organizationId, idempotencyKey },
        include: { hall: true, package: true, client: true }
      });
      if (replay?.idempotencyHash === hash)
        return { event: replay, replayed: true };
      if (replay) {
        throw new BookingError(
          "This idempotency key was already used with different booking details.",
          409,
          "IDEMPOTENCY_KEY_REUSED"
        );
      }
    }
    throw error;
  }
}

const transitions: Record<BookingStatus, BookingStatus[]> = {
  INQUIRY: ["TENTATIVE_HOLD", "CANCELLED"],
  TENTATIVE_HOLD: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: []
};

export async function transitionBooking(
  eventId: string,
  status: BookingStatus,
  expectedVersion: number,
  holdDurationMinutes: number,
  actor: BookingActor
) {
  return runSerializable(async (transaction) => {
    await expireHolds(transaction, actor.organizationId, new Date());
    const event = await transaction.event.findFirst({
      where: {
        id: eventId,
        organizationId: actor.organizationId,
        deleted: false
      },
      include: { hall: true }
    });
    if (!event)
      throw new BookingError("Booking not found.", 404, "BOOKING_NOT_FOUND");
    if (
      actor.allowedHallIds?.length &&
      !actor.allowedHallIds.includes(event.hallId)
    ) {
      throw new BookingError("Booking not found.", 404, "BOOKING_NOT_FOUND");
    }
    const current = event.bookingStatus as BookingStatus;
    if (!transitions[current]?.includes(status)) {
      throw new BookingError(
        `A booking cannot move from ${statusLabels[current]} to ${statusLabels[status]}.`,
        409,
        "INVALID_TRANSITION"
      );
    }
    if (!event.setupStartsAt || !event.cleanupEndsAt) {
      throw new BookingError(
        "This legacy booking needs an occupancy window before its status can change.",
        409
      );
    }

    const reservationActive = activeStatuses.has(status);
    const reservedHallIds = await occupiedHallIds(
      transaction,
      actor.organizationId,
      event.hallId
    );
    if (reservationActive) {
      await assertAvailable(
        transaction,
        actor.organizationId,
        reservedHallIds,
        event.setupStartsAt,
        event.cleanupEndsAt,
        event.id
      );
    }

    const now = new Date();
    const updated = await transaction.event.updateMany({
      where: {
        id: event.id,
        organizationId: actor.organizationId,
        version: expectedVersion
      },
      data: {
        bookingStatus: status,
        eventStatus: statusLabels[status],
        holdExpiresAt:
          status === "TENTATIVE_HOLD"
            ? addMinutes(now, holdDurationMinutes)
            : null,
        statusChangedAt: now,
        cancelledAt:
          status === "CANCELLED" || status === "EXPIRED" ? now : null,
        completedAt: status === "COMPLETED" ? now : null,
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    if (updated.count !== 1) {
      throw new BookingError(
        "This booking changed in another session. Refresh and try again.",
        409,
        "STALE_BOOKING_VERSION"
      );
    }

    await transaction.bookingReservation.updateMany({
      where: { eventId: event.id, organizationId: actor.organizationId },
      data: { active: false }
    });
    if (reservationActive) {
      for (const hallId of reservedHallIds) {
        await transaction.bookingReservation.upsert({
          where: { eventId_hallId: { eventId: event.id, hallId } },
          create: {
            organizationId: actor.organizationId,
            eventId: event.id,
            hallId,
            startsAt: event.setupStartsAt,
            endsAt: event.cleanupEndsAt
          },
          update: {
            startsAt: event.setupStartsAt,
            endsAt: event.cleanupEndsAt,
            active: true
          }
        });
      }
    }

    await transaction.activityLog.create({
      data: {
        organizationId: actor.organizationId,
        eventId: event.id,
        clientId: event.clientId,
        userId: actor.id,
        userName: actor.name,
        actionType: "Booking Status Changed",
        message: `Changed ${event.clientName}'s booking from ${statusLabels[current]} to ${statusLabels[status]}.`,
        oldValue: { bookingStatus: current, version: expectedVersion },
        newValue: { bookingStatus: status, version: expectedVersion + 1 }
      }
    });
    return transaction.event.findUniqueOrThrow({
      where: { id: event.id },
      include: { hall: true }
    });
  });
}

export async function expireOrganizationHolds(organizationId: string) {
  return runSerializable((transaction) =>
    expireHolds(transaction, organizationId, new Date())
  );
}
