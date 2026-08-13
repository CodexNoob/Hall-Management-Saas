import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseTokenVerifier } from "@/lib/supabase/server";
import { accessForRole, normalizeStaffRole } from "@/lib/auth/permissions";
import { createOrganizationSlug } from "@/lib/auth/organization-slug";
import { getTrialDates, isTesterBypassEmail } from "@/lib/subscription/trial";
import { createActivityLog } from "@/lib/audit/activity-log";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { phoneSchema } from "@/lib/validation/phone";

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
    const metadataName =
      typeof metadata.full_name === "string" && metadata.full_name.trim()
        ? metadata.full_name.trim()
        : typeof metadata.name === "string" && metadata.name.trim()
          ? metadata.name.trim()
          : null;
    const name = metadataName ?? authEmail.split("@")[0];
    // Mirrored from Supabase metadata rather than typed into a form here, so a
    // bad value is dropped instead of failing the sync - refusing to mirror an
    // account because of an unusable phone would lock the user out entirely.
    // It is still normalized, so anything stored matches the forms' format.
    const phone =
      typeof metadata.phone === "string"
        ? (phoneSchema().safeParse(metadata.phone.trim()).data ?? null)
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
    // Users who only ever authenticate through an OAuth provider never need a
    // password of their own, so they must not be pushed into password setup.
    const authProviders = Array.isArray(data.user.app_metadata?.providers)
      ? data.user.app_metadata.providers.filter(
          (provider): provider is string => typeof provider === "string"
        )
      : [];
    const usesEmailPassword =
      authProviders.length === 0 || authProviders.includes("email");

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
          // Only write fields Supabase actually gave us. Invited staff carry no
          // auth metadata, so writing unconditionally would wipe the name and
          // department an administrator set when creating their access.
          user = await transaction.user.update({
            where: { id: existingUser.id },
            data: {
              supabaseAuthId: authUserId,
              ...(metadataName ? { name: metadataName } : {}),
              ...(phone ? { phone } : {}),
              ...(venueName ? { venueName } : {}),
              isActive: true
            }
          });
        } else {
          if (accountType !== "organization_owner") {
            throw new InvitationRequiredError();
          }

          // Sign-up only collects an email and a password, so `venue_name` is
          // absent and this is a placeholder the owner replaces on
          // /dashboard/new. `onboardingCompletedAt` stays NULL until they do,
          // which is what sends them there. (Organizations created by the older
          // trial form carried a real venue name, hence the fallback.)
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
              role: "owner",
              // This branch is only reachable from the trial signup, which calls
              // supabase.auth.signUp with a password the user just chose.
              passwordSetAt: new Date()
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

        // Normalize only. Mapping every administrative role to "owner" here used
        // to silently promote anyone an administrator invited as "admin".
        const resolvedRole = normalizeStaffRole(user.role);

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

        // Seed access from the role on first sign-in only. Re-deriving it on every
        // login discarded any per-user permissions an administrator customized
        // through PATCH /api/staff. Role changes still update access there.
        const access =
          (await transaction.userAccess.findUnique({
            where: {
              organizationId_userId: {
                organizationId: user.organizationId,
                userId: user.id
              }
            }
          })) ??
          (await transaction.userAccess.create({
            data: {
              organizationId: user.organizationId,
              userId: user.id,
              ...accessForRole(resolvedRole)
            }
          }));

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

    // Only an owner can name the organization and pick its plan, so invited staff
    // never see the setup form even if they happen to be the first one in.
    const activeMembership = memberships.find(
      (membership) => membership.organizationId === user.organizationId
    );
    const mustCompleteOnboarding =
      normalizeStaffRole(activeMembership?.role) === "owner" &&
      !activeMembership?.organization.onboardingCompletedAt;

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
      mustSetPassword: usesEmailPassword && !user.passwordSetAt,
      mustCompleteOnboarding,
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
          membership.organization.subscriptionEndsAt?.toISOString() ?? null,
        onboardingCompletedAt:
          membership.organization.onboardingCompletedAt?.toISOString() ?? null
      }))
    });
  } catch (error) {
    if (error instanceof InvitationRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("Signed-in user sync failed", error);

    return NextResponse.json(
      { error: "Unable to sync the signed-in user. Please try again." },
      { status: 500 }
    );
  }
}
