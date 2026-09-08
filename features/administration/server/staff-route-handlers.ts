import { NextResponse } from "next/server";
import { z } from "zod";
import { changedFields, recordActivity } from "@/lib/audit/activity-log";
import { authorize, tenant } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { withRoute } from "@/lib/http/with-route";
import { prisma } from "@/lib/prisma";
import { phoneSchema } from "@/lib/validation/phone";
import { getEnv } from "@/lib/env";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  sendStaffInvitations,
  staffInviteRedirectTo
} from "@/features/administration/server/staff-invitations";
import {
  createAssignment,
  listAssignments,
  type AssignmentSummary
} from "@/lib/authz/admin/assignments";
import { createUserPrincipal, ensureStarterRoles } from "@/lib/authz/provision";
import { readEpoch } from "@/lib/authz/admin/roles";
import { loadActorFacts, rankOfPrincipal } from "@/lib/authz/admin/context";
import { writeAudit } from "@/lib/authz/admin/audit";
import { assertRankCeiling, notFound } from "@/lib/authz/guards";

/**
 * PEOPLE, NOT PRIVILEGE.
 *
 * The single most productive change in this design is that `/api/staff` is now
 * two APIs. Before, one endpoint edited a phone number AND assigned a role -
 * which is the API-shaped version of the same conflation `canEditStaff` encoded:
 * the account that can fix a typo in somebody's number was the account that
 * could mint an owner.
 *
 * NOTHING IN THIS FILE CHANGES WHAT ANYONE CAN DO, with exactly one exception:
 * `POST` accepts an optional list of roles for the person being invited, and it
 * DELEGATES them to `createAssignment` - the identical path `/api/access` uses,
 * with the same guards, the same audit rows and the same 403s. One writer per
 * privilege change, no exceptions. There is no branch here that reaches a
 * privilege table on its own.
 *
 * Privileges live under `/api/access/*`.
 */

/** Staff numbers are optional; when given they must be real, stored as E.164. */
const staffPhoneSchema = phoneSchema({ label: "Phone number" });

const inviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().optional(),
    emails: z.array(z.string().trim().toLowerCase()).optional(),
    department: z.string().trim().max(120).optional(),
    phone: z.string().trim().optional(),
    /**
     * Optional, and never required to invite somebody. An invitee with no role
     * is a person who exists and can do nothing yet, which is a perfectly
     * ordinary state and a much better default than guessing.
     */
    roleIds: z.array(z.string().uuid()).optional()
  })
  .transform((input) => ({
    ...input,
    inviteEmails: (
      input.emails?.length ? input.emails : input.email ? [input.email] : []
    ).filter((value) => value.includes("@"))
  }));

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().nullish(),
  department: z.string().trim().max(120).optional(),
  title: z.string().trim().max(120).nullish()
});

export type StaffDirectoryEntry = {
  userId: string;
  principalId: string;
  membershipId: string;
  name: string;
  email: string;
  phone: string | null;
  department: string;
  title: string | null;
  status: "Active" | "Inactive";
  assignments: AssignmentSummary[];
  lastLoginAt: string | null;
  createdAt: string;
};

function inviteStaff(inviteEmails: string[]) {
  const env = getEnv();
  const supabase = createSupabaseServiceClient();

  return sendStaffInvitations(
    supabase.auth.admin,
    inviteEmails,
    staffInviteRedirectTo(env.NEXT_PUBLIC_APP_URL)
  );
}

/**
 * `app/api/staff/route.ts` is a one-line re-export of the two consts below, so
 * the `withRoute` wrapping happens here rather than at the route file: leaving
 * the route a PURE re-export is what keeps it recognisable as one, both to a
 * reader and to `tests/unit/authz-route-coverage.test.ts`, which follows a
 * re-export into this module instead of demanding a guard it cannot see.
 */
async function listStaff(request: Request) {
  try {
    const actor = await authorize(request, "staff.read");

    const memberships = await prisma.organizationMembership.findMany({
      where: tenant(actor),
      select: {
        id: true,
        principalId: true,
        isActive: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            venueName: true,
            title: true,
            lastSignInAt: true
          }
        }
      },
      orderBy: { user: { name: "asc" } }
    });

    // Assignments come along for DISPLAY. The directory shows what people hold;
    // changing it happens under /api/access.
    const assignments = await listAssignments(
      actor.organizationId,
      memberships.map((membership) => membership.principalId)
    );

    const staff: StaffDirectoryEntry[] = memberships.map((membership) => ({
      userId: membership.user.id,
      principalId: membership.principalId,
      membershipId: membership.id,
      name: membership.user.name,
      email: membership.user.email,
      phone: membership.user.phone,
      department: membership.user.venueName ?? "General",
      title: membership.user.title,
      // Membership only. There is no global flag any tenant may write, so one
      // organization's removal can never show this organization's member as
      // Inactive.
      status: membership.isActive ? "Active" : "Inactive",
      assignments: assignments.get(membership.principalId) ?? [],
      lastLoginAt: membership.user.lastSignInAt?.toISOString() ?? null,
      createdAt: membership.createdAt.toISOString()
    }));

    return NextResponse.json({ staff, epoch: actor.epoch });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export const GET = withRoute("GET /api/staff", listStaff);

