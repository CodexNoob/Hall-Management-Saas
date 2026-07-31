export type SubscriptionPlanId =
  | "free_trial"
  | "starter"
  | "professional"
  | "enterprise";

export type SubscriptionPlanLimitKey =
  | "activeHalls"
  | "staffMembers"
  | "eventsPerMonth"
  | "storageGb"
  | "invoicesPerMonth";

export type SubscriptionPlanLimits = Record<
  SubscriptionPlanLimitKey,
  number | null
>;

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  price: string;
  billingLabel: string;
  description: string;
  features: string[];
  limits: SubscriptionPlanLimits;
  popular?: boolean;
};

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$149",
    billingLabel: "Billed annually",
    description: "Perfect for small venues",
    features: [
      "Up to 2 halls",
      "Unlimited bookings",
      "Calendar & scheduling",
      "Client management",
      "Invoicing & payments",
      "Email support"
    ],
    limits: {
      activeHalls: 2,
      staffMembers: 10,
      eventsPerMonth: null,
      storageGb: 25,
      invoicesPerMonth: null
    }
  },
  {
    id: "professional",
    name: "Professional",
    price: "$299",
    billingLabel: "Billed annually",
    description: "Best for growing venues",
    features: [
      "Up to 10 halls",
      "All Starter features",
      "Staff management",
      "Reports & analytics",
      "PDF contracts",
      "Priority support"
    ],
    limits: {
      activeHalls: 10,
      staffMembers: 50,
      eventsPerMonth: null,
      storageGb: 100,
      invoicesPerMonth: null
    },
    popular: true
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$599",
    billingLabel: "Billed annually",
    description: "For large venues & chains",
    features: [
      "Unlimited halls",
      "All Professional features",
      "Advanced analytics",
      "API access",
      "Dedicated account manager",
      "24/7 premium support"
    ],
    limits: {
      activeHalls: null,
      staffMembers: null,
      eventsPerMonth: null,
      storageGb: null,
      invoicesPerMonth: null
    }
  }
];

export const freeTrialPlan: SubscriptionPlan = {
  id: "free_trial",
  name: "Free Trial",
  price: "$0",
  billingLabel: "14-day trial",
  description: "Try Event Core with one active hall",
  features: [
    "1 active hall",
    "Dashboard access",
    "Calendar & booking tools",
    "Kitchen and dining previews",
    "Upgrade anytime"
  ],
  limits: {
    activeHalls: 1,
    staffMembers: 3,
    eventsPerMonth: 20,
    storageGb: 2,
    invoicesPerMonth: 20
  }
};

export const subscriptionPlansById = Object.fromEntries(
  [freeTrialPlan, ...subscriptionPlans].map((plan) => [plan.id, plan])
) as Record<SubscriptionPlanId, SubscriptionPlan>;

export function getSubscriptionPlan(planId: string | null | undefined) {
  if (!planId) return null;

  return subscriptionPlansById[planId as SubscriptionPlanId] ?? null;
}
