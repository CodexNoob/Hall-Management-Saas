import { NextResponse } from "next/server";
import {
  authorize,
  hasPermission,
  scoped,
  tenant
} from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateKey(value: string | null, fallback: Date) {
  if (!value || !DATE_KEY_PATTERN.test(value)) {
    return fallback;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDailySeries(
  start: Date,
  end: Date,
  incomeByDate: Map<string, number>,
  expensesByDate: Map<string, number>
) {
  const points = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const date = toDateKey(cursor);
    points.push({
      date,
      incomeCents: incomeByDate.get(date) ?? 0,
      expenseCents: expensesByDate.get(date) ?? 0
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}

export async function GET(request: Request) {
  try {
    const actor = await authorize(request, "calendar.read");
    const url = new URL(request.url);
    const today = new Date();
    const defaultStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );
    const start = parseDateKey(url.searchParams.get("startDate"), defaultStart);
    const requestedEnd = parseDateKey(
      url.searchParams.get("endDate"),
      addUtcDays(start, 6)
    );
    const end = requestedEnd < start ? start : requestedEnd;
    const exclusiveEnd = addUtcDays(end, 1);
    // The revenue tiles are a second, narrower question than the calendar this
    // route is gated on, so they are asked separately rather than inferred from
    // whoever got past the first guard. A dashboard that quietly shows money to
    // anyone who can read a calendar is the same defect class as a view flag
    // gating a write.
    const canReadInvoices = await hasPermission(actor, "invoice.read");

    const [events, upcomingBookedEvents, paymentTransactions, paymentRefunds] =
      await Promise.all([
        prisma.event.findMany({
          where: {
            ...tenant(actor),
            deleted: false,
            eventDate: {
              gte: start,
              lt: exclusiveEnd
            },
            ...scoped(actor, "hall")
          },
          orderBy: [{ eventDate: "asc" }, { startsAt: "asc" }],
          select: {
            id: true,
            clientName: true,
            eventDate: true,
            eventStatus: true,
            bookingStatus: true,
            startsAt: true,
            endsAt: true,
            hallName: true,
            eventType: true,
            packageName: true,
            couplesCount: true,
            menCount: true,
            ladiesCount: true,
            boysCount: true,
            girlsCount: true,
            kidsCount: true,
            waitersCount: true,
            paymentStatus: true,
            amountDue: true,
            hall: { select: { name: true } },
            createdBy: { select: { name: true } }
          }
        }),
        prisma.event.findMany({
          where: {
            ...tenant(actor),
            deleted: false,
            eventDate: { gte: defaultStart },
            bookingStatus: { in: ["CONFIRMED", "HOLD", "TENTATIVE_HOLD"] },
            ...scoped(actor, "hall")
          },
          select: { id: true, bookingStatus: true }
        }),
        canReadInvoices
          ? prisma.paymentTransaction.findMany({
              where: {
                ...tenant(actor),
                status: "paid",
                processedAt: {
                  gte: start,
                  lt: exclusiveEnd
                }
              },
              select: {
                amountCents: true,
                refundedAmountCents: true,
                processedAt: true
              }
            })
          : Promise.resolve([]),
        canReadInvoices
          ? prisma.paymentRefund.findMany({
              where: {
                ...tenant(actor),
                status: { in: ["PROCESSED", "processed", "paid"] },
                processedAt: {
                  gte: start,
                  lt: exclusiveEnd
                }
              },
              select: {
                amountCents: true,
                processedAt: true
              }
            })
          : Promise.resolve([])
      ]);

    const incomeByDate = new Map<string, number>();
    for (const transaction of paymentTransactions) {
      const date = toDateKey(transaction.processedAt);
      incomeByDate.set(
        date,
        (incomeByDate.get(date) ?? 0) +
          transaction.amountCents -
          transaction.refundedAmountCents
      );
    }

    const expensesByDate = new Map<string, number>();
    for (const refund of paymentRefunds) {
      if (!refund.processedAt) continue;
      const date = toDateKey(refund.processedAt);
      expensesByDate.set(
        date,
        (expensesByDate.get(date) ?? 0) + refund.amountCents
      );
    }

    const bookedEvents = {
      confirmed: upcomingBookedEvents.filter(
        (event) => event.bookingStatus === "CONFIRMED"
      ).length,
      onHold: upcomingBookedEvents.filter(
        (event) => ["HOLD", "TENTATIVE_HOLD"].includes(event.bookingStatus)
      ).length
    };

    return NextResponse.json({
      filters: {
        startDate: toDateKey(start),
        endDate: toDateKey(end)
      },
      summary: {
        totalEvents: events.length,
        bookedEvents: {
          ...bookedEvents,
          total: bookedEvents.confirmed + bookedEvents.onHold
        },
        financial: {
          canView: canReadInvoices,
          incomeCents: [...incomeByDate.values()].reduce(
            (sum, value) => sum + value,
            0
          ),
          expenseCents: [...expensesByDate.values()].reduce(
            (sum, value) => sum + value,
            0
          )
        }
      },
      financialTimeline: buildDailySeries(
        start,
        end,
        incomeByDate,
        expensesByDate
      ),
      events
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
