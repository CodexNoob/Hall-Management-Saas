import { NextResponse } from "next/server";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http/with-route";

export const GET = withRoute(
  "GET /api/billing/reports",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "report.read");
      const [invoices, payments, refunds] = await Promise.all([
        prisma.invoice.findMany({
          where: { organizationId: actor.organizationId },
          select: {
            status: true,
            dueDate: true,
            totalCents: true,
            amountPaidCents: true,
            balanceDueCents: true
          }
        }),
        prisma.paymentTransaction.aggregate({
          where: { organizationId: actor.organizationId, status: "paid" },
          _sum: { amountCents: true, refundedAmountCents: true }
        }),
        prisma.paymentRefund.aggregate({
          where: {
            organizationId: actor.organizationId,
            status: { in: ["SUCCEEDED", "succeeded"] }
          },
          _sum: { amountCents: true }
        })
      ]);
      const now = Date.now();
      const aging = { current: 0, days30: 0, days60: 0, days90Plus: 0 };
      for (const invoice of invoices) {
        if (invoice.balanceDueCents <= 0) continue;
        const days = invoice.dueDate
          ? Math.floor((now - invoice.dueDate.getTime()) / 86_400_000)
          : 0;
        if (days <= 0) aging.current += invoice.balanceDueCents;
        else if (days <= 30) aging.days30 += invoice.balanceDueCents;
        else if (days <= 60) aging.days60 += invoice.balanceDueCents;
        else aging.days90Plus += invoice.balanceDueCents;
      }
      return NextResponse.json({
        revenueCents:
          (payments._sum.amountCents ?? 0) -
          (payments._sum.refundedAmountCents ?? 0),
        refundedCents: refunds._sum.amountCents ?? 0,
        outstandingCents: invoices.reduce(
          (sum, item) => sum + item.balanceDueCents,
          0
        ),
        invoiceCounts: Object.fromEntries(
          invoices
            .map((item) => item.status)
            .filter((value, index, all) => all.indexOf(value) === index)
            .map((status) => [
              status,
              invoices.filter((item) => item.status === status).length
            ])
        ),
        aging
      });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
