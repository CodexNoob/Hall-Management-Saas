/**
 * SILENT-PASS TRAP - read before trusting a green run of the seven suites that
 * import this file.
 *
 * These fixtures work by writing localStorage, which only has any effect
 * because permissions are still read from the "hms.syncedUser" cache on the
 * client. The suites that use them assert mostly NEGATIVELY - `toHaveCount(0)`,
 * "this control is absent for this role". If identity ever moves to a React
 * provider or a Server Component (see the deferred server-layout work in the
 * auth plan), these writes stop reaching the component, every render falls back
 * to no-permissions, and every negative assertion keeps passing while testing
 * nothing at all.
 *
 * The cookie migration did not break this - the session moved to cookies but
 * the synced-user cache did not - so there is no failure to warn you.
 *
 * How to check it is still real: break one POSITIVE assertion in each importing
 * suite (a `toBeInTheDocument` / `toBeEnabled` on a permission-gated control)
 * and confirm it actually fails. If it passes, the fixture is inert.
 */

import type { SyncedUserAccess } from "@/lib/auth/client";
import { accessForRole, type StaffRoleValue } from "@/lib/auth/permissions";

const fullAccess: SyncedUserAccess = {
  id: "access-1",
  userId: "user-1",
  canViewHome: true,
  canViewCalendar: true,
  canCreateBooking: false,
  canViewEventManager: true,
  canViewKitchenDashboard: true,
  canViewMenu: true,
  canEditMenu: false,
  canViewSettings: false,
  canEditSettings: false,
  canEditStaff: false,
  canEditVendors: false,
  canEditClients: false,
  canEditFiles: false,
  canAssignWorkers: false,
  canUpdateKitchenStatus: false,
  canAddKitchenEvents: false,
  canManageSchoolSchedule: false,
  canSeeSchoolEvents: false,
  canSeeSimchaEvents: true,
  canViewPaymentInfo: false,
  canManagePayments: false,
  canSendPaymentEmail: false,
  canUseNiceHomeBackground: false,
  allowedHallIds: [],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z"
};

// Mirrors the shape lib/auth/client.ts caches under the "hms.syncedUser" key.
// Tests use this to put a signed-in user of a given role + access overrides
// into localStorage before rendering a component that reads it.
export function cacheSyncedUser(
  role: string,
  accessOverrides: Partial<SyncedUserAccess> = {},
  overrides: {
    userName?: string;
    organizationName?: string;
    onboardingCompletedAt?: string | null;
  } = {}
) {
  window.localStorage.setItem(
    "hms.syncedUser",
    JSON.stringify({
      user: {
        id: "user-1",
        email: "test@example.com",
        name: overrides.userName ?? "Test User",
        phone: null,
        venueName: null,
        role,
        organizationId: "org-1"
      },
      access: { ...fullAccess, ...accessOverrides },
      mustSetPassword: false,
      mustCompleteOnboarding: overrides.onboardingCompletedAt === null,
      activeOrganizationId: "org-1",
      organizations: [
        {
          id: "org-1",
          name: overrides.organizationName ?? "Org",
          slug: "org",
          role,
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
    })
  );
}

// cacheSyncedUser's `role` argument only sets the role STRING - the access row
// stays the viewer-ish baseline above. Use this instead whenever a test cares
// about what a role can actually see, so the access row and the role agree.
export function cacheSyncedUserForRole(role: StaffRoleValue) {
  cacheSyncedUser(role, accessForRole(role));
}
