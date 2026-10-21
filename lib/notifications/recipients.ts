import type { PermissionKey } from "@/lib/authz/catalog";
import type { ScopeFilter } from "@/lib/authz/types";

/**
 * WHO GETS THE EMAIL.
 *
 * The whole point of this module is the word "who". A notification system that
 * mails every member on every change is not a feature with a preferences
 * screen, it is a spam problem with a settings page in front of it - and it
 * leaks: a cook learns a booking was cancelled, a hall-scoped manager learns
 * about a venue they cannot open, and the preference toggles are decoration.
 *
 * FOUR INDEPENDENT GATES, and a recipient has to pass all of them:
 *
 *   1. ACCOUNT    - active member, real email address.
 *   2. PREFERENCE - the master switch AND the category switch.
 *   3. ACCESS     - holds the permission this notification is about.
 *   4. SCOPE      - that permission reaches THIS event's hall.
 *
 * Gate 4 is the one that is easy to get wrong and invisible when you do.
 * `EffectiveAccess` resolves scope PER PERMISSION, so somebody who is Kitchen
 * Staff at Hall A and Viewer organization-wide has different scopes for
 * different keys. Asking "what is this person's scope" instead of "what is this
 * person's scope FOR THIS KEY" silently widens the narrow one and mails them
 * about halls they cannot see.
 *
 * PURE, AND TAKES EVERYTHING EXPLICITLY. No database, no clock, no environment.
 * Selecting recipients is the part of this feature that can leak information to
 * the wrong person, so it is the part that should be completely testable - and
 * every rule below can be written as a table.
 */

/** What happened, which decides both the permission and the preference. */
export type NotificationKind =
  /** A new confirmed booking. */
  | "event.created"
  /** Date, time, hall, status, coordinator, or a client-facing detail. */
  | "event.updated"
  | "event.cancelled"
  /** A menu or production change. Kitchen rules apply. */
  | "event.kitchen"
  /** An invoice or payment against an event. Billing rules apply. */
  | "event.billing"
  /** Product updates and maintenance. Not event-specific at all. */
  | "system.announcement";

export type NotificationCategory =
  | "eventConfirmations"
  | "billingAlerts"
  | "systemAnnouncements";

/**
 * Which preference switch a notification answers to, and which permission it
 * requires.
 *
 * A TABLE RATHER THAN BRANCHES, so "what does this kind need" is one place
 * somebody can read, and adding a kind without deciding both answers is a type
 * error rather than an email to everybody.
 */
const NOTIFICATION_RULES: Record<
  NotificationKind,
  {
    category: NotificationCategory;
    /**
     * The key that means "this person is entitled to know". Null for system
     * announcements, which are not about a record at all.
     */
    permission: PermissionKey | null;
  }
> = {
  "event.created": { category: "eventConfirmations", permission: "event.read" },
  "event.updated": { category: "eventConfirmations", permission: "event.read" },
  "event.cancelled": {
    category: "eventConfirmations",
    permission: "event.read"
  },
  /**
   * `kitchen.read` rather than `event.read`: a menu change is production news,
   * and the office roles that hold `event.read` already hold `kitchen.read`
   * too. Gating it on `event.read` would mail a cook nothing and an accountant
   * everything.
   */
  "event.kitchen": { category: "eventConfirmations", permission: "kitchen.read" },
  /**
   * `invoice.read`, and the billing category rather than the event one. A venue
   * that wants booking confirmations without money emails gets exactly that.
   */
  "event.billing": { category: "billingAlerts", permission: "invoice.read" },
  "system.announcement": {
    category: "systemAnnouncements",
    permission: null
  }
};

/**
 * Preferences as stored, or as they default for somebody who has never been
 * given a row.
 *
 * THE DEFAULTS MATTER AND THEY ARE NOT UNIFORM. `emailNotifications`,
 * `eventConfirmations` and `billingAlerts` default ON, because somebody running
 * events expects to hear about them. `systemAnnouncements` defaults OFF,
 * because product marketing is opt-in and a default of true would mail every
 * user of every tenant the first time this shipped. These mirror the column
 * defaults in `prisma/schema.prisma` exactly; changing one without the other
 * would make "no row yet" behave differently from "a row saved unchanged".
 */
export type NotificationPreferences = {
  emailNotifications: boolean;
  eventConfirmations: boolean;
  billingAlerts: boolean;
  systemAnnouncements: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailNotifications: true,
  eventConfirmations: true,
  billingAlerts: true,
  systemAnnouncements: false
};