async function createStaffInvitations(request: Request) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "staff-invite",
      limit: 10,
      windowMs: 10 * 60 * 1000
    });
    if (limited) return limited;

    const actor = await authorize(request, "staff.invite");
    const input = inviteSchema.parse(await request.json().catch(() => ({})));

    if (!input.inviteEmails.length) {
      return NextResponse.json(
        { error: "Enter a valid staff email address." },
        { status: 400 }
      );
    }

    const phone = staffPhoneSchema.parse(input.phone ?? "") ?? null;
    const department = input.department || "General";

    const created = await prisma.$transaction(async (transaction) => {
      // Materialized here so an organization that predates the RBAC migration
      // and has never been seeded still has something to assign.
      await ensureStarterRoles(transaction, actor.organizationId);

      const results: Array<{
        userId: string;
        principalId: string;
        membershipId: string;
        email: string;
        name: string;
        phone: string | null;
        department: string;
        status: "Active" | "Inactive";
        createdAt: Date;
      }> = [];

      for (const inviteEmail of input.inviteEmails) {
        const existingUser = await transaction.user.findUnique({
          where: { email: inviteEmail },
          select: { id: true, name: true, phone: true, venueName: true }
        });

        // The user row is created but never UPDATED from here. It is shared by
        // every organization this person belongs to, so rewriting `name` or
        // `venueName` on an invite let one tenant edit another tenant's view of
        // somebody - and since the invite dialog collects no phone number, it
        // silently wiped theirs.
        const user =
          existingUser ??
          (await transaction.user.create({
            data: {
              organizationId: actor.organizationId,
              email: inviteEmail,
              name: inviteEmail.split("@")[0],
              phone,
              venueName: department
            },
            select: { id: true, name: true, phone: true, venueName: true }
          }));

        const existingMembership =
          await transaction.organizationMembership.findUnique({
            where: {
              organizationId_userId: {
                organizationId: actor.organizationId,
                userId: user.id
              }
            },
            select: { id: true, principalId: true, isActive: true, createdAt: true }
          });

        // Re-inviting somebody who is already here used to be an EDIT wearing an
        // invite's clothes - the old upsert carried `update: { role, isActive:
        // true }`, so POSTing the owner's address at "viewer" walked a demotion
        // straight through the invite path. There is no role in this request any
        // more, and an existing membership is left exactly as it is: reactivating
        // somebody is `staff.deactivate`, and changing what they hold is
        // /api/access.
        const membership =
          existingMembership ??
          (await (async () => {
            const principalId = await createUserPrincipal(
              transaction,
              actor.organizationId
            );

            return transaction.organizationMembership.create({
              data: {
                organizationId: actor.organizationId,
                userId: user.id,
                principalId
              },
              select: {
                id: true,
                principalId: true,
                isActive: true,
                createdAt: true
              }
            });
          })());

        results.push({
          userId: user.id,
          principalId: membership.principalId,
          membershipId: membership.id,
          email: inviteEmail,
          name: user.name || inviteEmail.split("@")[0],
          phone: user.phone,
          department: user.venueName ?? department,
          status: membership.isActive ? "Active" : "Inactive",
          createdAt: membership.createdAt
        });
      }

      const facts = await loadActorFacts(transaction, actor);

      for (const result of results) {
        await writeAudit(transaction, facts, {
          action: "staff.invited",
          subjectPrincipalId: result.principalId,
          subjectName: result.name,
          detail: { email: result.email }
        });
      }

      return results;
    });

    // Assignments go through the ORDINARY path, outside the invite transaction
    // and after it - same guards, same audit rows, same 403s. If the actor turns
    // out not to be allowed to hand out one of these roles, the invite still
    // stands and the assignment does not, which is the correct half to keep.
    const assignmentErrors: string[] = [];

    if (input.roleIds?.length) {
      for (const result of created) {
        for (const roleId of input.roleIds) {
          try {
            await createAssignment(actor, {
              principalId: result.principalId,
              roleId,
              scope: { type: "org" },
              expectedEpoch: null
            });
          } catch (error) {
            assignmentErrors.push(
              error instanceof Error ? error.message : "Assignment failed."
            );
          }
        }
      }
    }

    const invitations = await inviteStaff(input.inviteEmails);

    return NextResponse.json({
      invites: invitations,
      staff: created.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString()
      })),
      ...(assignmentErrors.length
        ? { assignmentErrors: [...new Set(assignmentErrors)] }
        : {}),
      epoch: await readEpoch(actor.organizationId)
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}

