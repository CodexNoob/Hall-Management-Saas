import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { dimensionSchema } from "@/lib/validation/number";
import { phoneSchema } from "@/lib/validation/phone";
import { withRoute } from "@/lib/http/with-route";

const vendorSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  category: z.string().trim().min(1),
  contactName: z.string().trim().optional(),
  email: z.string().email().optional(),
  phone: phoneSchema({ label: "Vendor phone" }),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  rating: dimensionSchema({ min: 0, max: 5, label: "Rating" }).optional(),
  notes: z.string().trim().optional()
});

export const GET = withRoute(
  "GET /api/vendors",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "vendor.read");
      const vendors = await prisma.vendor.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { name: "asc" }
      });
      return NextResponse.json({ vendors });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);

export const POST = withRoute(
  "POST /api/vendors",
  async (request: Request) => {
    try {
      const actor = await authorize(request, "vendor.manage");
      const input = vendorSchema.parse(await request.json());
      const vendor = await prisma.vendor.create({
        data: { organizationId: actor.organizationId, ...input }
      });
      return NextResponse.json({ vendor }, { status: 201 });
    } catch (error) {
      return createApiErrorResponse(error);
    }
  }
);
