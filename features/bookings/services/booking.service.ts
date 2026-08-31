import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  BookingStatus,
  CreateBookingInput
} from "@/features/bookings/validations/booking.schema";

type Transaction = Prisma.TransactionClient;

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
      if (typeof dailyEventLimit === "number" && Number.isFinite(dailyEventLimit)) {
        return dailyEventLimit;
      }
    }
  }

  return 2;
}

type BookingActor = {
  id: string;
  name: string;
  organizationId: string;
  /**
   * Which halls this actor may book in - the verdict's scope, passed straight
   * through rather than re-derived.
   *
   * "all" is NOT the same as []. "all" means unrestricted; an empty array means
   * scoped to nothing, and every hall check below must then fail. The column
   * this replaced used the opposite convention - empty meant unrestricted - and
   * each of its eight readers had to remember which.
   */
  hallScope: string[] | "all";
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

export type AttendeeCounts = {
  couplesCount: number;
  menCount: number;
  ladiesCount: number;
  boysCount: number;
  girlsCount: number;
  kidsCount: number;
};

/** A couple is two attendees; every other bucket is one each. */
export function countAttendees(counts: AttendeeCounts) {
  return (
    counts.couplesCount * 2 +
    counts.menCount +
    counts.ladiesCount +
    counts.boysCount +
    counts.girlsCount +
    counts.kidsCount
  );
}

/**
 * Shared by the create and update paths so an event cannot be edited past a
 * limit it could never have been booked with.
 */
export function assertHallCapacity(
  hall: { name: string; capacity?: number | null },
  counts: AttendeeCounts
) {
  const attendeeCount = countAttendees(counts);

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
}

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

/**
 * Postgres aborts a serializable transaction it cannot order against the ones
 * running beside it, with SQLSTATE 40001. It reaches us in two shapes: `P2034`
 * when the query engine raises it, and a driver-adapter `TransactionWriteConflict`
 * when the pg adapter does. Only the first was recognised, so the second walked
 * past the retry and out of the route as a 500.
 */
export function isWriteConflictError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return true;
  }

  const cause = (
    error as { cause?: { kind?: unknown; originalCode?: unknown } } | null
  )?.cause;

  return (
    cause?.kind === "TransactionWriteConflict" || cause?.originalCode === "40001"
  );
}

const WRITE_CONFLICT_ATTEMPTS = 5;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Jittered, because the transactions that just collided would otherwise retry
 * in lockstep and collide again. Roughly 25ms, 50ms, 100ms, 200ms, each plus
 * up to its own length.
 */
function retryDelay(attempt: number) {
  const base = 25 * 2 ** attempt;

  return base + Math.floor(Math.random() * base);
}

