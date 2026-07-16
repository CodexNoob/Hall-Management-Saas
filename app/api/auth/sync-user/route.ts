import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isAdministrativeRole } from "@/lib/auth/roles";

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

function createOrganizationSlug(name: string, authUserId: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return `${base || "organization"}-${authUserId.slice(0, 8)}`;
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Missing bearer token." },
        { status: 401 }
      );
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user?.email) {
      return NextResponse.json(
        { error: "Invalid Supabase session." },
        { status: 401 }
      );
    }

    const authUserId = data.user.id;
    const authEmail = data.user.email;
    const metadata = data.user.user_metadata;
    const name =
      typeof metadata.full_name === "string" && metadata.full_name.trim()
        ? metadata.full_name.trim()
        : typeof metadata.name === "string" && metadata.name.trim()
          ? metadata.name.trim()
          : authEmail.split("@")[0];
    const phone =
      typeof metadata.phone === "string" && metadata.phone.trim()
        ? metadata.phone.trim()
        : null;
    const venueName =
      typeof metadata.venue_name === "string" && metadata.venue_name.trim()
        ? metadata.venue_name.trim()
        : null;

    const { user, access, memberships } = await prisma.$transaction(
      async (transaction) => {
        const existingUser =
          (await transaction.user.findUnique({
            where: { supabaseAuthId: authUserId }
          })) ??
          (await transaction.user.findUnique({
            where: { email: authEmail }
          }));

        let user;

        if (existingUser) {
          user = await transaction.user.update({
            where: { id: existingUser.id },
            data: {
              supabaseAuthId: authUserId,
              name,
              phone,
              venueName,
              isActive: true
            }
          });
        } else {
          const organizationName = venueName ?? `${name}'s Organization`;
          const organization = await transaction.organization.create({
            data: {
              name: organizationName,
              slug: createOrganizationSlug(organizationName, authUserId)
            }
          });

          user = await transaction.user.create({
            data: {
              organizationId: organization.id,
              supabaseAuthId: authUserId,
              email: authEmail,
              name,
              phone,
              venueName,
              role: "admin"
            }
          });
        }

        const isAdministrator = isAdministrativeRole(user.role);
        const memberViewAccess = {
          canViewHome: true,
          canViewCalendar: true,
          canViewEventManager: true,
          canViewKitchenDashboard: true,
          canViewMenu: true,
          canViewSettings: true,
          canSeeSchoolEvents: true,
          canSeeSimchaEvents: true,
          canViewPaymentInfo: true
        };
        const administratorAccess = {
          ...memberViewAccess,
          canCreateBooking: true,
          canEditMenu: true,
          canEditSettings: true,
          canEditStaff: true,
          canEditVendors: true,
          canEditClients: true,
          canEditFiles: true,
          canAssignWorkers: true,
          canUpdateKitchenStatus: true,
          canAddKitchenEvents: true,
          canManageSchoolSchedule: true,
          canManagePayments: true,
          canSendPaymentEmail: true,
          canUseNiceHomeBackground: true
        };

        await transaction.organizationMembership.upsert({
          where: {
            organizationId_userId: {
              organizationId: user.organizationId,
              userId: user.id
            }
          },
          update: {
            isActive: true,
            ...(isAdministrator ? { role: "owner" } : {})
          },
          create: {
            organizationId: user.organizationId,
            userId: user.id,
            role: isAdministrator ? "owner" : "member"
          }
        });

        const access = await transaction.userAccess.upsert({
          where: {
            organizationId_userId: {
              organizationId: user.organizationId,
              userId: user.id
            }
          },
          update: isAdministrator ? administratorAccess : memberViewAccess,
          create: {
            organizationId: user.organizationId,
            userId: user.id,
            ...memberViewAccess,
            ...(isAdministrator ? administratorAccess : {})
          }
        });

        const memberships = await transaction.organizationMembership.findMany({
          where: {
            userId: user.id,
            isActive: true,
            organization: { isActive: true }
          },
          include: { organization: true },
          orderBy: { createdAt: "asc" }
        });

        return { user, access, memberships };
      }
    );

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        venueName: user.venueName,
        role: user.role,
        organizationId: user.organizationId
      },
      access,
      activeOrganizationId: user.organizationId,
      organizations: memberships.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role
      }))
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to sync the signed-in user."
      },
      { status: 500 }
    );
  }
}
