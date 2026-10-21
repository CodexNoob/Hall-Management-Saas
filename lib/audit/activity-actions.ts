import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The activity catalog: every action an organization's history can record.
 *
 * Keys are a compile-time union for the same reason permission keys are
 * (`lib/authz/catalog.ts`): a typo at a call site must be a build failure, not a
 * row nobody can filter for. `activity_logs.action_type` is a bare `String`
 * column and always will be - it holds legacy human-readable strings from the
 * Billing and Clients routes that predate this file - so the type is the ONLY
 * thing keeping new writes consistent.
 *
 * Deliberately free of `server-only` and of Prisma. The settings panel imports
 * `activityActionLabel` to render, and the coverage test imports the keys.
 *
 * TWO RULES KEEP THIS LIST HONEST
 * ------------------------------
 * 1. `resource.verb`, lowercase, past tense. `resource.sub.verb` only where the
 *    sub-resource has no independent existence: `event.guest_counts.updated`,
 *    `kitchen.worker.assigned`.
 * 2. One key per thing an operator would recognise as a distinct act. Not one
 *    key per route - `PATCH /api/kitchen` multiplexes several operations, and
 *    each gets its own key.
 *
 * MODULE IS DERIVED HERE, NOT STORED. `activity_logs` has an append-only
 * trigger on it and no `module` column, and adding one would mean a migration
 * plus a backfill of rows that cannot be updated. Deriving it from the key
 * costs nothing and lets an unrecognised legacy string fall back to "Other" and
 * still render.
 */

/**
 * The six modules the phase-1 sidebar ships, plus the two the feed has to be
 * able to name without owning: "Access" for rows that come from
 * `authorization_audit`, and "Other" for account-level acts and for the legacy
 * strings written by routes this catalog does not cover yet.
 */
export type ActivityModule =
  | "Events"
  | "Menu"
  | "Kitchen"
  | "Calendar"
  | "Staff"
  | "Settings"
  | "Access"
  | "Other";

/** In render order, which is also the order the filter dropdown lists them. */
export const ACTIVITY_MODULES: readonly ActivityModule[] = [
  "Events",
  "Menu",
  "Kitchen",
  "Calendar",
  "Staff",
  "Settings",
  "Access",
  "Other"
];

export type ActivityActionEntry = {
  key: ActivityAction;
  label: string;
  module: ActivityModule;
};

