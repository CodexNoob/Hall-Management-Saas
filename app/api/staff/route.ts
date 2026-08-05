import { NextResponse } from "next/server";
import {
  requireAnyPermission,
  requirePermission
} from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";

const roleAccess = {
  owner: {
    canViewHome: true,
    canViewCalendar: true,
    canCreateBooking: true,
    canViewEventManager: true,
    canViewKitchenDashboard: true,
    canViewMenu: true,
    canEditMenu: true,
    canViewSettings: true,
    canEditSettings: true,
    canEditStaff: true,
    canEditVendors: true,
    canEditClients: true,
    canEditFiles: true,
    canAssignWorkers: true,
    canUpdateKitchenStatus: true,
    canAddKitchenEvents: true,
    canManageSchoolSchedule: true,
    canSeeSchoolEvents: true,
    canSeeSimchaEvents: true,
    canViewPaymentInfo: true,
    canManagePayments: true,
    canSendPaymentEmail: true,
    canUseNiceHomeBackground: true
  },
  admin: {
    canViewHome: true,
    canViewCalendar: true,
    canCreateBooking: true,
    canViewEventManager: true,
    canViewKitchenDashboard: true,
    canViewMenu: true,
    canEditMenu: true,
    canViewSettings: true,
    canEditSettings: true,
    canEditStaff: true,
    canEditVendors: true,
    canEditClients: true,
    canEditFiles: true,
    canAssignWorkers: true,
    canUpdateKitchenStatus: true,
    canAddKitchenEvents: true,
    canManageSchoolSchedule: true,
    canSeeSchoolEvents: true,
    canSeeSimchaEvents: true,
    canViewPaymentInfo: true,
    canManagePayments: true,
    canSendPaymentEmail: true,
    canUseNiceHomeBackground: true
  },
  manager: {
    canViewHome: true,
    canViewCalendar: true,
    canCreateBooking: true,
    canViewEventManager: true,
    canViewKitchenDashboard: true,
    canViewMenu: true,
    canEditMenu: true,
    canViewSettings: false,
    canEditSettings: false,
    canEditStaff: false,
    canEditVendors: true,
    canEditClients: true,
    canEditFiles: true,
    canAssignWorkers: true,
    canUpdateKitchenStatus: true,
    canAddKitchenEvents: true,
    canManageSchoolSchedule: true,
    canSeeSchoolEvents: true,
    canSeeSimchaEvents: true,
    canViewPaymentInfo: true,
    canManagePayments: false,
    canSendPaymentEmail: false,
    canUseNiceHomeBackground: false
  },
  kitchen: {
    canViewHome: true,
    canViewCalendar: true,
    canCreateBooking: false,
    canViewEventManager: false,
    canViewKitchenDashboard: true,
    canViewMenu: true,
    canEditMenu: false,
    canViewSettings: false,
    canEditSettings: false,
    canEditStaff: false,
    canEditVendors: false,
    canEditClients: false,
    canEditFiles: false,
    canAssignWorkers: true,
    canUpdateKitchenStatus: true,
    canAddKitchenEvents: true,
    canManageSchoolSchedule: false,
    canSeeSchoolEvents: false,
    canSeeSimchaEvents: true,
    canViewPaymentInfo: false,
    canManagePayments: false,
    canSendPaymentEmail: false,
    canUseNiceHomeBackground: false
  },
  billing: {
    canViewHome: true,
    canViewCalendar: true,
    canCreateBooking: false,
    canViewEventManager: true,
    canViewKitchenDashboard: false,
    canViewMenu: false,
    canEditMenu: false,
    canViewSettings: false,
    canEditSettings: false,
    canEditStaff: false,
    canEditVendors: false,
    canEditClients: true,
    canEditFiles: true,
    canAssignWorkers: false,
    canUpdateKitchenStatus: false,
    canAddKitchenEvents: false,
    canManageSchoolSchedule: false,
    canSeeSchoolEvents: false,
    canSeeSimchaEvents: true,
    canViewPaymentInfo: true,
    canManagePayments: true,
    canSendPaymentEmail: true,
    canUseNiceHomeBackground: false
  },
  viewer: {
    canViewHome: true,
    canViewCalendar: true,
    canCreateBooking: false,
    canViewEventManager: true,
    canViewKitchenDashboard: true,
    canViewMenu: true,
    canEditMenu: false,
    canViewSettings: false,
    canEditSettings: false,
    canEditStaff: false,
    canEditVendors: false,
    canEditClients: false,
    canEditFiles: false,
    canAssignWorkers: false,
    canUpdateKitchenStatus: false,
    canAddKitchenEvents: false,
    canManageSchoolSchedule: false,
    canSeeSchoolEvents: false,
    canSeeSimchaEvents: true,
    canViewPaymentInfo: false,
    canManagePayments: false,
    canSendPaymentEmail: false,
    canUseNiceHomeBackground: false
  }
} as const;

type StaffRole = keyof typeof roleAccess;

