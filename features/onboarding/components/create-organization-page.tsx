"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import type { CountryCode } from "libphonenumber-js";
import { PhoneField } from "@/components/ui/phone-field";
import { useToast } from "@/components/ui/toast";
import {
  DEFAULT_PHONE_COUNTRY,
  parsePhoneInput
} from "@/lib/validation/phone";
import {
  clearCachedSyncedUser,
  getCachedSyncedUser,
  syncSignedInUser
} from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { freeTrialPlan, subscriptionPlans } from "@/lib/subscription/plans";
import { TRIAL_DAYS } from "@/lib/subscription/trial";
import type {
  CreateOrganizationInput,
  CreateOrganizationResponse,
  OnboardingPlanId
} from "@/features/onboarding/validations/onboarding.schema";

const planOptions = [freeTrialPlan, ...subscriptionPlans];

function getPlanPriceLabel(planId: OnboardingPlanId) {
  const plan = planOptions.find((candidate) => candidate.id === planId);

  if (!plan) return "";

  return plan.id === "free_trial"
    ? `${plan.name} - $0/month`
    : `${plan.name} - ${plan.price}/month`;
}

/**
 * Step 2 of sign-up. The organization row already exists with a placeholder name
 * (POST /api/auth/sync-user provisions it on first sign-in because
 * User.organizationId is required), so this form renames it, records the intended
 * plan, and stamps onboardingCompletedAt - which is what releases the owner into
 * the rest of the dashboard.
 */
