import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { countSchema, dimensionSchema } from "@/lib/validation/number";
import { withRoute } from "@/lib/http/with-route";

const createShapeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  shapeType: z.enum(["round-table", "rect-table"]),
  width: dimensionSchema({ min: 10, max: 5_000, label: "Width" }),
  height: dimensionSchema({ min: 10, max: 5_000, label: "Height" }),
  seats: countSchema({ max: 1_000, label: "Seats" })
});

function formatShapeLibraryItem(row: {
  id: string;
  name: string;
  shapeType: string;
  width: number;
  height: number;
  seats: number;
}) {
  return {
    id: row.id,
    name: row.name,
    shapeType:
      row.shapeType === "round-table" ? "round-table" : "rect-table",
    width: row.width,
    height: row.height,
    seats: row.seats
  };
}

function createShapeLibraryErrorResponse(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return NextResponse.json(
      { error: "A shape with this name already exists." },
      { status: 409 }
    );
  }

  return createApiErrorResponse(error);
}

export const GET = withRoute(
  "GET /api/hall-map-shapes",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "hallmap.read");
      const shapes = await prisma.hallMapShapeLibraryItem.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }]
      });

      return NextResponse.json({
        shapeLibrary: shapes.map(formatShapeLibraryItem)
      });
    } catch (error) {
      return createShapeLibraryErrorResponse(error);
    }
  }
);

export const POST = withRoute(
  "POST /api/hall-map-shapes",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "hallmap.update");
      const input = createShapeSchema.parse(await request.json());
      const created = await prisma.hallMapShapeLibraryItem.create({
        data: {
          organizationId: actor.organizationId,
          name: input.name,
          shapeType: input.shapeType,
          width: input.width,
          height: input.height,
          seats: input.seats
        }
      });

      return NextResponse.json(
        { shape: formatShapeLibraryItem(created) },
        { status: 201 }
      );
    } catch (error) {
      return createShapeLibraryErrorResponse(error);
    }
  }
);
