import { z } from "zod";
import { phoneSchema } from "@/lib/validation/phone";

export const onboardingPlanIds = [
  "free_trial",
  "starter",
  "professional",
  "enterprise"
] as const;

export type OnboardingPlanId = (typeof onboardingPlanIds)[number];

export const createOrganizationSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  fullName: z.string().trim().min(2).max(120),
  // Optional: the owner can add a number later from their profile. When it IS
  // supplied it must be a real number, and is stored as E.164.
  phone: phoneSchema({ label: "Phone number" }),
  plan: z.enum(onboardingPlanIds)
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export type CreateOrganizationResponse = {
  organization: {
    id: string;
    name: string;
    slug: string;
    subscriptionPlan: string | null;
    subscriptionStatus: string;
    onboardingCompletedAt: string;
  };
};
