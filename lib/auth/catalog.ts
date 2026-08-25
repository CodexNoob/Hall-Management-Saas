import {
  accessPermissionKeys,
  roleAccess,
  staffRoleNameByValue,
  staffRoleValues,
  type AccessPermissionKey,
  type StaffRoleValue
} from "./permissions";
import { roleRank } from "./guards";

/**
 * The authorization catalog: the source data P1 seeds into `permissions`,
 * `roles` and `role_permissions`.
 *
 * NOTHING IN THE APPLICATION READS THIS YET. P1's defining property is that the
 * new tables exist and are correct while every authorization decision still
 * runs through the 23 boolean columns on `user_access`. The resolver that reads
 * these rows arrives in P3, behind `AUTHZ_RESOLVER`.
 *
 * Do not add `import "server-only"`: the seed script and the parity test both
 * import this module outside a Next.js server context.
 *
 * WHY THE DOTTED KEYS EXIST NOW, BEFORE ANYTHING CONSUMES THEM
 * -----------------------------------------------------------
 * `canEditStaff` -> `staff.edit` is a rename, and a rename is only free while
 * the rows are re-derivable by re-running the seed. After P2 starts writing
 * real tenant-authored grants, the same rename means an UPDATE across
 * `permissions`, `role_permissions` and `membership_permissions` - the last of
 * which by then holds data no seed can reconstruct. So the keys land in their
 * final form at the moment the catalog table is first populated.
 *
 * The `AccessPermissionKey` union and the `Permission` enforcement union stay
 * camelCase until P3/P5. In P1 the dotted keys exist in exactly two places:
 * this file, and the rows it seeds. `legacyColumn` is the bridge, and P2's
 * projection into `user_access` depends on it.
 */

export type PermissionGroup =
  | "Dashboard"
  | "Calendar"
  | "Bookings"
  | "Kitchen"
  | "Menu"
  | "Billing"
  | "Staff"
  | "Records"
  | "Settings"
  | "Scheduling"
  | "Appearance";

export type PermissionCatalogEntry = {
  /** Final dotted key. The identifier P3+ resolves against. */
  key: string;
  /** The `user_access` column this key replaces. P2 projects through it. */
  legacyColumn: AccessPermissionKey;
  label: string;
  description: string;
  group: PermissionGroup;
  /**
   * "Escalates privilege or moves money." P4 uses this to require a
   * confirmation step before the grant is written.
   *
   * UNRESOLVED - the rule is provisional and picks out exactly these four.
   * Menu, file and client edits are destructive but do not escalate, so they
   * are excluded. Confirm the rule or name a different one before P4 builds
   * the confirmation UI on top of it.
   */
  isDangerous: boolean;
  sortOrder: number;
};

/**
 * All 23 keys, in `accessPermissionKeys` order so `sortOrder` matches the order
 * the existing permission matrix renders in.
 *
 * NOT ROUTE-ENFORCEABLE: `home.view`, `school.viewEvents`, `simcha.viewEvents`
 * and `home.niceBackground` map to the four columns the `Permission` union in
 * `lib/auth/server-auth.ts` does not accept. They are session-shaped - two
 * filter which events a query returns, one is always-true chrome, and
 * `home.niceBackground` is a cosmetic entitlement that is not an authorization
 * decision at all. They are catalogued because `user_access` carries them and
 * P2's projection must round-trip every column; whether the catalog should
 * mark keys as route-enforceable / filter-only / presentational is an open
 * question deliberately left out of the schema. Adding a nullable column later
 * is cheap; seeding a taxonomy nobody has agreed to is not.
 * `tests/unit/authorization-catalog.test.ts` pins the set of four.
 */
