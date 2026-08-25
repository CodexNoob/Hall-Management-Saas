import type { AuthzContext } from "@/lib/authz/authorize";
import type { PermissionKey } from "@/lib/authz/catalog";

/**
 * A believable `AuthzContext` for route tests.
 *
 * Route suites mock `authorize()` rather than the resolver, because what they
 * are testing is the handler - "does this route pass the tenant filter", "does a
 * bad body 400". Whether the resolver reaches the right verdict is a different
 * question with its own suites.
 *
 * Unscoped by default. A test that cares about scoping says so explicitly, which
 * keeps the narrowing visible in the test that asserts it rather than smuggled
 * into a shared default.
 */
export function authzContext(
  overrides: Partial<AuthzContext> = {}
): AuthzContext {
  return {
    principalId: "principal-1",
    organizationId: "11111111-1111-4111-8111-111111111111",
    organization: {
      id: overrides.organizationId ?? "11111111-1111-4111-8111-111111111111",
      name: "Test Organization",
      slug: "test-organization",
      subscriptionPlan: null,
      subscriptionStatus: "active"
    },
    userId: "22222222-2222-4222-8222-222222222222",
    userEmail: "user@example.com",
    actorName: "Test User",
    isServiceAccount: false,
    epoch: 1,
    permission: null,
    scope: { hallIds: "all", eventTypeIds: "all" },
    ...overrides
  };
}

/** A context narrowed to specific halls, for the scoping assertions. */
export function hallScopedContext(
  hallIds: string[],
  overrides: Partial<AuthzContext> = {}
): AuthzContext {
  return authzContext({
    ...overrides,
    scope: { hallIds, eventTypeIds: "all" }
  });
}

export const ALL_PERMISSIONS_HELD = (key: PermissionKey) => Boolean(key);
