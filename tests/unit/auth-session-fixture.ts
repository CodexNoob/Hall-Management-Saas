/**
 * SILENT-PASS TRAP - read before trusting a green run of the suites that import
 * this file.
 *
 * These fixtures work by writing localStorage, which only has any effect because
 * permission hints are still read from the "hms.authSession" cache on the
 * client. The suites that use them assert mostly NEGATIVELY - `toHaveCount(0)`,
 * "this control is absent for this permission set". If identity ever moves to a
 * React provider or a Server Component, these writes stop reaching the
 * component, every render falls back to no-permissions, and every negative
 * assertion keeps passing while testing nothing at all.
 *
 * How to check it is still real: break one POSITIVE assertion in each importing
 * suite (a `toBeInTheDocument` / `toBeEnabled` on a permission-gated control)
 * and confirm it actually fails. If it passes, the fixture is inert.
 */

import type { AuthSessionResponse } from "@/lib/auth/session-context";
import type { PermissionKey } from "@/lib/authz/catalog";
import { starterRoles } from "@/lib/authz/starter-roles";

/**
 * Mirrors the shape lib/auth/client.ts caches under "hms.authSession".
 *
 * NO ROLE ARGUMENT. The old fixture took a role string and an access row that
 * could disagree with it, which is exactly the drift the design removes - a test
 * now says which KEYS the signed-in principal holds, and that is all the client
 * ever knew anyway.
 */
export function cacheTestSession(
  permissions: PermissionKey[],
  overrides: {
    userName?: string;
    userTitle?: string | null;
    organizationName?: string;
    onboardingCompletedAt?: string | null;
    epoch?: number;
    scope?: AuthSessionResponse["scope"];
  } = {}
) {
  // Typed against the real response so a field added to the payload is a compile
  // error here rather than a fixture that silently stops matching the route.
  const authSession: AuthSessionResponse = {
    user: {
      id: "user-1",
      email: "test@example.com",
      name: overrides.userName ?? "Test User",
      phone: null,
      venueName: null,
      // No personal preference, so the organization's language applies.
      language: null,
      title: overrides.userTitle ?? "Team member",
      organizationId: "org-1"
    },
    permissions,
    scope: overrides.scope ?? { hallIds: "all", eventTypeIds: "all" },
    epoch: overrides.epoch ?? 1,
    mustSetPassword: false,
    mustCompleteOnboarding: overrides.onboardingCompletedAt === null,
    activeOrganizationId: "org-1",
    organizations: [
      {
        id: "org-1",
        name: overrides.organizationName ?? "Org",
        slug: "org",
        trialStartedAt: null,
        trialEndsAt: null,
        subscriptionStatus: "active",
        subscriptionPlan: null,
        subscriptionStartedAt: null,
        subscriptionEndsAt: null,
        onboardingCompletedAt:
          overrides.onboardingCompletedAt === undefined
            ? "2024-01-01T00:00:00.000Z"
            : overrides.onboardingCompletedAt
      }
    ]
  };

  window.localStorage.setItem("hms.authSession", JSON.stringify(authSession));
}

/**
 * A session holding exactly what one starter role grants.
 *
 * Reads the starter definitions rather than restating them, so a test that
 * asserts "Kitchen Staff cannot see the billing tab" keeps meaning that after
 * somebody edits the starter matrix - it either still passes or fails loudly,
 * instead of quietly testing a set nobody ships.
 *
 * This is the ONE place outside the seed where a starter role key appears, and
 * the INV-1 grep test allowlists it by path for that reason.
 */
export function cacheTestSessionForStarterRole(
  key: string,
  overrides: Parameters<typeof cacheTestSession>[1] = {}
) {
  cacheTestSession(starterPermissions(key), overrides);
}

export function starterPermissions(key: string): PermissionKey[] {
  const role = starterRoles.find((candidate) => candidate.key === key);

  if (!role) {
    throw new Error(
      `No starter role keyed "${key}". Known: ${starterRoles.map((candidate) => candidate.key).join(", ")}.`
    );
  }

  return [...role.permissions];
}

/**
 * A starter role's key set, minus some, plus some.
 *
 * For the tests whose whole point is a near-miss: "an Event Manager who has lost
 * `menu.update`". Written as a subtraction from the shipped set rather than as a
 * hand-listed set, so the test keeps meaning what it says after somebody edits
 * the starter matrix.
 */
export function starterPermissionsExcept(
  key: string,
  revoked: PermissionKey[],
  granted: PermissionKey[] = []
): PermissionKey[] {
  const dropped = new Set<PermissionKey>(revoked);
  const kept = starterPermissions(key).filter(
    (candidate) => !dropped.has(candidate)
  );

  return [...new Set([...kept, ...granted.filter((candidate) => !dropped.has(candidate))])];
}