export const permissionCatalog: PermissionCatalogEntry[] = [
  {
    key: "home.view",
    legacyColumn: "canViewHome",
    label: "View dashboard",
    description: "View the main dashboard overview.",
    group: "Dashboard",
    isDangerous: false,
    sortOrder: 0
  },
  {
    key: "calendar.view",
    legacyColumn: "canViewCalendar",
    label: "View calendar",
    description: "View availability and the booking calendar.",
    group: "Calendar",
    isDangerous: false,
    sortOrder: 1
  },
  {
    key: "booking.create",
    legacyColumn: "canCreateBooking",
    label: "Create bookings",
    description: "Create bookings and hold reservations.",
    group: "Bookings",
    isDangerous: false,
    sortOrder: 2
  },
  {
    key: "events.view",
    legacyColumn: "canViewEventManager",
    label: "View event manager",
    description: "Open the event manager and manage event records.",
    group: "Bookings",
    isDangerous: false,
    sortOrder: 3
  },
  {
    key: "kitchen.view",
    legacyColumn: "canViewKitchenDashboard",
    label: "View kitchen dashboard",
    description: "Open the kitchen dashboard and production views.",
    group: "Kitchen",
    isDangerous: false,
    sortOrder: 4
  },
  {
    key: "menu.view",
    legacyColumn: "canViewMenu",
    label: "View menu",
    description: "View menu items, packages, and add-ons.",
    group: "Menu",
    isDangerous: false,
    sortOrder: 5
  },
  {
    key: "menu.edit",
    legacyColumn: "canEditMenu",
    label: "Edit menu",
    description: "Create and maintain menu items, packages, and add-ons.",
    group: "Menu",
    isDangerous: false,
    sortOrder: 6
  },
  {
    key: "settings.view",
    legacyColumn: "canViewSettings",
    label: "View settings",
    description: "View organization settings.",
    group: "Settings",
    isDangerous: false,
    sortOrder: 7
  },
  {
    key: "settings.edit",
    legacyColumn: "canEditSettings",
    label: "Edit settings",
    description: "Change organization settings, including the access matrix.",
    group: "Settings",
    // Escalates privilege: the access matrix lives in organization_settings
    // and fans out into every membership's user_access row.
    isDangerous: true,
    sortOrder: 8
  },
  {
    key: "staff.edit",
    legacyColumn: "canEditStaff",
    label: "Manage staff",
    description: "Invite staff, assign roles, and deactivate members.",
    group: "Staff",
    // Escalates privilege: this is the permission C3 was reachable through.
    isDangerous: true,
    sortOrder: 9
  },
  {
    key: "vendors.edit",
    legacyColumn: "canEditVendors",
    label: "Manage vendors",
    description: "Create and maintain vendor records.",
    group: "Records",
    isDangerous: false,
    sortOrder: 10
  },
  {
    key: "clients.edit",
    legacyColumn: "canEditClients",
    label: "Manage clients",
    description: "Create and maintain client records.",
    group: "Records",
    isDangerous: false,
    sortOrder: 11
  },
  {
    key: "files.edit",
    legacyColumn: "canEditFiles",
    label: "Manage files",
    description: "Upload, organize, and delete stored files.",
    group: "Records",
    isDangerous: false,
    sortOrder: 12
  },
  {
    key: "kitchen.assignWorkers",
    legacyColumn: "canAssignWorkers",
    label: "Assign kitchen workers",
    description: "Assign workers to events and kitchen shifts.",
    group: "Kitchen",
    isDangerous: false,
    sortOrder: 13
  },
  {
    key: "kitchen.updateStatus",
    legacyColumn: "canUpdateKitchenStatus",
    label: "Update kitchen status",
    description: "Advance production status on kitchen items.",
    group: "Kitchen",
    isDangerous: false,
    sortOrder: 14
  },
  {
    key: "kitchen.addEvents",
    legacyColumn: "canAddKitchenEvents",
    label: "Add kitchen events",
    description: "Create standalone kitchen events.",
    group: "Kitchen",
    isDangerous: false,
    sortOrder: 15
  },
  {
    key: "school.manageSchedule",
    legacyColumn: "canManageSchoolSchedule",
    label: "Manage school schedule",
    description: "Maintain school cycles and the recurring schedule.",
    group: "Scheduling",
    isDangerous: false,
    sortOrder: 16
  },
  {
    key: "school.viewEvents",
    legacyColumn: "canSeeSchoolEvents",
    label: "See school events",
    description: "Include school events in calendars and listings.",
    group: "Scheduling",
    isDangerous: false,
    sortOrder: 17
  },
  {
    key: "simcha.viewEvents",
    legacyColumn: "canSeeSimchaEvents",
    label: "See simcha events",
    description: "Include simcha events in calendars and listings.",
    group: "Scheduling",
    isDangerous: false,
    sortOrder: 18
  },
  {
    key: "payments.view",
    legacyColumn: "canViewPaymentInfo",
    label: "View payment info",
    description: "View invoices, balances, and payment history.",
    group: "Billing",
    isDangerous: false,
    sortOrder: 19
  },
  {
    key: "payments.manage",
    legacyColumn: "canManagePayments",
    label: "Manage payments",
    description: "Record, refund, and reconcile payments.",
    group: "Billing",
    // Moves money.
    isDangerous: true,
    sortOrder: 20
  },
  {
    key: "payments.sendEmail",
    legacyColumn: "canSendPaymentEmail",
    label: "Send payment emails",
    description: "Send invoices and payment requests to clients.",
    group: "Billing",
    // Moves money: a payment request is an outbound demand in the
    // organization's name.
    isDangerous: true,
    sortOrder: 21
  },
  {
    key: "home.niceBackground",
    legacyColumn: "canUseNiceHomeBackground",
    label: "Enhanced dashboard background",
    description: "Use the enhanced dashboard background image.",
    group: "Appearance",
    isDangerous: false,
    sortOrder: 22
  }
];