const CATALOG = [
  // ---------------------------------------------------------------- Events
  { key: "event.created", label: "Event created", module: "Events" },
  { key: "event.updated", label: "Event edited", module: "Events" },
  {
    // Head counts are what the kitchen sheet cuts every quantity from, so they
    // are split out of `event.updated`: "who changed the numbers" is the
    // question this trail gets asked most.
    key: "event.guest_counts.updated",
    label: "Guest counts changed",
    module: "Events"
  },
  {
    key: "event.status.updated",
    label: "Event status changed",
    module: "Events"
  },
  { key: "event.menu.updated", label: "Event menu edited", module: "Events" },
  {
    key: "event.menu.confirmed",
    label: "Event menu confirmed",
    module: "Events"
  },
  {
    key: "event.package.applied",
    label: "Package applied to event",
    module: "Events"
  },
  {
    key: "event.package.removed",
    label: "Package removed from event",
    module: "Events"
  },
  {
    key: "event.timeline.updated",
    label: "Event timeline changed",
    module: "Events"
  },
  {
    key: "event.payment.recorded",
    label: "Payment recorded",
    module: "Events"
  },
  {
    key: "event.calendar.exported",
    label: "Event sent to calendar",
    module: "Events"
  },

  // ------------------------------------------------------------------ Menu
  { key: "menu.item.created", label: "Menu item added", module: "Menu" },
  { key: "menu.item.updated", label: "Menu item edited", module: "Menu" },
  { key: "menu.item.deleted", label: "Menu item deleted", module: "Menu" },
  { key: "menu.package.created", label: "Package created", module: "Menu" },
  { key: "menu.package.updated", label: "Package edited", module: "Menu" },
  { key: "menu.addon.created", label: "Add-on created", module: "Menu" },
  { key: "menu.imported", label: "Menu imported", module: "Menu" },

  // --------------------------------------------------------------- Kitchen
  {
    key: "kitchen.event.created",
    label: "Kitchen event created",
    module: "Kitchen"
  },
  {
    key: "kitchen.event.deleted",
    label: "Kitchen event deleted",
    module: "Kitchen"
  },
  {
    key: "kitchen.status.updated",
    label: "Production status changed",
    module: "Kitchen"
  },
  {
    // The board swapping what is cooked, which is a different act from the
    // office editing the menu (`event.menu.updated`) - same outcome on the
    // sheet, and the two are worth telling apart when the client asks why they
    // got something else.
    key: "kitchen.dish.replaced",
    label: "Dish replaced on the board",
    module: "Kitchen"
  },
  {
    key: "kitchen.addon.replaced",
    label: "Add-on replaced on the board",
    module: "Kitchen"
  },
  { key: "kitchen.worker.added", label: "Worker added", module: "Kitchen" },
  { key: "kitchen.worker.updated", label: "Worker edited", module: "Kitchen" },
  { key: "kitchen.worker.removed", label: "Worker removed", module: "Kitchen" },
  {
    key: "kitchen.worker.assigned",
    label: "Worker assigned",
    module: "Kitchen"
  },

  // -------------------------------------------------------------- Calendar
  {
    key: "calendar.blocked_date.created",
    label: "Date blocked",
    module: "Calendar"
  },
  {
    key: "calendar.blocked_date.removed",
    label: "Date unblocked",
    module: "Calendar"
  },

  // ----------------------------------------------------------------- Staff
  //
  // Invite, deactivate and restore are deliberately ABSENT. Those already write
  // `authorization_audit` rows in the same transaction as the privilege change
  // (INV-7, see lib/authz/admin/audit.ts), and the activity feed unions that
  // table - so a key here would show every one of them twice.
  {
    key: "staff.profile.updated",
    label: "Staff profile edited",
    module: "Staff"
  },

  // -------------------------------------------------------------- Settings
  { key: "settings.updated", label: "Settings changed", module: "Settings" },
  { key: "settings.hall.created", label: "Hall added", module: "Settings" },
  { key: "settings.hall.updated", label: "Hall edited", module: "Settings" },
  { key: "settings.hall.deleted", label: "Hall removed", module: "Settings" },
  {
    key: "settings.event_type.created",
    label: "Event type added",
    module: "Settings"
  },
  {
    key: "settings.event_type.updated",
    label: "Event type edited",
    module: "Settings"
  },
  {
    key: "settings.event_type.deleted",
    label: "Event type removed",
    module: "Settings"
  },
  {
    key: "organization.reset.performed",
    label: "Organization data reset",
    module: "Settings"
  },

  // ----------------------------------------------------------------- Other
  //
  // Account-level acts. These predate the catalog and already used dotted keys,
  // so they are listed rather than rewritten - the rows already in the table
  // carry these exact strings and stay readable.
  {
    key: "auth.login.success",
    label: "Signed in",
    module: "Other"
  },
  { key: "auth.password.set", label: "Password set", module: "Other" },
  {
    // Somebody deciding their account may be compromised is exactly the moment
    // worth being able to reconstruct later, so it is recorded like any other
    // privileged act rather than happening silently in the browser.
    key: "auth.sessions.revoked",
    label: "Signed out other sessions",
    module: "Other"
  },
  {
    // Turning a second factor on or off changes what it takes to become this
    // person, so both directions are recorded. The OFF one matters more: it is
    // what an attacker who already has the password would do next.
    key: "auth.mfa.enabled",
    label: "Two-factor authentication enabled",
    module: "Other"
  },
  {
    key: "auth.mfa.disabled",
    label: "Two-factor authentication disabled",
    module: "Other"
  },
  {
    // An authenticator appeared on the account without the email-verified
    // enrollment grant - somebody with the password attaching their own - and
    // was removed. The most important security entry in this catalog.
    key: "auth.mfa.untrusted_removed",
    label: "Unverified authenticator removed",
    module: "Other"
  },
  {
    key: "organization.onboarding.completed",
    label: "Onboarding completed",
    module: "Other"
  },
  {
    key: "plaid.connection.created",
    label: "Bank connected",
    module: "Other"
  },
  { key: "plaid.sync.completed", label: "Bank sync completed", module: "Other" },
  {
    // Not a phase-1 module, but it went through the same helper as the four
    // above, so it comes along rather than being left as the one loose string.
    key: "support.ticket.created",
    label: "Support ticket opened",
    module: "Other"
  }
] as const satisfies ReadonlyArray<
  Omit<ActivityActionEntry, "key"> & { key: string }
>;

/** The compile-time union. A typo at a call site is a build failure. */
export type ActivityAction = (typeof CATALOG)[number]["key"];

export const activityActions: readonly ActivityActionEntry[] =
  CATALOG as readonly ActivityActionEntry[];

export const activityActionKeys: readonly ActivityAction[] = CATALOG.map(
  (entry) => entry.key
);

const byKey: ReadonlyMap<string, ActivityActionEntry> = new Map(
  activityActions.map((entry) => [entry.key, entry])
);

/**
 * How an action reads on screen.
 *
 * An unknown key is returned verbatim rather than replaced with a placeholder:
 * the legacy rows say "Client Created" and "Invoice Status Changed", which are
 * already sentences a person can read. Hiding them behind "Unknown action"
 * would lose real history to a naming decision made after it was written.
 */
export function activityActionLabel(actionType: string): string {
  return byKey.get(actionType)?.label ?? actionType;
}

/**
 * The same label, as a catalog key, or null for a legacy string.
 *
 * The API composes the English `label` for the CSV export and for clients that
 * do nothing with it; the screen translates from the action key instead, which
 * is what `activity_logs.action_type` actually stores. The key is derived
 * rather than listed a second time - `activity.` plus the action - so a new
 * action that forgets its catalog entry misses the lookup visibly instead of
 * silently rendering the wrong wording.
 */
export function activityActionLabelKey(actionType: string): MessageKey | null {
  if (!byKey.has(actionType)) return null;

  return `activity.${actionType}` as MessageKey;
}

/** The module chip's wording. Every module has an entry, so this never fails. */
export function activityModuleLabelKey(module: string): MessageKey {
  return `activity.module.${module}` as MessageKey;
}

/** Which module an action belongs to. Anything unrecognised is "Other". */
export function activityActionModule(actionType: string): ActivityModule {
  return byKey.get(actionType)?.module ?? "Other";
}

/** Every key filed under one module - what the module filter expands to. */
export function activityActionsInModule(
  module: ActivityModule
): readonly ActivityAction[] {
  return activityActions
    .filter((entry) => entry.module === module)
    .map((entry) => entry.key);
}

export function isActivityAction(value: unknown): value is ActivityAction {
  return typeof value === "string" && byKey.has(value);
}
