import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { phoneSchema } from "@/lib/validation/phone";

const schema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  contactName: z.string().trim().max(200).optional(),
  email: z.string().email().nullable().optional(),
  phone: phoneSchema({ label: "Vendor phone" }),
  status: z.enum(["Active", "Inactive"]).optional(),
  notes: z.string().trim().max(2000).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    const actor = await authorize(request, "vendor.manage");
    const { vendorId } = await params;
    const id = z.string().uuid().parse(vendorId);
    const vendor = await prisma.vendor.update({
      where: { id, organizationId: actor.organizationId },
      data: schema.parse(await request.json())
    });
    return NextResponse.json({ vendor });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
