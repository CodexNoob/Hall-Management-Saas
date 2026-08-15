/**
 * Builds the unique URL slug for an organization. Shared by the first-sign-in
 * provisioning in POST /api/auth/session and the owner-submitted rename in
 * POST /api/onboarding/organization, which must agree on the shape: the slug
 * column is unique, so both paths need the same auth-id suffix to avoid
 * colliding whenever two venues pick the same name.
 */
export function createOrganizationSlug(name: string, authUserId: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return `${base || "organization"}-${authUserId.slice(0, 8)}`;
}