export const POST = withRoute("POST /api/staff", createStaffInvitations);

/**
 * Name, phone, department, title.
 *
 * THIS HANDLER HAS NO BRANCH THAT CAN REACH A PRIVILEGE TABLE. That is the point
 * of the split, and it is what makes `staff.update` safe to hand to whoever
 * keeps the directory tidy.
 */
export async function updateStaffProfile(
  request: Request,
  principalId: string
) {
  const actor = await authorize(request, "staff.update");
  const input = updateProfileSchema.parse(await request.json());

  const membership = await prisma.organizationMembership.findFirst({
    where: { principalId, organizationId: actor.organizationId },
    // `user` is read for the activity diff below - the dialog posts every field
    // on every save, so "was it supplied" would record a change that never
    // happened.
    select: {
      id: true,
      userId: true,
      user: {
        select: { name: true, phone: true, venueName: true, title: true }
      }
    }
  });

  if (!membership) throw notFound("That staff member");

  const phone =
    input.phone === undefined
      ? undefined
      : (staffPhoneSchema.parse(input.phone ?? "") ?? null);

  const changes = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(input.department !== undefined ? { venueName: input.department } : {}),
    ...(input.title !== undefined ? { title: input.title || null } : {})
  };
  const moved = changedFields(membership.user, changes);

  const user = await prisma.$transaction(async (transaction) => {
    const saved = await transaction.user.update({
      where: { id: membership.userId },
      data: changes,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        venueName: true,
        title: true
      }
    });

    // FIELD NAMES ONLY. `phone` is in this set and is personal data;
    // `activity_logs` carries no redaction and this row is read back on the
    // Activity screen. The subject is named by `userId` in the payload rather
    // than by their email, for the same reason.
    //
    // Invite, deactivate and restore are NOT recorded here: they write
    // `authorization_audit` rows in the same transaction as the privilege change
    // (INV-7), and the Activity feed unions that table - so an entry here would
    // show each of them twice.
    if (moved.length > 0) {
      await recordActivity(transaction, actor, {
        action: "staff.profile.updated",
        message: `Edited a staff profile: ${moved.join(", ")}.`,
        changed: {
          after: { principalId, userId: membership.userId, fields: moved }
        }
      });
    }

    return saved;
  });

  return NextResponse.json({
    staff: {
      userId: user.id,
      principalId,
      membershipId: membership.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      department: user.venueName ?? "General",
      title: user.title
    }
  });
}

/**
 * Revoke, or restore, one person's access to THIS organization.
 *
 * Flips the membership and nothing else. The global `users.is_active` write this
 * replaced was a platform-wide lockout wearing a tenant-scoped button: a person
 * in organizations A and B removed from A was locked out of B too, with no
 * surface in B able to undo it.
 */
export async function setStaffActive(
  request: Request,
  principalId: string,
  isActive: boolean
) {
  const actor = await authorize(request, "staff.deactivate");

  if (principalId === actor.principalId) {
    return NextResponse.json(
      { error: "You cannot change your own access." },
      { status: 400 }
    );
  }

  return prisma.$transaction(async (transaction) => {
    const membership = await transaction.organizationMembership.findFirst({
      where: { principalId, organizationId: actor.organizationId },
      select: { id: true, user: { select: { name: true } } }
    });

    if (!membership) throw notFound("That staff member");

    const facts = await loadActorFacts(transaction, actor);

    // Suspending somebody is an exercise of authority over them, so the same
    // ceiling that governs assigning them a role governs switching them off.
    assertRankCeiling(
      facts.rank,
      await rankOfPrincipal(transaction, principalId, actor.organizationId),
      "act"
    );

    await transaction.organizationMembership.update({
      where: { id: membership.id },
      data: { isActive }
    });

    await writeAudit(transaction, facts, {
      action: isActive ? "staff.restored" : "staff.deactivated",
      subjectPrincipalId: principalId,
      subjectName: membership.user.name
    });

    return NextResponse.json({ ok: true });
  });
}
