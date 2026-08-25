export const staffRoleValues = [
  "owner",
  "admin",
  "manager",
  "kitchen",
  "billing",
  "viewer"
] as const;

export type StaffRoleValue = (typeof staffRoleValues)[number];

/**
 * `Owner` is deliberately distinct from `Administrator`.
 *
 * Both role values used to render as "Administrator", and
 * `staffRoleValueByName` maps that one name back to `admin` - so opening Edit
 * on an owner and saving a phone number round-tripped their role through
 * `owner -> "Administrator" -> admin` and silently demoted them. Every guard in
 * `lib/auth/guards.ts` compares stored role against submitted role, so the
 * round trip has to be lossless before those comparisons mean anything.
 *
 * `roleTemplates` stays owner-free: Owner is a name the UI can display, not a
 * role the invite form may hand out.
 */
export type StaffRoleName =
  | "Owner"
  | "Administrator"
  | "Event Manager"
  | "Kitchen Staff"
  | "Billing Staff"
  | "Viewer";

export type AccessPermissionKey =
  | "canViewHome"
  | "canViewCalendar"
  | "canCreateBooking"
  | "canViewEventManager"
  | "canViewKitchenDashboard"
  | "canViewMenu"
  | "canEditMenu"
  | "canViewSettings"
  | "canEditSettings"
  | "canEditStaff"
  | "canEditVendors"
  | "canEditClients"
  | "canEditFiles"
  | "canAssignWorkers"
  | "canUpdateKitchenStatus"
  | "canAddKitchenEvents"
  | "canManageSchoolSchedule"
  | "canSeeSchoolEvents"
  | "canSeeSimchaEvents"
  | "canViewPaymentInfo"
  | "canManagePayments"
  | "canSendPaymentEmail"
  | "canUseNiceHomeBackground";

export type RoleAccessMatrix = Record<AccessPermissionKey, boolean>;

export const accessPermissionKeys: AccessPermissionKey[] = [
  "canViewHome",
  "canViewCalendar",
  "canCreateBooking",
  "canViewEventManager",
  "canViewKitchenDashboard",
  "canViewMenu",
  "canEditMenu",
  "canViewSettings",
  "canEditSettings",
  "canEditStaff",
  "canEditVendors",
  "canEditClients",
  "canEditFiles",
  "canAssignWorkers",
  "canUpdateKitchenStatus",
  "canAddKitchenEvents",
  "canManageSchoolSchedule",
  "canSeeSchoolEvents",
  "canSeeSimchaEvents",
  "canViewPaymentInfo",
  "canManagePayments",
  "canSendPaymentEmail",
  "canUseNiceHomeBackground"
];

export const staffRoleNameByValue: Record<StaffRoleValue, StaffRoleName> = {
  owner: "Owner",
  admin: "Administrator",
  manager: "Event Manager",
  kitchen: "Kitchen Staff",
  billing: "Billing Staff",
  viewer: "Viewer"
};

export const staffRoleValueByName: Record<StaffRoleName, StaffRoleValue> = {
  Owner: "owner",
  Administrator: "admin",
  "Event Manager": "manager",
  "Kitchen Staff": "kitchen",
  "Billing Staff": "billing",
  Viewer: "viewer"
};

export const roleTemplates: Array<{
  role: StaffRoleName;
  value: StaffRoleValue;
  description: string;
}> = [
  {
    role: "Administrator",
    value: "admin",
    description: "Full organization access"
  },
  {
    role: "Event Manager",
    value: "manager",
    description: "Bookings, events, clients, files, dining, and kitchen"
  },
  {
    role: "Kitchen Staff",
    value: "kitchen",
    description: "Kitchen dashboard, menu view, workers, and production status"
  },
  {
    role: "Billing Staff",
    value: "billing",
    description: "Invoices, payments, client billing, files, and event billing"
  },
  {
    role: "Viewer",
    value: "viewer",
    description: "Read-only operational visibility"
  }
];

