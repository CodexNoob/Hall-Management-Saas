import { permissionKeys, type PermissionKey } from "@/lib/authz/catalog";

/**
 * The six starter roles. SEED DATA, NOT CODE.
 *
 * Nothing in `app/`, `features/` or the rest of `lib/` may branch on a role key
 * from this file (INV-1). It exists so a brand-new organization arrives with a
 * usable set of roles, and so `npm run db:seed-authorization` can converge every
 * existing organization on the same six. A tenant may then edit every cell, add
 * roles of their own, and delete any role they created.
 *
 * RANKS ARE SPARSE (100/200/300/350/400/500) so a tenant can still insert a role
 * of their own without renumbering anything. Lower outranks higher, and every
 * comparison is strict, so equal rank denies. Kitchen Manager took 350 - one of
 * the gaps this scheme exists to make available - rather than pushing Kitchen
 * Staff down, because a rank is a row a tenant may already have reasoned about.
 *
 * NOTE ON CONVERGENCE. `ensureStarterRoles` is create-only for permissions by
 * design, so an organization that already has a `kitchen-staff` role keeps every
 * key it was seeded with even after this file drops one. Removing a key here
 * changes what NEW organizations get; revoking it from existing ones is a
 * deliberate, audited migration - `prisma/kitchen-role-split.sql`.
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
  "permission.override",
  // Erasing the organization's events, menus, configuration or staff list is
  // not day-to-day administration, and it is the one act in the catalog with
  // nothing to undo it. It stays with whoever answers for the account. A tenant
  // that wants their administrator to hold it can grant it - that is what a
  // role editor is for - but nobody is given it by default.
  "organization.reset"
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
      // is the kitchen's call, not the office's. The whole board, because an
      // office manager answering "is the Friday wedding ready" needs every dish
      // on it, not the none that are assigned to them.
      "kitchen.read",
      "kitchen.read.all",
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
    /*
     * Runs the kitchen. Rank 350 uses the gap the header promises, between the
     * office's Event Manager and the cooks.
     *
     * This role is the whole of what Kitchen Staff used to hold. Staffing a
     * board, raising a production job and signing a menu off as cookable are
     * supervision, and they were sitting with everyone who cooks - so a cook
     * could hand another cook's dish to a third, or lock a menu, with nobody
     * having decided they should. Splitting them out is what lets Kitchen Staff
     * below be genuinely restricted rather than restricted-looking.
     */
    key: "kitchen-manager",
    name: "Kitchen Manager",
    description:
      "Runs the kitchen. Staffs the board, raises production jobs and signs menus off as cookable.",
    rank: 350,
    permissions: [
      "calendar.read",
      "event.read",

      "menu.read",
      "eventmenu.read",
      // The kitchen's sign-off that a menu can be cooked as written. An approval,
      // so it sits with the person who answers for the kitchen.
      "eventmenu.confirm",

      "kitchen.read",
      "kitchen.read.all",
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
    /*
     * Production only, and deliberately without `kitchen.read.all`.
     *
     * That absence is the role: the kitchen routes send a holder of this set
     * only the dishes assigned to them, and drop events that have none. Every
     * key that lets somebody direct other people's work - assigning a worker,
     * creating a production job, confirming a menu - moved to Kitchen Manager
     * above. What is left is "see my dishes and mark them done".
     *
     * `kitchen.status.update` stays, but the route additionally refuses a status
     * write against a dish assigned to somebody else: the permission says the
     * holder may advance production, and the assignment check says whose.
     */
    key: "kitchen-staff",
    name: "Kitchen Staff",
    description:
      "Cooks. Sees the dishes assigned to them and marks them done; directs nobody and touches nothing financial.",
    rank: 400,
    permissions: [
      "calendar.read",
      "event.read",

      "menu.read",
      "eventmenu.read",

      "kitchen.read",
      "kitchen.status.update",
      "kitchen.worker.read",

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

      // The whole board: this role exists to see, and a viewer is never a cook,
      // so scoping them to their own assignments would show them an empty
      // kitchen rather than a restricted one.
      "kitchen.read",
      "kitchen.read.all",
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
  return starterRoles.reduce(
    (total, role) => total + role.permissions.length,
    0
  );
}
