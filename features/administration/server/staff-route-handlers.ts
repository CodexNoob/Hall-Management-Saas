import { NextResponse } from "next/server";
import {
  requireAnyPermission,
  requirePermission
} from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { formatZodErrorMessage } from "@/lib/http/zod-error-message";
import { prisma } from "@/lib/prisma";
import { phoneSchema } from "@/lib/validation/phone";
import { isAdministrativeRole } from "@/lib/auth/roles";
import { AuthorizationError } from "@/lib/auth/errors";
import {
  assertAssignableRole,
  assertCanManageMember,
  assertNotSelfRoleChange
} from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  sendStaffInvitations,
  staffInviteRedirectTo
} from "@/features/administration/server/staff-invitations";
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

/** Staff numbers are optional; when given they must be real, stored as E.164. */
const staffPhoneSchema = phoneSchema({ label: "Phone number" });

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

function inviteStaff(inviteEmails: string[]) {
  const env = getEnv();
  const supabase = createSupabaseServiceClient();

  return sendStaffInvitations(
    supabase.auth.admin,
    inviteEmails,
    staffInviteRedirectTo(env.NEXT_PUBLIC_APP_URL)
  );
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
              access: { where: { organizationId: actor.organizationId } },
              activityLogs: {
                where: {
                  organizationId: actor.organizationId,
                  actionType: "auth.login.success"
                },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true },
                take: 1
              }
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
        // Membership only. `users.is_active` is a global column no tenant may
        // write any more, so folding it in here would let one organization's
        // removal show this organization's member as Inactive forever.
        status: membership.isActive ? "Active" : "Inactive",
        access: membership.user.access[0] ?? null,
        lastLoginAt:
          membership.user.activityLogs[0]?.createdAt.toISOString() ?? null,
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
    const limited = await enforceRateLimit(request, {
      scope: "staff-invite",
      limit: 10,
      windowMs: 10 * 60 * 1000
    });
    if (limited) return limited;

    const actor = await requirePermission(request, "canEditStaff");
    const input = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const email = cleanText(input?.email).toLowerCase();
    const emails = Array.isArray(input?.emails)
      ? input.emails
          .map((value) => cleanText(value).toLowerCase())
          .filter((value) => value && value.includes("@"))
      : [];
    const inviteEmails = emails.length ? emails : email ? [email] : [];
    const department = cleanText(input?.department) || "General";
    const role = normalizeStaffRole(input?.role);

    if (!inviteEmails.length) {
      return NextResponse.json(
        { error: "Enter a valid staff Gmail or email address." },
        { status: 400 }
      );
    }

    // This handler predates Zod and still parses its body by hand, so the
    // shared schema is applied to the one field that needs it.
    const parsedPhone = staffPhoneSchema.safeParse(cleanText(input?.phone));

    if (!parsedPhone.success) {
      return NextResponse.json(
        { error: formatZodErrorMessage(parsedPhone.error.flatten()) },
        { status: 400 }
      );
    }

    const phone = parsedPhone.data ?? null;

    assertAssignableRole(actor.membership.role, role);

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

        // Re-inviting somebody who is already here is an EDIT, not an invite -
        // the upsert below carries `update: { role, isActive: true }`. Without
        // this check invite is a demotion primitive: POST the owner's address
        // at "viewer" and it walks straight through the invite path.
        const existingMembership = existingUser
          ? await transaction.organizationMembership.findUnique({
              where: {
                organizationId_userId: {
                  organizationId: actor.organizationId,
                  userId: existingUser.id
                }
              }
            })
          : null;

        if (existingMembership) {
          assertCanManageMember(actor.membership.role, existingMembership.role);
        }

        // `role` is written on create only, as a NOT NULL placeholder the column
        // demands - never as an authority. The update that used to follow this
        // rewrote `name`, `venueName` and `role` on a row shared by every
        // organization the person belongs to, forced `isActive: true` so any
        // tenant could reinstate someone another tenant had removed, and - since
        // the invite dialog collects no phone number - silently wiped `phone`.
        const user =
          existingUser ??
          (await transaction.user.create({
            data: {
              organizationId: actor.organizationId,
              email: inviteEmail,
              name: inviteEmail.split("@")[0],
              phone,
              venueName: department,
              role: "member",
              isActive: true
            }
          }));

        const membership = await transaction.organizationMembership.upsert({
          where: {
            organizationId_userId: {
              organizationId: actor.organizationId,
              userId: user.id
            }
          },
          update: { role, isActive: true },
          create: {
            organizationId: actor.organizationId,
            userId: user.id,
            role,
            isActive: true
          }
        });

        const access = await transaction.userAccess.upsert({
          where: {
            organizationId_userId: {
              organizationId: actor.organizationId,
              userId: user.id
            }
          },
          update: accessForRole(role),
          create: {
            organizationId: actor.organizationId,
            userId: user.id,
            ...accessForRole(role)
          }
        });

        results.push({
          id: user.id,
          email: inviteEmail,
          name: user.name || inviteEmail.split("@")[0],
          phone: user.phone,
          department: user.venueName ?? department,
          role: membership.role,
          status: membership.isActive ? "Active" : "Inactive",
          membershipId: membership.id,
          createdAt: membership.createdAt,
          access
        });
      }

      return results;
    });
    const invitations = await inviteStaff(inviteEmails);

    return NextResponse.json({
      invites: invitations,
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
    const input = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
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
        const currentSettings =
          await transaction.organizationSetting.findUnique({
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
    } = {};

    const name = cleanText(input?.name);
    const department = cleanText(input?.department);

    // Only validated when the request actually carries a phone. Checking it
    // unconditionally would block someone editing a colleague's department on
    // a record whose number was saved loosely before this rule existed.
    const parsedPhone =
      input && "phone" in input
        ? staffPhoneSchema.safeParse(cleanText(input.phone))
        : null;

    if (parsedPhone && !parsedPhone.success) {
      return NextResponse.json(
        { error: formatZodErrorMessage(parsedPhone.error.flatten()) },
        { status: 400 }
      );
    }

    if (name) userUpdates.name = name;
    if (parsedPhone) userUpdates.phone = parsedPhone.data ?? null;
    if (department) userUpdates.venueName = department;

    const staff = await prisma.$transaction(async (transaction) => {
      // `include: { user: true }` is load-bearing. The Assign-role submission
      // posts `{ id, role }` only, so `userUpdates` is empty and the response
      // falls back to this row - without it the dialog receives
      // `staff.user.id === undefined` and breaks on a 200.
      const membership = await transaction.organizationMembership.findFirst({
        where: { organizationId: actor.organizationId, userId: id },
        include: { user: true }
      });

      if (!membership) {
        throw new AuthorizationError(
          404,
          "Staff member was not found in this organization."
        );
      }

      // The edit dialog posts `role` on EVERY save, including one that only
      // touched a phone number. "Carried a role" is not "changed the role", and
      // guarding on the former would 403 half of legitimate traffic.
      const roleChanged =
        role !== null && role !== normalizeStaffRole(membership.role);
      const statusChanged = status === "Active" || status === "Inactive";

      // Suspending or restoring somebody is an exercise of authority over them,
      // so the target check applies to status transitions too.
      if (roleChanged || statusChanged) {
        assertCanManageMember(actor.membership.role, membership.role);
      }

      if (roleChanged) {
        assertNotSelfRoleChange(actor.id, id);
        assertAssignableRole(actor.membership.role, role);
      }

      const updatedMembership = await transaction.organizationMembership.update(
        {
          where: { id: membership.id },
          data: {
            ...(roleChanged && role ? { role } : {}),
            ...(status === "Active" ? { isActive: true } : {}),
            ...(status === "Inactive" ? { isActive: false } : {})
          }
        }
      );

      // `role` and `isActive` are deliberately absent from `userUpdates`: both
      // are global columns on a row shared across every organization this person
      // belongs to. Membership carries the per-tenant answer for each.
      const updatedUser =
        Object.keys(userUpdates).length > 0
          ? await transaction.user.update({ where: { id }, data: userUpdates })
          : membership.user;

      const accessData =
        customAccess ?? (roleChanged && role ? accessForRole(role) : null);
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
        status: staff.membership.isActive ? "Active" : "Inactive",
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

    // Read first, so removing somebody who is not in this organization is a 404
    // rather than a silent `updateMany` no-op followed by a global write. The
    // old pair let any `canEditStaff` holder in any tenant disable any account
    // platform-wide just by supplying its UUID.
    const membership = await prisma.organizationMembership.findFirst({
      where: { organizationId: actor.organizationId, userId: id }
    });

    if (!membership) {
      throw new AuthorizationError(
        404,
        "Staff member was not found in this organization."
      );
    }

    assertCanManageMember(actor.membership.role, membership.role);

    // The global `users.is_active` write is dropped rather than scoped.
    // Scoping would remove "any user in the database" but keep "global effect":
    // `requireAuthenticatedUser` and `ensureProvisionedUser` both reject on
    // `user.isActive` BEFORE consulting any membership, so a person in orgs A
    // and B removed from A was locked out of B too, with no surface in B able
    // to undo it. Deactivating the membership is already a complete lockout,
    // and it is what the UI promises.
    await prisma.organizationMembership.update({
      where: { id: membership.id },
      data: { isActive: false }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