async function runInTransaction<T>(
  operation: (transaction: Transaction) => Promise<T>,
  isolationLevel: Prisma.TransactionIsolationLevel = Prisma.TransactionIsolationLevel
    .Serializable
) {
  for (let attempt = 0; attempt < WRITE_CONFLICT_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel,
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
      if (isWriteConflictError(error)) {
        // Out of attempts. A retryable conflict is a 409 the caller can act on,
        // never the 500 the raw error used to become.
        if (attempt === WRITE_CONFLICT_ATTEMPTS - 1) {
          throw new BookingError(
            "The booking could not be committed. Please retry.",
            409,
            "BOOKING_RETRY"
          );
        }

        await sleep(retryDelay(attempt));
        continue;
      }
      throw error;
    }
  }

  // Unreachable: the loop only leaves through a return or a throw. Here for the
  // type checker.
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
  // An inquiry holds nothing: it writes no reservation, and neither the daily
  // limit nor the availability check below runs for it. Serializable buys it
  // no invariant, and costs a write conflict against every other booking being
  // created at the same moment - the idempotency key is guarded by its unique
  // index either way. So only the statuses that take a hall pay for it.
  const holdsAHall = activeStatuses.has(status);

  try {
    const result = await runInTransaction(async (transaction) => {
      // Only worth doing where it changes an answer: expiring holds exists to
      // keep the availability and daily-limit checks honest.
      if (holdsAHall) {
        await expireHolds(transaction, actor.organizationId, new Date());
      }

      const replay = await transaction.event.findFirst({
        where: { organizationId: actor.organizationId, idempotencyKey },
        select: { id: true, idempotencyHash: true }
      });
      if (replay) {
        if (replay.idempotencyHash !== hash) {
          throw new BookingError(
            "This idempotency key was already used with different booking details.",
            409,
            "IDEMPOTENCY_KEY_REUSED"
          );
        }
        return { eventId: replay.id, replayed: true };
      }

      // A Prisma transaction uses one pg client. Starting these reads together
      // makes pg warn that the same client is already executing a query, and in
      // pg@9 that becomes an error. Keep transaction work sequential.
      const hall = await transaction.hall.findFirst({
        where: { id: input.hallId, organizationId: actor.organizationId }
      });
      const eventType = input.eventTypeId
        ? await transaction.eventType.findFirst({
            where: {
              id: input.eventTypeId,
              organizationId: actor.organizationId
            }
          })
        : null;
      const eventPackage = input.packageId
        ? await transaction.eventPackage.findFirst({
            where: {
              id: input.packageId,
              organizationId: actor.organizationId
            }
          })
        : null;
      const selectedClient = input.clientId
        ? await transaction.client.findFirst({
            where: {
              id: input.clientId,
              organizationId: actor.organizationId
            }
          })
        : null;
      // Proved to be a seat in this organization, the same as the hall and the
      // type above. Without it a booking could name somebody from another
      // tenant, whose name the coordinator join would then read back out.
      const coordinator = input.coordinatorMembershipId
        ? await transaction.organizationMembership.findFirst({
            where: {
              id: input.coordinatorMembershipId,
              organizationId: actor.organizationId,
              isActive: true
            }
          })
        : null;

      if (!hall || !hall.isActive || !hall.isBookable) {
        throw new BookingError("The selected hall is unavailable.");
      }
      if (
        actor.hallScope !== "all" &&
        !actor.hallScope.includes(hall.id)
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
      if (input.coordinatorMembershipId && !coordinator)
        throw new BookingError("The selected coordinator does not exist.");

      const eventDate = new Date(
        `${window.startsAt.toISOString().slice(0, 10)}T00:00:00.000Z`
      );
      // Scoped to the hall being booked. A range now closes one hall, so a
      // closure on the room next door has nothing to say about this booking.
      // `hallId: null` is the legacy reading - a range saved before the column
      // existed closed the whole venue and still does.
      const blocked = await transaction.holidayBlockedDate.findFirst({
        where: {
          organizationId: actor.organizationId,
          isBlocked: true,
          OR: [{ hallId: hall.id }, { hallId: null }],
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

      assertHallCapacity(hall, input);

      const reservedHallIds = await occupiedHallIds(
        transaction,
        actor.organizationId,
        hall.id
      );
      if (activeStatuses.has(status)) {
        const settings = await transaction.organizationSetting.upsert({
          where: { organizationId: actor.organizationId },
          update: {},
          create: { organizationId: actor.organizationId }
        });
        const defaultDailyEventLimit = dailyEventLimitFromIntegrations(
          settings.integrations
        );
        const limitedHalls = await transaction.hall.findMany({
          where: {
            organizationId: actor.organizationId,
            id: { in: reservedHallIds }
          },
          select: { name: true, dailyEventLimit: true }
        });
        const dailyEventLimit = Math.min(
          ...limitedHalls.map(
            (limitedHall) =>
              limitedHall.dailyEventLimit ?? defaultDailyEventLimit
          )
        );
        const activeBookingsOnDate = await transaction.event.count({
          where: {
            organizationId: actor.organizationId,
            deleted: false,
            eventDate,
            hallId: { in: reservedHallIds },
            bookingStatus: { in: Array.from(activeStatuses) }
          }
        });

        if (activeBookingsOnDate >= dailyEventLimit) {
          const limitNames = limitedHalls
            .filter(
              (limitedHall) =>
                (limitedHall.dailyEventLimit ?? defaultDailyEventLimit) ===
                dailyEventLimit
            )
            .map((limitedHall) => limitedHall.name)
            .join(", ");
          throw new BookingError(
            `${limitNames || hall.name} already has ${activeBookingsOnDate} active bookings on this date. The daily event limit is ${dailyEventLimit}.`,
            409,
            "DAILY_EVENT_LIMIT_REACHED"
          );
        }

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
              // Only match on the phone when there is one. Prisma drops an
              // `undefined` filter, which would reduce this to a name-only
              // match and silently attach the booking to a different client
              // who happens to share a name.
              input.phone
                ? { name: input.clientName, phone: input.phone }
                : { name: input.clientName, phone: null }
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
          // `Event.phone` is NOT NULL while `Client.phone` is nullable, so an
          // absent number is stored as empty here rather than as null.
          phone: input.phone ?? "",
          email: input.email,
          coordinatorMembershipId: input.coordinatorMembershipId,
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
        }
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
      return { eventId: event.id, replayed: false };
    },
    holdsAHall
      ? Prisma.TransactionIsolationLevel.Serializable
      : Prisma.TransactionIsolationLevel.ReadCommitted);

    const event = await prisma.event.findUniqueOrThrow({
      where: { id: result.eventId },
      include: { hall: true, package: true, client: true }
    });

    return { event, replayed: result.replayed };
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
  const result = await runInTransaction(async (transaction) => {
    await expireHolds(transaction, actor.organizationId, new Date());
    const event = await transaction.event.findFirst({
      where: {
        id: eventId,
        organizationId: actor.organizationId,
        deleted: false
      }
    });
    if (!event)
      throw new BookingError("Booking not found.", 404, "BOOKING_NOT_FOUND");
    if (
      actor.hallScope !== "all" &&
      !actor.hallScope.includes(event.hallId)
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
    return { eventId: event.id };
  });

  return prisma.event.findUniqueOrThrow({
    where: { id: result.eventId },
    include: { hall: true }
  });
}

export async function expireOrganizationHolds(organizationId: string) {
  return runInTransaction((transaction) =>
    expireHolds(transaction, organizationId, new Date())
  );
}
