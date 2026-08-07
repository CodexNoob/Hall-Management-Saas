import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseTokenVerifier } from "@/lib/supabase/server";
import { isAdministrativeRole } from "@/lib/auth/roles";
import { accessForRole, normalizeStaffRole } from "@/lib/auth/permissions";
import { getTrialDates, isTesterBypassEmail } from "@/lib/subscription/trial";
import { createActivityLog } from "@/lib/audit/activity-log";
import { enforceRateLimit } from "@/lib/security/rate-limit";

class InvitationRequiredError extends Error {
  constructor() {
    super(
      "No employee account was found for this email. Ask your organization administrator for an invitation."
    );
    this.name = "InvitationRequiredError";
  }
}

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
    const limited = await enforceRateLimit(request, {
      scope: "auth-sync-user",
      limit: 30,
      windowMs: 10 * 60 * 1000
    });
    if (limited) return limited;

    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Missing bearer token." },
        { status: 401 }
      );
    }

    const supabase = createSupabaseTokenVerifier();
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
    const accountType =
      typeof metadata.account_type === "string"
        ? metadata.account_type.trim()
        : null;
    const isPermanentTester = isTesterBypassEmail(authEmail);

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
          if (accountType !== "organization_owner") {
            throw new InvitationRequiredError();
          }

          const organizationName = venueName ?? `${name}'s Organization`;
          const { trialStartedAt, trialEndsAt } = getTrialDates();
          const organization = await transaction.organization.create({
            data: {
              name: organizationName,
              slug: createOrganizationSlug(organizationName, authUserId),
              subscriptionStatus: isPermanentTester ? "active" : "trialing",
              trialStartedAt: isPermanentTester ? null : trialStartedAt,
              trialEndsAt: isPermanentTester ? null : trialEndsAt,
              subscriptionStartedAt: isPermanentTester ? new Date() : null
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

        if (isPermanentTester) {
          await transaction.organization.update({
            where: { id: user.organizationId },
            data: {
              subscriptionStatus: "active",
              trialStartedAt: null,
              trialEndsAt: null,
              subscriptionStartedAt: new Date()
            }
          });
        }

        const isAdministrator = isAdministrativeRole(user.role);
        const resolvedRole = isAdministrator
          ? "owner"
          : normalizeStaffRole(user.role);
        const resolvedAccess = accessForRole(resolvedRole);

        await transaction.organizationMembership.upsert({
          where: {
            organizationId_userId: {
              organizationId: user.organizationId,
              userId: user.id
            }
          },
          update: {
            isActive: true,
            role: resolvedRole
          },
          create: {
            organizationId: user.organizationId,
            userId: user.id,
            role: resolvedRole
          }
        });

        const access = await transaction.userAccess.upsert({
          where: {
            organizationId_userId: {
              organizationId: user.organizationId,
              userId: user.id
            }
          },
          update: resolvedAccess,
          create: {
            organizationId: user.organizationId,
            userId: user.id,
            ...resolvedAccess
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

        await createActivityLog(transaction, {
          organizationId: user.organizationId,
          userId: user.id,
          userName: user.name,
          actionType: "auth.login.success",
          message: `User signed in successfully as ${user.email}.`,
          newValue: {
            email: user.email,
            organizationId: user.organizationId
          }
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
        role: membership.role,
        trialStartedAt: membership.organization.trialStartedAt?.toISOString() ?? null,
        trialEndsAt: membership.organization.trialEndsAt?.toISOString() ?? null,
        subscriptionStatus: membership.organization.subscriptionStatus,
        subscriptionPlan: membership.organization.subscriptionPlan,
        subscriptionStartedAt:
          membership.organization.subscriptionStartedAt?.toISOString() ?? null,
        subscriptionEndsAt:
          membership.organization.subscriptionEndsAt?.toISOString() ?? null
      }))
    });
  } catch (error) {
    if (error instanceof InvitationRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

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