/** Dotted key -> the `user_access` column it replaces. */
export const legacyColumnByKey: Record<string, AccessPermissionKey> =
  Object.fromEntries(
    permissionCatalog.map((entry) => [entry.key, entry.legacyColumn])
  );

/** The `user_access` column -> its dotted key. P2's projection reads this. */
export const keyByLegacyColumn: Record<AccessPermissionKey, string> =
  Object.fromEntries(
    permissionCatalog.map((entry) => [entry.legacyColumn, entry.key])
  ) as Record<AccessPermissionKey, string>;

export type RoleTemplate = {
  key: StaffRoleValue;
  name: string;
  description: string;
  rank: number;
};

/**
 * The six system role templates, seeded with `organization_id IS NULL`.
 *
 * `rank` comes from `roleRank` rather than being restated here, so P0-A's
 * ceiling and the seeded rows cannot drift apart. `kitchen` and `billing`
 * share rank 30 deliberately - lateral peers, and every comparison is strict,
 * so equal rank denies.
 *
 * Owner appears here even though `roleTemplates` in permissions.ts stays
 * owner-free. That file drives the invite form, where Owner must not be
 * offerable; this one describes what exists.
 */
export const roleTemplateCatalog: RoleTemplate[] = [
  {
    key: "owner",
    name: staffRoleNameByValue.owner,
    description: "Full organization access, including ownership transfer",
    rank: roleRank.owner
  },
  {
    key: "admin",
    name: staffRoleNameByValue.admin,
    description: "Full organization access",
    rank: roleRank.admin
  },
  {
    key: "manager",
    name: staffRoleNameByValue.manager,
    description: "Bookings, events, clients, files, dining, and kitchen",
    rank: roleRank.manager
  },
  {
    key: "kitchen",
    name: staffRoleNameByValue.kitchen,
    description:
      "Kitchen dashboard, menu view, workers, and production status",
    rank: roleRank.kitchen
  },
  {
    key: "billing",
    name: staffRoleNameByValue.billing,
    description: "Invoices, payments, client billing, files, and event billing",
    rank: roleRank.billing
  },
  {
    key: "viewer",
    name: staffRoleNameByValue.viewer,
    description: "Read-only operational visibility",
    rank: roleRank.viewer
  }
];

/**
 * The dotted permission keys a system role template grants, derived from the
 * compile-time matrix rather than restated.
 *
 * This derivation is the whole anti-drift mechanism. The alternative considered
 * was baking the 86 `role_permissions` rows as SQL literals in the migration -
 * a second copy of the matrix, free to drift from the first, which is exactly
 * the failure this phase exists to prevent. The parity test in
 * `tests/unit/authorization-catalog.test.ts` asserts the derivation and the
 * matrix still agree, per role and by exact count.
 */
export function permissionKeysForSystemRole(role: StaffRoleValue): string[] {
  const matrix = roleAccess[role];

  return accessPermissionKeys
    .filter((column) => matrix[column])
    .map((column) => keyByLegacyColumn[column]);
}

/** Total rows the seed writes into `role_permissions`. Expected: 86. */
export function totalRolePermissionRows(): number {
  return staffRoleValues.reduce(
    (total, role) => total + permissionKeysForSystemRole(role).length,
    0
  );
}
