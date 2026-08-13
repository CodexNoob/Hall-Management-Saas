import { NextRequest, NextResponse } from "next/server";
import { createActivityLog } from "@/lib/audit/activity-log";
import { createOrganizationSlug } from "@/lib/auth/organization-slug";
import { normalizeStaffRole } from "@/lib/auth/permissions";
import {
  AuthorizationError,
  requireAuthenticatedUser
} from "@/lib/auth/server-auth";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createOrganizationSchema } from "@/features/onboarding/validations/onboarding.schema";

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "onboarding-organization",
      limit: 10,
      windowMs: 10 * 60 * 1000
    });
    if (limited) return limited;

    const actor = await requireAuthenticatedUser(request);

    if (normalizeStaffRole(actor.membership.role) !== "owner") {
      throw new AuthorizationError(
        403,
        "Only an organization owner can complete this setup."
      );
    }

    // The placeholder organization is provisioned on first sign-in, so this
    // endpoint renames an existing row. Refusing once it is stamped keeps it from
    // being replayed to rename an established organization.
    if (actor.organization.onboardingCompletedAt) {
      return NextResponse.json(
        { error: "This organization has already been set up." },
        { status: 409 }
      );
    }

    const input = createOrganizationSchema.parse(await request.json());
    const phone = input.phone?.trim() ? input.phone.trim() : null;
    const onboardingCompletedAt = new Date();

    const organization = await prisma.$transaction(async (transaction) => {
      const updatedOrganization = await transaction.organization.update({
        where: { id: actor.organizationId },
        data: {
          name: input.organizationName,
          slug: createOrganizationSlug(
            input.organizationName,
            actor.supabaseAuthId ?? actor.id
          ),
          // Records which plan the owner intends to buy. Billing is activated
          // separately by the Stripe webhook, and getSubscriptionLimits keeps
          // applying trial limits while subscriptionStatus is "trialing".
          subscriptionPlan: input.plan,
          onboardingCompletedAt
        }
      });

      await transaction.user.update({
        where: { id: actor.id },
        data: {
          name: input.fullName,
          phone,
          venueName: input.organizationName
        }
      });

      await createActivityLog(transaction, {
        organizationId: actor.organizationId,
        userId: actor.id,
        userName: input.fullName,
        actionType: "organization.onboarding.completed",
        message: `Organization setup completed as ${updatedOrganization.name}.`,
        newValue: {
          organizationName: updatedOrganization.name,
          subscriptionPlan: input.plan
        }
      });

      return updatedOrganization;
    });

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subscriptionPlan: organization.subscriptionPlan,
        subscriptionStatus: organization.subscriptionStatus,
        onboardingCompletedAt: onboardingCompletedAt.toISOString()
      }
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