export const roleAccess: Record<StaffRoleValue, RoleAccessMatrix> = {
  owner: {
    canViewHome: true,
    canViewCalendar: true,
    canCreateBooking: true,
    canViewEventManager: true,
    canViewKitchenDashboard: true,
    canViewMenu: true,
    canEditMenu: true,
    canViewSettings: true,
    canEditSettings: true,
    canEditStaff: true,
    canEditVendors: true,
    canEditClients: true,
    canEditFiles: true,
    canAssignWorkers: true,
    canUpdateKitchenStatus: true,
    canAddKitchenEvents: true,
    canManageSchoolSchedule: true,
    canSeeSchoolEvents: true,
    canSeeSimchaEvents: true,
    canViewPaymentInfo: true,
    canManagePayments: true,
    canSendPaymentEmail: true,
    canUseNiceHomeBackground: true
  },
  admin: {
    canViewHome: true,
    canViewCalendar: true,
    canCreateBooking: true,
    canViewEventManager: true,
    canViewKitchenDashboard: true,
    canViewMenu: true,
    canEditMenu: true,
    canViewSettings: true,
    canEditSettings: true,
    canEditStaff: true,
    canEditVendors: true,
    canEditClients: true,
    canEditFiles: true,
    canAssignWorkers: true,
    canUpdateKitchenStatus: true,
    canAddKitchenEvents: true,
    canManageSchoolSchedule: true,
    canSeeSchoolEvents: true,
    canSeeSimchaEvents: true,
    canViewPaymentInfo: true,
    canManagePayments: true,
    canSendPaymentEmail: true,
    canUseNiceHomeBackground: true
  },
  manager: {
    canViewHome: true,
    canViewCalendar: true,
    canCreateBooking: true,
    canViewEventManager: true,
    canViewKitchenDashboard: true,
    canViewMenu: true,
    canEditMenu: true,
    canViewSettings: false,
    canEditSettings: false,
    canEditStaff: false,
    canEditVendors: true,
    canEditClients: true,
    canEditFiles: true,
    canAssignWorkers: true,
    canUpdateKitchenStatus: true,
    canAddKitchenEvents: true,
    canManageSchoolSchedule: true,
    canSeeSchoolEvents: true,
    canSeeSimchaEvents: true,
    canViewPaymentInfo: true,
    canManagePayments: false,
    canSendPaymentEmail: false,
    canUseNiceHomeBackground: false
  },
  kitchen: {
    canViewHome: true,
    canViewCalendar: true,
    canCreateBooking: false,
    canViewEventManager: false,
    canViewKitchenDashboard: true,
    canViewMenu: true,
    canEditMenu: false,
    canViewSettings: false,
    canEditSettings: false,
    canEditStaff: false,
    canEditVendors: false,
    canEditClients: false,
    canEditFiles: false,
    canAssignWorkers: true,
    canUpdateKitchenStatus: true,
    canAddKitchenEvents: true,
    canManageSchoolSchedule: false,
    canSeeSchoolEvents: false,
    canSeeSimchaEvents: true,
    canViewPaymentInfo: false,
    canManagePayments: false,
    canSendPaymentEmail: false,
    canUseNiceHomeBackground: false
  },
  billing: {
    canViewHome: true,
    canViewCalendar: true,
    canCreateBooking: false,
    canViewEventManager: true,
    canViewKitchenDashboard: false,
    canViewMenu: false,
    canEditMenu: false,
    canViewSettings: false,
    canEditSettings: false,
    canEditStaff: false,
    canEditVendors: false,
    canEditClients: true,
    canEditFiles: true,
    canAssignWorkers: false,
    canUpdateKitchenStatus: false,
    canAddKitchenEvents: false,
    canManageSchoolSchedule: false,
    canSeeSchoolEvents: false,
    canSeeSimchaEvents: true,
    canViewPaymentInfo: true,
    canManagePayments: true,
    canSendPaymentEmail: true,
    canUseNiceHomeBackground: false
  },
  viewer: {
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
    canUseNiceHomeBackground: false
  }
};

export const permissionColumns: Array<{
  label: string;
  description: string;
  permissions: AccessPermissionKey[];
}> = [
  {
    label: "Dashboard",
    description: "View the main dashboard overview.",
    permissions: ["canViewHome"]
  },
  {
    label: "Calendar",
    description: "View availability and booking calendar.",
    permissions: ["canViewCalendar"]
  },
  {
    label: "Bookings",
    description: "Create bookings and manage event records.",
    permissions: ["canCreateBooking", "canViewEventManager"]
  },
  {
    label: "Kitchen",
    description: "Use kitchen dashboard and production workflows.",
    permissions: [
      "canViewKitchenDashboard",
      "canAssignWorkers",
      "canUpdateKitchenStatus",
      "canAddKitchenEvents"
    ]
  },
  {
    label: "Menu",
    description: "View and maintain menu items/packages.",
    permissions: ["canViewMenu", "canEditMenu"]
  },
  {
    label: "Billing",
    description: "View and manage invoices, payments, and bank feed.",
    permissions: [
      "canViewPaymentInfo",
      "canManagePayments",
      "canSendPaymentEmail"
    ]
  },
  {
    label: "Staff",
    description: "Invite staff and assign access.",
    permissions: ["canEditStaff"]
  },
  {
    label: "Records",
    description: "Manage clients, vendors, and files.",
    permissions: ["canEditClients", "canEditVendors", "canEditFiles"]
  },
  {
    label: "Settings",
    description: "View and edit organization settings.",
    permissions: ["canViewSettings", "canEditSettings"]
  }
];

export function normalizeStaffRole(value: unknown): StaffRoleValue {
  const role = String(value ?? "viewer")
    .toLowerCase()
    .trim();

  if (role === "owner" || role === "superadmin") return "owner";
  if (role === "administrator") return "admin";
  if (role === "event manager" || role === "eventmanager") return "manager";
  if (role === "kitchen staff" || role === "kitchenstaff") return "kitchen";
  if (role === "billing staff" || role === "billingstaff") return "billing";
  if (role === "member") return "viewer";

  return staffRoleValues.includes(role as StaffRoleValue)
    ? (role as StaffRoleValue)
    : "viewer";
}

export function formatStaffRoleName(value: unknown): StaffRoleName {
  return staffRoleNameByValue[normalizeStaffRole(value)];
}

export function accessForRole(role: StaffRoleValue): RoleAccessMatrix {
  return roleAccess[role];
}

export function hasPermissionGroup(
  access: Partial<Record<AccessPermissionKey, unknown>> | null | undefined,
  permissions: AccessPermissionKey[]
) {
  return permissions.every((permission) => access?.[permission] === true);
}

export function activePermissionLabelsForRole(role: StaffRoleValue) {
  const access = accessForRole(role);
  return permissionColumns
    .filter((column) => hasPermissionGroup(access, column.permissions))
    .map((column) => column.label);
}