export function CreateOrganizationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fieldId = useId();
  // Read synchronously so the prefilled values are present on first paint
  // instead of flashing empty inputs.
  const [cachedUser] = useState(() => getCachedSyncedUser());
  const activeOrganization = cachedUser?.organizations.find(
    (organization) => organization.id === cachedUser.activeOrganizationId
  );
  const [form, setForm] = useState({
    organizationName: activeOrganization?.name ?? "",
    fullName: cachedUser?.user.name ?? "",
    // An ISO country code, not a dialling code: "+1" alone cannot tell the
    // United States from Canada, and the two have different valid numbers.
    country: DEFAULT_PHONE_COUNTRY as CountryCode,
    phone: "",
    plan: "free_trial" as OnboardingPlanId
  });
  const [error, setError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { mutate, isPending } = useAuthenticatedMutation<
    CreateOrganizationInput,
    CreateOrganizationResponse
  >("/api/onboarding/organization");

  const selectedPlan = planOptions.find((plan) => plan.id === form.plan);

  const updateField = (
    name: "organizationName" | "fullName" | "phone",
    value: string
  ) => {
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  };

  const updateCountry = (country: CountryCode) => {
    setForm((current) => ({ ...current, country }));
    setError("");
  };

  const updatePlan = (value: string) => {
    setForm((current) => ({ ...current, plan: value as OnboardingPlanId }));
    setError("");
  };

  const fail = (message: string) => {
    setError(message);
    toast.error(message, { title: "Setup failed" });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const organizationName = form.organizationName.trim();
    const fullName = form.fullName.trim();

    if (organizationName.length < 2) {
      fail("Please enter your organization name.");
      return;
    }

    if (fullName.length < 2) {
      fail("Please enter your full name.");
      return;
    }

    // Validated here as well as on the server, so a bad number is caught
    // before the round trip. Both layers call the same parser.
    const parsedPhone = parsePhoneInput(form.phone, {
      country: form.country,
      label: "Phone number"
    });

    if (parsedPhone.status === "invalid") {
      fail(parsedPhone.message);
      return;
    }

    const phone =
      parsedPhone.status === "valid" ? parsedPhone.value : undefined;

    try {
      await mutate({ organizationName, fullName, phone, plan: form.plan });

      // The sidebar, trial pill, and route guard all read the cached sync
      // payload, so it has to be rebuilt before leaving this page - otherwise
      // the dashboard renders the placeholder organization name.
      clearCachedSyncedUser();
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();

      if (data.session?.access_token) {
        await syncSignedInUser(data.session.access_token, { force: true });
      }

      toast.success(`${organizationName} is ready.`, {
        title: "Organization created"
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (mutationError) {
      fail(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to create your organization. Please try again."
      );
    }
  };

  const signOut = async () => {
    setIsSigningOut(true);

    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut({ scope: "local" });
      clearCachedSyncedUser();
      router.replace("/");
      router.refresh();
    } catch {
      setIsSigningOut(false);
      toast.error("Unable to sign out. Please try again.", {
        title: "Sign-out failed"
      });
    }
  };

  return (
    <main className="dashboard-font min-h-dvh bg-[#f5f6f8] px-4 py-10 text-[#17202a] sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#1F4D73]">
          Step 2 of 2
        </p>

        <form
          className="mt-4 overflow-hidden rounded-3xl border border-[#d8dde5] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
          onSubmit={submit}
        >
          <header className="border-b border-[#e6eaf0] p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0B1930] text-[#D9B45F]">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Create a new organization
                </h1>
                <p className="mt-2 text-sm leading-6 text-[#64748b]">
                  An organization holds your halls, bookings, staff, and billing
                  settings. You can invite your team once it exists.
                </p>
              </div>
            </div>
          </header>

          <div className="divide-y divide-[#e6eaf0]">
            <div className="grid gap-2 p-6 sm:grid-cols-[220px_1fr] sm:gap-8 sm:p-8">
              <label
                className="text-sm font-black text-[#17202a]"
                htmlFor={`${fieldId}-organization-name`}
              >
                Organization name
              </label>
              <div>
                <input
                  autoComplete="organization"
                  className="h-12 w-full rounded-xl border border-[#cfd6e0] bg-white px-4 text-base outline-none transition focus:border-[#1f557d] focus:shadow-[0_0_0_4px_rgba(31,85,125,0.14)]"
                  id={`${fieldId}-organization-name`}
                  maxLength={120}
                  name="organizationName"
                  onChange={(event) =>
                    updateField("organizationName", event.target.value)
                  }
                  placeholder="Riverside Events"
                  value={form.organizationName}
                />
                <p className="mt-2 text-sm text-[#64748b]">
                  What&apos;s the name of your company or venue? You can change
                  this later.
                </p>
              </div>
            </div>

            <div className="grid gap-2 p-6 sm:grid-cols-[220px_1fr] sm:gap-8 sm:p-8">
              <label
                className="text-sm font-black text-[#17202a]"
                htmlFor={`${fieldId}-full-name`}
              >
                Your full name
              </label>
              <div>
                <input
                  autoComplete="name"
                  className="h-12 w-full rounded-xl border border-[#cfd6e0] bg-white px-4 text-base outline-none transition focus:border-[#1f557d] focus:shadow-[0_0_0_4px_rgba(31,85,125,0.14)]"
                  id={`${fieldId}-full-name`}
                  maxLength={120}
                  name="fullName"
                  onChange={(event) => updateField("fullName", event.target.value)}
                  placeholder="Jordan Rivera"
                  value={form.fullName}
                />
                <p className="mt-2 text-sm text-[#64748b]">
                  Shown to your team on bookings and activity history.
                </p>
              </div>
            </div>

            <div className="grid gap-2 p-6 sm:grid-cols-[220px_1fr] sm:gap-8 sm:p-8">
              <label
                className="text-sm font-black text-[#17202a]"
                htmlFor={`${fieldId}-phone`}
              >
                Phone number
              </label>
              <div>
                <PhoneField
                  className="w-full"
                  country={form.country}
                  id={`${fieldId}-phone`}
                  inputClassName="min-w-0 flex-1 bg-transparent px-4 text-base outline-none"
                  name="phone"
                  onChange={(value) => updateField("phone", value)}
                  onCountryChange={updateCountry}
                  rowClassName="flex h-12 w-full overflow-hidden rounded-xl border border-[#cfd6e0] bg-white transition focus-within:border-[#1f557d] focus-within:shadow-[0_0_0_4px_rgba(31,85,125,0.14)]"
                  selectClassName="h-full max-w-[9.5rem] border-r border-[#cfd6e0] bg-white px-3 text-sm font-bold outline-none"
                  value={form.phone}
                />
                <p className="mt-2 text-sm text-[#64748b]">
                  Optional. Used for booking confirmations and account recovery.
                </p>
              </div>
            </div>

            <div className="grid gap-2 p-6 sm:grid-cols-[220px_1fr] sm:gap-8 sm:p-8">
              <label
                className="text-sm font-black text-[#17202a]"
                htmlFor={`${fieldId}-plan`}
              >
                Plan
              </label>
              <div>
                <select
                  className="h-12 w-full rounded-xl border border-[#cfd6e0] bg-white px-4 text-base outline-none transition focus:border-[#1f557d] focus:shadow-[0_0_0_4px_rgba(31,85,125,0.14)]"
                  id={`${fieldId}-plan`}
                  name="plan"
                  onChange={(event) => updatePlan(event.target.value)}
                  value={form.plan}
                >
                  {planOptions.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {getPlanPriceLabel(plan.id)}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-[#64748b]">
                  Which plan fits your organization best? Every organization
                  starts with a {TRIAL_DAYS}-day free trial &mdash; you only pay
                  when you activate billing in Settings.
                </p>
                {selectedPlan ? (
                  <div className="mt-3 rounded-2xl border border-[#dbe3ec] bg-[#f8fbff] p-4">
                    <p className="text-sm font-black text-[#17202a]">
                      {selectedPlan.name}
                      <span className="ml-2 font-semibold text-[#64748b]">
                        {selectedPlan.description}
                      </span>
                    </p>
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {selectedPlan.features.map((feature) => (
                        <li
                          className="text-sm leading-6 text-[#64748b]"
                          key={feature}
                        >
                          &bull; {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {error ? (
            <p
              className="border-t border-[#e6eaf0] bg-[#fff7ed] px-6 py-4 text-sm font-bold text-[#c2410c] sm:px-8"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <footer className="flex flex-col gap-3 border-t border-[#e6eaf0] bg-[#fbfcfe] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <button
              className="min-h-11 rounded-xl border border-[#cfd6e0] bg-white px-5 text-sm font-black text-[#17202a] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSigningOut || isPending}
              onClick={signOut}
              type="button"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1f557d] px-6 text-sm font-black text-white shadow-lg shadow-[#1f557d]/20 transition hover:bg-[#174362] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isPending || isSigningOut}
              type="submit"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isPending ? "Creating organization..." : "Create organization"}
            </button>
          </footer>
        </form>
      </div>
    </main>
  );
}
