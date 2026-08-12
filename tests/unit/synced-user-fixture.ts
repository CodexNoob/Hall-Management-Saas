import type { SyncedUserAccess } from "@/lib/auth/client";

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
  accessOverrides: Partial<SyncedUserAccess> = {}
) {
  window.localStorage.setItem(
    "hms.syncedUser",
    JSON.stringify({
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        phone: null,
        venueName: null,
        role,
        organizationId: "org-1"
      },
      access: { ...fullAccess, ...accessOverrides },
      mustSetPassword: false,
      activeOrganizationId: "org-1",
      organizations: [
        {
          id: "org-1",
          name: "Org",
          slug: "org",
          role,
          trialStartedAt: null,
          trialEndsAt: null,
          subscriptionStatus: "active",
          subscriptionPlan: null,
          subscriptionStartedAt: null,
          subscriptionEndsAt: null
        }
      ]
    })
  );
}
