import { NextResponse } from "next/server";
import {
  requireAnyPermission,
  requirePermission
} from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { isAdministrativeRole } from "@/lib/auth/roles";
import {
  accessPermissionKeys,
  accessForRole,
  normalizeStaffRole,
  permissionColumns,
  roleAccess,
  roleTemplates,
  staffRoleValues,
  type RoleAccessMatrix,
  type StaffRoleValue
} from "@/lib/auth/permissions";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function canCustomizeStaffPermissions(
  actor: Awaited<ReturnType<typeof requireAnyPermission>>
) {
  return isAdministrativeRole(actor.membership.role);
}

function cleanAccessPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as Record<string, unknown>;
  return accessPermissionKeys.reduce(
    (access, key) => ({
      ...access,
      [key]: input[key] === true
    }),
    {} as RoleAccessMatrix
  );
}

function cleanRoleAccessOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as Record<string, unknown>;
  return staffRoleValues.reduce(
    (roles, role) => {
      const access = cleanAccessPayload(input[role]);
      roles[role] = access ?? roleAccess[role];
      return roles;
    },
    {} as Record<StaffRoleValue, RoleAccessMatrix>
  );
}

function getRoleAccessOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const integrations = value as Record<string, unknown>;
  return cleanRoleAccessOverrides(integrations.roleAccessOverrides);
}

function mergeIntegrationsWithRoleAccess(
  current: unknown,
  roleAccessOverrides: Record<StaffRoleValue, RoleAccessMatrix>
) {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};

  return {
    ...base,
    roleAccessOverrides
  };
}

export async function GET(request: Request) {
  try {
    const actor = await requireAnyPermission(request, [
      "canEditStaff",
      "canViewSettings",
      "canEditSettings"
    ]);
    const [memberships, organizationSettings] = await Promise.all([
      prisma.organizationMembership.findMany({
        where: { organizationId: actor.organizationId },
        include: {
          user: {
            include: {
              access: { where: { organizationId: actor.organizationId } }
            }
          }
        },
        orderBy: { user: { name: "asc" } }
      }),
      prisma.organizationSetting.findUnique({
        where: { organizationId: actor.organizationId },
        select: { integrations: true }
      })
    ]);

    const roleAccessOverrides =
      getRoleAccessOverrides(organizationSettings?.integrations) ?? roleAccess;

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
      })),
      matrix: {
        roles: roleTemplates,
        columns: permissionColumns,
        access: roleAccessOverrides
      },
      canCustomizePermissions: canCustomizeStaffPermissions(actor)
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
        access: Awaited<ReturnType<typeof transaction.userAccess.upsert>>;
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

        const access = await transaction.userAccess.upsert({
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
          createdAt: membership.createdAt,
          access
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
        access: item.access,
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
    const roleAccessOverrides = cleanRoleAccessOverrides(
      input?.roleAccessOverrides
    );

    if (roleAccessOverrides) {
      if (!canCustomizeStaffPermissions(actor)) {
        return NextResponse.json(
          {
            error:
              "Only an admin or organization owner can customize staff permissions."
          },
          { status: 403 }
        );
      }

      await prisma.$transaction(async (transaction) => {
        const currentSettings = await transaction.organizationSetting.findUnique({
          where: { organizationId: actor.organizationId },
          select: { integrations: true }
        });

        await transaction.organizationSetting.upsert({
          where: { organizationId: actor.organizationId },
          update: {
            integrations: mergeIntegrationsWithRoleAccess(
              currentSettings?.integrations,
              roleAccessOverrides
            )
          },
          create: {
            organizationId: actor.organizationId,
            integrations: mergeIntegrationsWithRoleAccess(
              null,
              roleAccessOverrides
            )
          }
        });

        const memberships = await transaction.organizationMembership.findMany({
          where: { organizationId: actor.organizationId },
          select: { userId: true, role: true }
        });

        for (const membership of memberships) {
          const normalizedRole = normalizeStaffRole(membership.role);
          const accessData = roleAccessOverrides[normalizedRole];

          await transaction.userAccess.upsert({
            where: {
              organizationId_userId: {
                organizationId: actor.organizationId,
                userId: membership.userId
              }
            },
            update: accessData,
            create: {
              organizationId: actor.organizationId,
              userId: membership.userId,
              ...accessData
            }
          });
        }
      });

      return NextResponse.json({
        matrix: {
          roles: roleTemplates,
          columns: permissionColumns,
          access: roleAccessOverrides
        }
      });
    }

    if (!id) {
      return NextResponse.json(
        { error: "Staff member is required." },
        { status: 400 }
      );
    }

    const role = input?.role ? normalizeStaffRole(input.role) : null;
    const customAccess = cleanAccessPayload(input?.access);
    const status = cleanText(input?.status);

    if (id === actor.id && status === "Inactive") {
      return NextResponse.json(
        { error: "You cannot deactivate your own staff access." },
        { status: 400 }
      );
    }

    if (customAccess && !canCustomizeStaffPermissions(actor)) {
      return NextResponse.json(
        {
          error:
            "Only an admin or organization owner can customize staff permissions."
        },
        { status: 403 }
      );
    }

    if (id === actor.id && customAccess?.canEditStaff === false) {
      return NextResponse.json(
        { error: "You cannot remove your own staff management permission." },
        { status: 400 }
      );
    }

    const userUpdates: {
      name?: string;
      phone?: string | null;
      venueName?: string;
      role?: StaffRoleValue;
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

      const accessData = customAccess ?? (role ? accessForRole(role) : null);
      const access = accessData
        ? await transaction.userAccess.upsert({
            where: {
              organizationId_userId: {
                organizationId: actor.organizationId,
                userId: id
              }
            },
            update: accessData,
            create: {
              organizationId: actor.organizationId,
              userId: id,
              ...accessData
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

    if (id === actor.id) {
      return NextResponse.json(
        { error: "You cannot remove your own staff access." },
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
