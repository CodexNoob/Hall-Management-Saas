import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, tenant } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

/**
 * The privilege-change audit trail, filterable and exportable.
 *
 * AN AUDIT TABLE NOBODY CAN READ IS STORAGE, NOT A CONTROL. The CSV export is
 * not a nicety either - an export is what a security questionnaire actually asks
 * to see, and building it later means building it under deadline.
 */

const PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 10_000;

const querySchema = z.object({
  actorId: z.string().uuid().optional(),
  subjectPrincipalId: z.string().uuid().optional(),
  action: z.string().trim().max(60).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  format: z.enum(["json", "csv"]).default("json"),
  cursor: z.string().uuid().optional()
});

/** RFC 4180: double the quotes, wrap anything with a comma, quote or newline. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = typeof value === "string" ? value : JSON.stringify(value);

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request) {
  try {
    const actor = await authorize(request, "audit.read");
    const query = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams)
    );

    const where = {
      ...tenant(actor),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.subjectPrincipalId
        ? { subjectPrincipalId: query.subjectPrincipalId }
        : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {})
            }
          }
        : {})
    };

    const rows = await prisma.authorizationAudit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.format === "csv" ? MAX_EXPORT_ROWS : PAGE_SIZE + 1,
      ...(query.cursor
        ? { cursor: { id: query.cursor }, skip: 1 }
        : {}),
      select: {
        id: true,
        createdAt: true,
        action: true,
        actorId: true,
        actorName: true,
        subjectPrincipalId: true,
        subjectName: true,
        detail: true
      }
    });

    if (query.format === "csv") {
      const header = [
        "created_at",
        "action",
        "actor_name",
        "subject_name",
        "detail"
      ];
      const body = rows.map((row) =>
        [
          row.createdAt.toISOString(),
          row.action,
          row.actorName,
          row.subjectName,
          row.detail
        ]
          .map(csvCell)
          .join(",")
      );

      // Truncation is announced rather than silent: a report that quietly stops
      // at ten thousand rows reads as "this is everything" when it is not.
      if (rows.length === MAX_EXPORT_ROWS) {
        body.push(
          csvCell(
            `TRUNCATED at ${MAX_EXPORT_ROWS} rows. Narrow the date range to export the rest.`
          )
        );
      }

      return new NextResponse([header.join(","), ...body].join("\n"), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="authorization-audit-${actor.organization.slug}.csv"`
        }
      });
    }

    const page = rows.slice(0, PAGE_SIZE);

    return NextResponse.json({
      entries: page.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString()
      })),
      nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
      epoch: actor.epoch
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
