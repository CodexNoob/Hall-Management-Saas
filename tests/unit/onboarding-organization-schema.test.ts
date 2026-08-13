import { describe, expect, it } from "vitest";
import { createOrganizationSlug } from "@/lib/auth/organization-slug";
import { createOrganizationSchema } from "@/features/onboarding/validations/onboarding.schema";

const authUserId = "3f2b9c41-8d1e-4a77-9b0c-51e2d7a6f8b3";

describe("createOrganizationSchema", () => {
  it("accepts a completed setup form and trims the text fields", () => {
    const parsed = createOrganizationSchema.parse({
      organizationName: "  Riverside Events  ",
      fullName: "  Jordan Rivera ",
      phone: " +1 555 010 8899 ",
      plan: "professional"
    });

    expect(parsed).toEqual({
      organizationName: "Riverside Events",
      fullName: "Jordan Rivera",
      phone: "+1 555 010 8899",
      plan: "professional"
    });
  });

  it("treats the phone number as optional", () => {
    const parsed = createOrganizationSchema.parse({
      organizationName: "Riverside Events",
      fullName: "Jordan Rivera",
      plan: "free_trial"
    });

    expect(parsed.phone).toBeUndefined();
  });

  it("rejects blank names and unknown plans", () => {
    const base = {
      organizationName: "Riverside Events",
      fullName: "Jordan Rivera",
      plan: "free_trial"
    };

    expect(
      createOrganizationSchema.safeParse({ ...base, organizationName: " " })
        .success
    ).toBe(false);
    expect(
      createOrganizationSchema.safeParse({ ...base, fullName: "J" }).success
    ).toBe(false);
    expect(
      createOrganizationSchema.safeParse({ ...base, plan: "platinum" }).success
    ).toBe(false);
    // Free-text plan ids would end up in Organization.subscriptionPlan, where
    // getSubscriptionPlan resolves them to null and limits silently open up.
    expect(
      createOrganizationSchema.safeParse({ ...base, plan: "" }).success
    ).toBe(false);
  });
});

describe("createOrganizationSlug", () => {
  it("kebab-cases the name and suffixes the auth id", () => {
    expect(createOrganizationSlug("Riverside Events", authUserId)).toBe(
      "riverside-events-3f2b9c41"
    );
  });

  it("strips punctuation without leaving stray separators", () => {
    expect(createOrganizationSlug("  O'Brien & Sons, Ltd.  ", authUserId)).toBe(
      "o-brien-sons-ltd-3f2b9c41"
    );
  });

  it("falls back to a usable base when the name has no usable characters", () => {
    expect(createOrganizationSlug("!!!", authUserId)).toBe(
      "organization-3f2b9c41"
    );
  });

  it("truncates long names so the slug stays bounded", () => {
    const slug = createOrganizationSlug("a".repeat(80), authUserId);

    expect(slug).toBe(`${"a".repeat(48)}-3f2b9c41`);
  });

  it("keeps two organizations with the same name apart", () => {
    const otherAuthUserId = "9a1c7e55-2b64-4f10-8d3a-77c5b0e9f2d1";

    expect(createOrganizationSlug("Riverside Events", authUserId)).not.toBe(
      createOrganizationSlug("Riverside Events", otherAuthUserId)
    );
  });
});