function normalizeStaffRole(value: unknown): StaffRole {
  const role = String(value ?? "viewer").toLowerCase().trim();

  if (role === "administrator") return "admin";
  if (role === "event manager") return "manager";
  if (role === "kitchen staff") return "kitchen";
  if (role === "billing staff") return "billing";

  return role in roleAccess ? (role as StaffRole) : "viewer";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function accessForRole(role: StaffRole) {
  return roleAccess[role];
}

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

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "canEditStaff");
    const input = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const email = cleanText(input?.email).toLowerCase();
    const emails = Array.isArray(input?.emails)
      ? input.emails
          .map((value) => cleanText(value).toLowerCase())
          .filter((value) => value && value.includes("@"))
      : [];
    const inviteEmails = emails.length ? emails : email ? [email] : [];
    const phone = cleanText(input?.phone) || null;
    const department = cleanText(input?.department) || "General";
    const role = normalizeStaffRole(input?.role);

    if (!inviteEmails.length) {
      return NextResponse.json(
        { error: "Enter a valid staff Gmail or email address." },
        { status: 400 }
      );
    }

    const createdStaff = await prisma.$transaction(async (transaction) => {
      const results: Array<{
        id: string;
        email: string;
        name: string;
        phone: string | null;
        department: string;
        role: string;
        status: "Active" | "Inactive";
        membershipId: string;
        createdAt: Date;
      }> = [];

      for (const inviteEmail of inviteEmails) {
        const existingUser = await transaction.user.findUnique({
          where: { email: inviteEmail }
        });
        const user =
          existingUser ??
          (await transaction.user.create({
            data: {
              organizationId: actor.organizationId,
              email: inviteEmail,
              name: inviteEmail.split("@")[0],
              phone,
              venueName: department,
              role,
              isActive: true
            }
          }));

        const updatedUser = await transaction.user.update({
          where: { id: user.id },
          data: {
            name: user.name || inviteEmail.split("@")[0],
            phone,
            venueName: department,
            role,
            isActive: true
          }
        });

        const membership = await transaction.organizationMembership.upsert({
          where: {
            organizationId_userId: {
              organizationId: actor.organizationId,
              userId: updatedUser.id
            }
          },
          update: { role, isActive: true },
          create: {
            organizationId: actor.organizationId,
            userId: updatedUser.id,
            role,
            isActive: true
          }
        });

        await transaction.userAccess.upsert({
          where: {
            organizationId_userId: {
              organizationId: actor.organizationId,
              userId: updatedUser.id
            }
          },
          update: accessForRole(role),
          create: {
            organizationId: actor.organizationId,
            userId: updatedUser.id,
            ...accessForRole(role)
          }
        });

        results.push({
          id: updatedUser.id,
          email: inviteEmail,
          name: updatedUser.name || inviteEmail.split("@")[0],
          phone: updatedUser.phone,
          department: updatedUser.venueName ?? department,
          role: updatedUser.role,
          status: updatedUser.isActive && membership.isActive ? "Active" : "Inactive",
          membershipId: membership.id,
          createdAt: membership.createdAt
        });
      }

      return results;
    });

    return NextResponse.json({
      staff: createdStaff.map((item) => ({
        id: item.id,
        membershipId: item.membershipId,
        name: item.name,
        email: item.email,
        phone: item.phone,
        department: item.department,
        role: item.role,
        status: item.status,
        access: null,
        createdAt: item.createdAt
      }))
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requirePermission(request, "canEditStaff");
    const input = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const id = cleanText(input?.id);

    if (!id) {
      return NextResponse.json(
        { error: "Staff member is required." },
        { status: 400 }
      );
    }

    const role = input?.role ? normalizeStaffRole(input.role) : null;
    const status = cleanText(input?.status);
    const userUpdates: {
      name?: string;
      phone?: string | null;
      venueName?: string;
      role?: StaffRole;
      isActive?: boolean;
    } = {};

    const name = cleanText(input?.name);
    const phone = cleanText(input?.phone);
    const department = cleanText(input?.department);

    if (name) userUpdates.name = name;
    if (input && "phone" in input) userUpdates.phone = phone || null;
    if (department) userUpdates.venueName = department;
    if (role) userUpdates.role = role;
    if (status === "Active") userUpdates.isActive = true;
    if (status === "Inactive") userUpdates.isActive = false;

    const staff = await prisma.$transaction(async (transaction) => {
      const membership = await transaction.organizationMembership.findFirst({
        where: { organizationId: actor.organizationId, userId: id }
      });

      if (!membership) {
        throw new Error("Staff member was not found in this organization.");
      }

      const updatedMembership = await transaction.organizationMembership.update({
        where: { id: membership.id },
        data: {
          ...(role ? { role } : {}),
          ...(status === "Active" ? { isActive: true } : {}),
          ...(status === "Inactive" ? { isActive: false } : {})
        }
      });

      const updatedUser = await transaction.user.update({
        where: { id },
        data: userUpdates
      });

      const access = role
        ? await transaction.userAccess.upsert({
            where: {
              organizationId_userId: {
                organizationId: actor.organizationId,
                userId: id
              }
            },
            update: accessForRole(role),
            create: {
              organizationId: actor.organizationId,
              userId: id,
              ...accessForRole(role)
            }
          })
        : await transaction.userAccess.findUnique({
            where: {
              organizationId_userId: {
                organizationId: actor.organizationId,
                userId: id
              }
            }
          });

      return { user: updatedUser, membership: updatedMembership, access };
    });

    return NextResponse.json({
      staff: {
        id: staff.user.id,
        membershipId: staff.membership.id,
        name: staff.user.name,
        email: staff.user.email,
        phone: staff.user.phone,
        department: staff.user.venueName ?? "General",
        role: staff.membership.role,
        status:
          staff.user.isActive && staff.membership.isActive
            ? "Active"
            : "Inactive",
        access: staff.access,
        createdAt: staff.membership.createdAt
      }
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requirePermission(request, "canEditStaff");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Staff member is required." },
        { status: 400 }
      );
    }

    await prisma.organizationMembership.updateMany({
      where: { organizationId: actor.organizationId, userId: id },
      data: { isActive: false }
    });

    await prisma.user.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
