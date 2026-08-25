import { permissionKeys, type PermissionKey } from "@/lib/authz/catalog";

/**
 * The five starter roles. SEED DATA, NOT CODE.
 *
 * Nothing in `app/`, `features/` or the rest of `lib/` may branch on a role key
 * from this file (INV-1). It exists so a brand-new organization arrives with a
 * usable set of roles, and so `npm run db:seed-authorization` can converge every
 * existing organization on the same five. A tenant may then edit every cell, add
 * roles of their own, and delete any role they created.
 *
 * RANKS ARE SPARSE (100/200/300/400/500) so a tenant can insert "Front Desk" at
 * 350 or "Head Chef" at 380 without renumbering anything. Lower outranks higher,
 * and every comparison is strict, so equal rank denies.
 *
 * Rank answers WHO MAY ACT ON WHOM. It never answers what may be handed out -
 * that is the subset check in `lib/authz/guards.ts` (INV-6). The moment a tenant
 * authors their own role, rank stops implying anything about content.
 *
 * THE TEST OF WHETHER THIS DESIGN WORKS is the role that is deliberately absent:
 * a bookkeeper holding `invoice.*`, `payment.record`, `report.read` and nothing
 * else. Composing it should need no code at all - a role editor and eleven
 * checkboxes.
 */

export type StarterRole = {
  /** Stable identity for `roles.key`, unique per organization. */
  key: string;
  name: string;
  description: string;
  rank: number;
  permissions: readonly PermissionKey[];
};

function allExcept(...excluded: PermissionKey[]): PermissionKey[] {
  const drop = new Set<PermissionKey>(excluded);
  return permissionKeys.filter((key) => !drop.has(key));
}

/**
 * Owner and Administrator differ ONLY in these rows, and the difference is
 * expressed entirely as `role_permissions` - no code knows Administrator is
 * special, which is exactly INV-1.
 *
 * `role.manage` and `permission.override` are what make the two genuinely
 * different roles rather than the same matrix at two ranks: an Administrator may
 * put people into roles that already exist, but may not author new ones or grant
 * individual exceptions. `bank.connect` is held back for the same reason a
 * bookkeeper is not a treasurer.
 */
const ADMINISTRATOR_WITHHELD: PermissionKey[] = [
  "bank.connect",
  "role.manage",
  "permission.override"
];

export const starterRoles: readonly StarterRole[] = [
  {
    key: "owner",
    name: "Owner",
    description: "Everything, including authoring roles and connecting a bank.",
    rank: 100,
    permissions: permissionKeys
  },
  {
    key: "administrator",
    name: "Administrator",
    description:
      "Runs the organization day to day. Assigns existing roles, but does not author them.",
    rank: 200,
    permissions: allExcept(...ADMINISTRATOR_WITHHELD)
  },
  {
    key: "event-manager",
    name: "Event Manager",
    description:
      "Owns bookings, events, clients, and the floor. Takes payments but cannot refund or void.",
    rank: 300,
    permissions: [
      // Events & bookings - all of it, plus the documents that come off it.
      "calendar.read",
      "booking.create",
      "booking.cancel",
      "event.read",
      "event.create",
      "event.update",
      "event.delete",
      "event.status.update",
      "event.document.generate",

      // Menu - everything except the two destructive-at-scale verbs. Deleting a
      // menu item or replacing the whole menu from a spreadsheet reaches past
      // this role's events into every other manager's.
      "menu.read",
      "menu.create",
      "menu.update",
      "eventmenu.read",
      "eventmenu.update",
      "eventmenu.confirm",

      // Kitchen - read and staffing, not production. Advancing a dish's status
      // is the kitchen's call, not the office's.
      "kitchen.read",
      "kitchen.worker.read",
      "kitchen.worker.assign",

      // Venue - maps, not halls. Drawing a floor plan for tonight is operational;
      // creating a hall and pricing it is configuration.
      "hall.read",
      "hallmap.read",
      "hallmap.update",
      "dining.read",
      "dining.update",

      // Records - all four client verbs except delete, and the rest in full.
      "client.read",
      "client.create",
      "client.update",
      "vendor.read",
      "vendor.manage",
      "file.read",
      "file.create",
      "file.delete",

      // Money - record and notify, per the design. `invoice.read` and
      // `report.read` come with them because a payment has to land on an invoice
      // the recorder can see, and because today's Event Manager already reads
      // both. Refund, void, invoice authoring and the bank feed do NOT.
      "invoice.read",
      "report.read",
      "payment.record",
      "payment.notify",

      // Access - the directory only. No invite, no assign, no override.
      "staff.read",

      // Configuration - read. Changing settings is an Administrator act.
      "settings.read",

      // Scheduling - the recurring school schedule and the shared day notes are
      // this role's daily work.
      "schoolcycle.read",
      "schoolcycle.manage",
      "note.manage"
    ]
  },
  {
    key: "kitchen-staff",
    name: "Kitchen Staff",
    description:
      "Runs production. Sees what is coming and marks it done; touches nothing financial.",
    rank: 400,
    permissions: [
      "calendar.read",
      "event.read",

      "menu.read",
      "eventmenu.read",
      // Confirming an event's menu is the kitchen's sign-off that it can be
      // cooked as written.
      "eventmenu.confirm",

      "kitchen.read",
      "kitchen.status.update",
      "kitchen.event.create",
      "kitchen.worker.read",
      "kitchen.worker.assign",

      "hall.read",
      "hallmap.read",
      "dining.read",

      "note.manage"
    ]
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Read-only operational visibility. No writes anywhere.",
    rank: 500,
    permissions: [
      "calendar.read",
      "event.read",

      "menu.read",
      "eventmenu.read",

      "kitchen.read",
      "kitchen.worker.read",

      "hall.read",
      "hallmap.read",
      "dining.read",

      "client.read",
      "vendor.read",
      "file.read",

      "settings.read",

      "schoolcycle.read"
    ]
  }
];

export const starterRoleKeys: readonly string[] = starterRoles.map(
  (role) => role.key
);

/**
 * The role every provisioned membership starts in when nobody has said
 * otherwise. Inventing a role is already a guess; an administrator raises it
 * deliberately from the access screen.
 *
 * This is the ONE place a starter role key is referenced by name outside the
 * seed, and it is a default rather than a branch: no behaviour depends on which
 * role it names, only that some role is assigned.
 */
export const DEFAULT_MEMBERSHIP_ROLE_KEY = "viewer";

/** The role the founding owner of a new organization is assigned. */
export const FOUNDING_OWNER_ROLE_KEY = "owner";

/** Total `role_permissions` rows the seed writes per organization. */
export function totalStarterRolePermissionRows(): number {
  return starterRoles.reduce((total, role) => total + role.permissions.length, 0);
}
