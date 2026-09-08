/**
 * The permission catalog: the only enumerated set in application code (INV-5).
 *
 * Permission keys are a compile-time union because a typo at a call site must be
 * a build failure. Roles, ranks, assignments, scopes and overrides are rows, not
 * code - adding a role is an INSERT. Adding a KEY is a code change on purpose:
 * a key nothing enforces is not a permission.
 *
 * Deliberately free of `server-only` and of Prisma. The seed script, the unit
 * tests and the browser hint layer all import this module outside a Next.js
 * server context.
 *
 * TWO RULES KEEP THIS LIST FINITE
 * ------------------------------
 * 1. Split a verb out only when someone would plausibly hold one and not the
 *    other. Nobody wants "may read vendors but not create them", so vendors get
 *    `vendor.read` / `vendor.manage`. Clients get all four, because "may add a
 *    client, may not delete one" is an ordinary request.
 * 2. `manage` means the whole lifecycle and never coexists with
 *    create/update/delete on the same resource. That is a checkable invariant -
 *    see tests/unit/authz-catalog.test.ts - not a convention.
 *
 * `resource.sub.verb` appears only where the sub-resource has no independent
 * existence: `event.status.update`, `kitchen.worker.assign`.
 */

export const PERMISSION_GROUPS = [
  "Events & bookings",
  "Documents",
  "Menu",
  "Event menus",
  "Kitchen",
  "Dining",
  "Venue",
  "Records",
  "Money",
  "Access",
  "Configuration",
  "Scheduling"
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export type PermissionCatalogEntry = {
  key: PermissionKey;
  label: string;
  description: string;
  group: PermissionGroup;
  /**
   * "Escalates privilege or moves money." Nothing enforces this today - it is
   * the seam the deferred step-up / confirmation work hangs off, and the role
   * editor uses it to mark a checkbox as consequential.
   */
  isDangerous: boolean;
};

/**
 * The catalog, in render order. `sortOrder` in the database is this array's
 * index, so the role editor renders the same order the file reads in.
 *
 * NOTE ON ORDER: entries are grouped, and the groups appear in
 * `PERMISSION_GROUPS` order. A test pins that, so an entry filed under the wrong
 * group cannot slip in and render in a surprising place.
 */
const CATALOG = [
  // ---------------------------------------------------------------- Events
  {
    key: "calendar.read",
    label: "View calendar",
    description: "View availability and the booking calendar.",
    group: "Events & bookings",
    isDangerous: false
  },
  {
    key: "booking.create",
    label: "Create bookings",
    description: "Hold a date and turn an inquiry into a booking.",
    group: "Events & bookings",
    isDangerous: false
  },
  {
    key: "booking.cancel",
    label: "Cancel bookings",
    description: "Release a held date and cancel a booking.",
    group: "Events & bookings",
    isDangerous: false
  },
  {
    key: "event.read",
    label: "View events",
    description: "Open the event manager and read event records.",
    group: "Events & bookings",
    isDangerous: false
  },
  {
    key: "event.create",
    label: "Create events",
    description: "Create event records.",
    group: "Events & bookings",
    isDangerous: false
  },
  {
    key: "event.update",
    label: "Edit events",
    description: "Change event details, timing, hall, and client.",
    group: "Events & bookings",
    isDangerous: false
  },
  {
    key: "event.delete",
    label: "Delete events",
    description: "Permanently remove an event record.",
    group: "Events & bookings",
    isDangerous: false
  },
  {
    key: "event.status.update",
    label: "Change event status",
    description: "Advance or roll back an event's booking status.",
    group: "Events & bookings",
    isDangerous: false
  },

  // ------------------------------------------------------------- Documents
  {
    key: "event.document.generate",
    label: "Generate event documents",
    description: "Render and download event PDFs and contracts.",
    group: "Documents",
    isDangerous: false
  },

  // ------------------------------------------------------------------ Menu
  {
    key: "menu.read",
    label: "View menu",
    description: "View menu items, packages, and add-ons.",
    group: "Menu",
    isDangerous: false
  },
  {
    key: "menu.create",
    label: "Create menu entries",
    description: "Add menu items, packages, and add-ons.",
    group: "Menu",
    isDangerous: false
  },
  {
    key: "menu.update",
    label: "Edit menu entries",
    description: "Change menu items, packages, add-ons, and pricing.",
    group: "Menu",
    isDangerous: false
  },
  {
    key: "menu.delete",
    label: "Delete menu entries",
    description: "Remove menu items, packages, and add-ons.",
    group: "Menu",
    isDangerous: false
  },
  {
    key: "menu.import",
    label: "Bulk import menu",
    description: "Replace or extend the menu from an uploaded file.",
    group: "Menu",
    isDangerous: false
  },

  // ----------------------------------------------------------- Event menus
  {
    key: "eventmenu.read",
    label: "View event menus",
    description: "Read the menu chosen for an event.",
    group: "Event menus",
    isDangerous: false
  },
  {
    key: "eventmenu.update",
    label: "Edit event menus",
    description: "Add, remove, and re-price lines on an event's menu.",
    group: "Event menus",
    isDangerous: false
  },
  {
    key: "eventmenu.confirm",
    label: "Confirm event menus",
    description: "Lock an event's menu as final for the kitchen.",
    group: "Event menus",
    isDangerous: false
  },

  // --------------------------------------------------------------- Kitchen
  {
    key: "kitchen.read",
    label: "View kitchen",
    description: "Open the kitchen dashboard and production views.",
    group: "Kitchen",
    isDangerous: false
  },
  {
    // Split from `kitchen.read` under rule 1 at the top of this file: a cook who
    // may open the board but may only see the dishes assigned to them is an
    // ordinary request, not a contrived one. Holding `kitchen.read` without this
    // key is what makes someone production staff rather than a supervisor, and
    // the kitchen routes read it to decide how much of a sheet to send. Withheld
    // rather than granted by default, so a role that has never been looked at
    // cannot quietly see the whole kitchen.
    key: "kitchen.read.all",
    label: "View the whole kitchen board",
    description: "See every event and dish, not only the ones assigned to you.",
    group: "Kitchen",
    isDangerous: false
  },
  {
    key: "kitchen.status.update",
    label: "Update production status",
    description: "Advance production status on kitchen items.",
    group: "Kitchen",
    isDangerous: false
  },
  {
    key: "kitchen.event.create",
    label: "Create kitchen events",
    description:
      "Create standalone kitchen events with no booking behind them.",
    group: "Kitchen",
    isDangerous: false
  },
  {
    key: "kitchen.worker.read",
    label: "View kitchen workers",
    description: "See the kitchen roster.",
    group: "Kitchen",
    isDangerous: false
  },
  {
    key: "kitchen.worker.assign",
    label: "Assign kitchen workers",
    description: "Add, edit, and assign workers to events and shifts.",
    group: "Kitchen",
    isDangerous: false
  },

  // ---------------------------------------------------------------- Dining
  {
    key: "dining.read",
    label: "View dining plans",
    description: "Read seating and dining plans.",
    group: "Dining",
    isDangerous: false
  },
  {
    key: "dining.update",
    label: "Edit dining plans",
    description: "Change seating, tables, and dining plans.",
    group: "Dining",
    isDangerous: false
  },

  // ----------------------------------------------------------------- Venue
  {
    key: "hall.read",
    label: "View halls",
    description: "Read the hall list, capacities, and pricing.",
    group: "Venue",
    isDangerous: false
  },
  {
    key: "hall.manage",
    label: "Manage halls",
    description: "Create, edit, and retire halls and their pricing.",
    group: "Venue",
    isDangerous: false
  },
  {
    key: "hallmap.read",
    label: "View hall maps",
    description: "Open saved floor plans and shape libraries.",
    group: "Venue",
    isDangerous: false
  },
  {
    key: "hallmap.update",
    label: "Edit hall maps",
    description: "Draw and save floor plans and shape library entries.",
    group: "Venue",
    isDangerous: false
  },

  // --------------------------------------------------------------- Records
  {
    key: "client.read",
    label: "View clients",
    description: "Read the client directory and client history.",
    group: "Records",
    isDangerous: false
  },
  {
    key: "client.create",
    label: "Create clients",
    description: "Add client records.",
    group: "Records",
    isDangerous: false
  },
  {
    key: "client.update",
    label: "Edit clients",
    description: "Change client details and contact information.",
    group: "Records",
    isDangerous: false
  },
  {
    key: "client.delete",
    label: "Delete clients",
    description: "Permanently remove a client record.",
    group: "Records",
    isDangerous: false
  },
  {
    key: "vendor.read",
    label: "View vendors",
    description: "Read the vendor directory.",
    group: "Records",
    isDangerous: false
  },
  {
    key: "vendor.manage",
    label: "Manage vendors",
    description: "Create, edit, and remove vendor records.",
    group: "Records",
    isDangerous: false
  },
  {
    key: "file.read",
    label: "View files",
    description: "Browse and download stored files.",
    group: "Records",
    isDangerous: false
  },
  {
    key: "file.create",
    label: "Upload files",
    description: "Upload files and create folders.",
    group: "Records",
    isDangerous: false
  },
  {
    key: "file.delete",
    label: "Delete files",
    description: "Permanently remove stored files and folders.",
    group: "Records",
    isDangerous: false
  },

  // ----------------------------------------------------------------- Money
  {
    key: "invoice.read",
    label: "View invoices",
    description: "Read invoices, balances, and payment history.",
    group: "Money",
    isDangerous: false
  },
  {
    key: "invoice.create",
    label: "Create invoices",
    description: "Raise a new invoice against an event or client.",
    group: "Money",
    isDangerous: false
  },
  {
    key: "invoice.update",
    label: "Edit invoices",
    description: "Change invoice lines, discounts, taxes, and schedules.",
    group: "Money",
    isDangerous: false
  },
  {
    key: "invoice.void",
    label: "Void invoices",
    description: "Void an issued invoice.",
    group: "Money",
    // Reverses a billed amount without moving cash - the accounting-side twin
    // of a refund.
    isDangerous: true
  },
  {
    key: "payment.record",
    label: "Record payments",
    description: "Record money received against an invoice.",
    group: "Money",
    isDangerous: true
  },
  {
    key: "payment.refund",
    label: "Refund payments",
    description: "Send money back to a client.",
    group: "Money",
    isDangerous: true
  },
  {
    key: "payment.notify",
    label: "Send payment emails",
    description: "Email invoices, receipts, and payment requests to clients.",
    group: "Money",
    // An outbound demand for money in the organization's name.
    isDangerous: true
  },
  {
    key: "bank.connect",
    label: "Connect bank accounts",
    description: "Link and unlink the organization's bank feed.",
    group: "Money",
    isDangerous: true
  },
  {
    key: "report.read",
    label: "View financial reports",
    description: "Read revenue, aging, and reconciliation reports.",
    group: "Money",
    isDangerous: false
  },

  // ---------------------------------------------------------------- Access
  {
    key: "staff.read",
    label: "View staff directory",
    description: "See who works here and what they hold.",
    group: "Access",
    isDangerous: false
  },
  {
    key: "staff.invite",
    label: "Invite staff",
    description: "Send an invitation to a new staff member.",
    group: "Access",
    isDangerous: false
  },
  {
    key: "staff.update",
    label: "Edit staff profiles",
    description: "Change a staff member's name, phone, and title.",
    group: "Access",
    isDangerous: false
  },
  {
    key: "staff.deactivate",
    label: "Deactivate staff",
    description: "Revoke a staff member's access to this organization.",
    group: "Access",
    isDangerous: true
  },
  {
    key: "role.read",
    label: "View roles",
    description: "Read the role list, the catalog, and effective permissions.",
    group: "Access",
    isDangerous: false
  },
  {
    key: "role.manage",
    label: "Author roles",
    description: "Create, edit, and delete roles and what they grant.",
    group: "Access",
    isDangerous: true
  },
  {
    key: "role.assign",
    label: "Assign roles",
    description: "Put people into roles that already exist.",
    group: "Access",
    isDangerous: true
  },
  {
    key: "permission.override",
    label: "Override permissions",
    description: "Grant or deny an individual permission to one person.",
    group: "Access",
    isDangerous: true
  },
  {
    key: "audit.read",
    label: "Read the audit trail",
    description: "Read and export the privilege-change audit log.",
    group: "Access",
    isDangerous: false
  },
  {
    // Its own key rather than folded into `audit.read` under rule 1 at the top
    // of this file: the two answer different questions and someone plausibly
    // holds one and not the other. `audit.read` is the privilege trail - who
    // was granted what. This is the operational history - who edited a hall,
    // deleted a dish, moved a booking. A venue manager wants the second and has
    // no business with the first.
    //
    // The Activity screen asks for BOTH: it renders privilege rows only when
    // the caller also holds `audit.read`, which is what `hasPermission` exists
    // for.
    key: "activity.read",
    label: "Read the activity history",
    description:
      "Read and export the record of what was changed across the organization.",
    group: "Access",
    isDangerous: false
  },

  // --------------------------------------------------------- Configuration
  {
    key: "settings.read",
    label: "View settings",
    description: "Read organization settings.",
    group: "Configuration",
    isDangerous: false
  },
  {
    key: "settings.update",
    label: "Edit settings",
    description: "Change organization settings and preferences.",
    group: "Configuration",
    isDangerous: false
  },
  {
    key: "integration.manage",
    label: "Manage integrations",
    description: "Connect and configure third-party integrations.",
    group: "Configuration",
    isDangerous: false
  },
  {
    key: "eventtype.manage",
    label: "Manage event types",
    description: "Create, edit, and retire event types.",
    group: "Configuration",
    isDangerous: false
  },
  {
    // Its own key rather than `settings.update`, because the two are not the
    // same kind of act: editing a preference is reversible by editing it back,
    // and this erases the organization's work with nothing to edit back from.
    // Held by the Owner alone out of the box - see ADMINISTRATOR_WITHHELD in
    // lib/authz/starter-roles.ts.
    key: "organization.reset",
    label: "Reset organization data",
    description:
      "Permanently delete this organization's events, menus, configuration or staff access. Cannot be undone.",
    group: "Configuration",
    isDangerous: true
  },

  // ------------------------------------------------------------ Scheduling
  {
    key: "schoolcycle.read",
    label: "View school schedule",
    description: "Read school cycles and the recurring schedule.",
    group: "Scheduling",
    isDangerous: false
  },
  {
    key: "schoolcycle.manage",
    label: "Manage school schedule",
    description: "Maintain school cycles and the recurring schedule.",
    group: "Scheduling",
    isDangerous: false
  },
  {
    key: "note.manage",
    label: "Manage day notes",
    description: "Write and clear the shared notes for a day.",
    group: "Scheduling",
    isDangerous: false
  }
] as const satisfies ReadonlyArray<
  Omit<PermissionCatalogEntry, "key"> & { key: string }
>;

/**
 * The compile-time union. A typo at a call site is a build failure, which is the
 * entire reason keys are code and roles are rows.
 */
export type PermissionKey = (typeof CATALOG)[number]["key"];

export const permissionCatalog: readonly PermissionCatalogEntry[] =
  CATALOG as readonly PermissionCatalogEntry[];

export const permissionKeys: readonly PermissionKey[] = CATALOG.map(
  (entry) => entry.key
);

const permissionKeySet: ReadonlySet<string> = new Set<string>(permissionKeys);

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && permissionKeySet.has(value);
}

export const permissionByKey: ReadonlyMap<
  PermissionKey,
  PermissionCatalogEntry
> = new Map(permissionCatalog.map((entry) => [entry.key, entry]));

/** The catalog grouped for rendering, in `PERMISSION_GROUPS` order. */
export function groupedPermissionCatalog(): Array<{
  group: PermissionGroup;
  permissions: PermissionCatalogEntry[];
}> {
  return PERMISSION_GROUPS.map((group) => ({
    group,
    permissions: permissionCatalog.filter((entry) => entry.group === group)
  })).filter((section) => section.permissions.length > 0);
}

/** Database `sort_order`. The index in this file, so file order is render order. */
export function sortOrderOf(key: PermissionKey): number {
  return permissionKeys.indexOf(key);
}
