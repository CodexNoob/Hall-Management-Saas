import { NextResponse } from "next/server";
import { createActivityLog } from "@/lib/audit/activity-log";
import { createOrganizationSlug } from "@/lib/auth/organization-slug";
import { authorize, requireUserActor } from "@/lib/authz/authorize";
import { createApiErrorResponse } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createOrganizationSchema } from "@/features/onboarding/validations/onboarding.schema";
import { withRoute } from "@/lib/http/with-route";

export const POST = withRoute(
  "POST /api/onboarding/organization",
  async (request: Request) => {
    try {
      const limited = await enforceRateLimit(request, {
        scope: "onboarding-organization",
        limit: 10,
        windowMs: 10 * 60 * 1000
      });
      if (limited) return limited;

      // `settings.update` rather than a role check. Naming the organization and
      // choosing its plan is the same act as any other settings edit, and asking
      // for the permission means a tenant who invents a "Founder" role and gives
      // it that key gets this form with no code change (INV-1).
      const actor = await authorize(request, "settings.update");
      const userId = requireUserActor(actor);

      // The placeholder organization is provisioned on first sign-in, so this
      // endpoint renames an existing row. Refusing once it is stamped keeps it from
      // being replayed to rename an established organization.
      const organizationRow = await prisma.organization.findUniqueOrThrow({
        where: { id: actor.organizationId },
        select: { onboardingCompletedAt: true }
      });

      if (organizationRow.onboardingCompletedAt) {
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
              userId
            ),
            // Records which plan the owner intends to buy. Billing is activated
            // separately by the Stripe webhook, and getSubscriptionLimits keeps
            // applying trial limits while subscriptionStatus is "trialing".
            subscriptionPlan: input.plan,
            onboardingCompletedAt
          }
        });

        await transaction.user.update({
          where: { id: userId },
          data: {
            name: input.fullName,
            phone,
            venueName: input.organizationName
          }
        });

        await createActivityLog(transaction, {
          organizationId: actor.organizationId,
          userId,
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
);
