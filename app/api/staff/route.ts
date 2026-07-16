import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const actor = await requireAnyPermission(request, [
      "canViewSettings",
      "canEditSettings"
    ]);
    const memberships = await prisma.organizationMembership.findMany({
      where: { organizationId: actor.organizationId },
      include: {
        user: {
          include: {
            access: { where: { organizationId: actor.organizationId } }
          }
        }
      },
      orderBy: { user: { name: "asc" } }
    });

    return NextResponse.json({
      staff: memberships.map((membership) => ({
        id: membership.user.id,
        membershipId: membership.id,
        name: membership.user.name,
        email: membership.user.email,
        phone: membership.user.phone,
        department: membership.user.venueName ?? "General",
        role: membership.role,
        status:
          membership.user.isActive && membership.isActive
            ? "Active"
            : "Inactive",
        access: membership.user.access[0] ?? null,
        createdAt: membership.createdAt
      }))
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