export type NotificationCandidate = {
  userId: string;
  email: string | null;
  /** Both the user and the membership must be live. */
  isActive: boolean;
  /** Null when this person has never saved preferences. */
  preferences: NotificationPreferences | null;
  /**
   * Every key they hold, each with the scope THAT key resolves to. Straight
   * from `EffectiveAccess.permissions` - see the note above about why the
   * per-key scope is the only correct one to ask.
   */
  permissions: ReadonlyMap<PermissionKey, ScopeFilter>;
  /**
   * They are named on a kitchen line for this event.
   *
   * What lets a cook without `kitchen.read.all` hear about the one event they
   * are actually working on, and nothing else.
   */
  isAssignedToEventKitchen?: boolean;
};

export type NotificationSubject = {
  kind: NotificationKind;
  /** The hall this event belongs to. Null for a system announcement. */
  hallId?: string | null;
  /** Always told, if active and opted in. Null when nobody is assigned. */
  coordinatorUserId?: string | null;
};

/** What the sender needs, and deliberately nothing else. */
export type NotificationRecipient = { userId: string; email: string };

/**
 * The recipients for one notification.
 *
 * Returns a de-duplicated list. The coordinator can also satisfy the ordinary
 * access rules, and mailing somebody twice about one cancellation is the kind
 * of detail that makes people turn a feature off.
 */
export function selectNotificationRecipients(input: {
  subject: NotificationSubject;
  candidates: readonly NotificationCandidate[];
}): NotificationRecipient[] {
  const { subject, candidates } = input;
  const rule = NOTIFICATION_RULES[subject.kind];
  const recipients = new Map<string, NotificationRecipient>();

  for (const candidate of candidates) {
    // GATE 1 - the account.
    if (!candidate.isActive) continue;

    const email = candidate.email?.trim();
    if (!email) continue;

    // GATE 2 - the preferences. The master switch first: somebody who turned
    // email off has turned it off, whatever the category says.
    const preferences =
      candidate.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;

    if (!preferences.emailNotifications) continue;
    if (!preferences[rule.category]) continue;

    // GATES 3 AND 4 - access and scope. Skipped only for the coordinator, who
    // is told about their own event by definition, and for system
    // announcements, which are not about a record.
    const isCoordinator =
      Boolean(subject.coordinatorUserId) &&
      candidate.userId === subject.coordinatorUserId;

    if (!isCoordinator && rule.permission) {
      if (!canBeTold(candidate, subject, rule.permission)) continue;
    }

    recipients.set(candidate.userId, { userId: candidate.userId, email });
  }

  return [...recipients.values()];
}

/**
 * Does this person hold the key, and does it reach this hall?
 *
 * Split out because the kitchen rule is a genuine exception and burying it in
 * the loop above would hide it.
 */
function canBeTold(
  candidate: NotificationCandidate,
  subject: NotificationSubject,
  permission: PermissionKey
): boolean {
  const scope = candidate.permissions.get(permission);

  if (!scope) return false;
  if (!hallInScope(scope, subject.hallId)) return false;

  /**
   * THE KITCHEN EXCEPTION.
   *
   * `kitchen.read` alone means "may open the board", and the board shows a cook
   * only the dishes assigned to them - so holding it is not the same as being
   * entitled to hear about every event. Whole-board access
   * (`kitchen.read.all`) is, and so is being named on a line for this event.
   *
   * Without this, a menu change on a Tuesday wedding mails every cook in the
   * building including the ones rostered elsewhere.
   */
  if (subject.kind === "event.kitchen") {
    const wholeBoard = candidate.permissions.get("kitchen.read.all");

    if (wholeBoard && hallInScope(wholeBoard, subject.hallId)) return true;

    return Boolean(candidate.isAssignedToEventKitchen);
  }

  return true;
}

/**
 * Does a permission's scope reach this hall?
 *
 * An event with no hall is reachable by anybody holding the key: a booking that
 * has not been given a room yet is not secretly about some hall, and refusing
 * everybody would mean nobody is ever told about a draft.
 */
function hallInScope(scope: ScopeFilter, hallId: string | null | undefined) {
  if (scope.hallIds === "all") return true;
  if (!hallId) return true;

  return scope.hallIds.includes(hallId);
}

/** Which preference switch a kind answers to. Exported for the settings screen. */
export function notificationCategoryFor(
  kind: NotificationKind
): NotificationCategory {
  return NOTIFICATION_RULES[kind].category;
}
