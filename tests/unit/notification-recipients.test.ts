import { describe, expect, it } from "vitest";

import type { PermissionKey } from "@/lib/authz/catalog";
import type { ScopeFilter } from "@/lib/authz/types";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationCategoryFor,
  selectNotificationRecipients,
  type NotificationCandidate,
  type NotificationPreferences,
  type NotificationSubject
} from "@/lib/notifications/recipients";

/**
 * WHO GETS THE EMAIL.
 *
 * Almost every test here is about somebody NOT being mailed, and that weighting
 * is the design. Missing a notification is an annoyance; sending one is an
 * irreversible disclosure - a cook told a booking was cancelled, a hall-scoped
 * manager told about a venue they cannot open, a former employee whose
 * membership was switched off still hearing about tonight's event.
 */

const HALL_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HALL_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ALL: ScopeFilter = { hallIds: "all", eventTypeIds: "all" };
const ONLY_A: ScopeFilter = { hallIds: [HALL_A], eventTypeIds: "all" };

/** A candidate, with everything that would let them through already true. */
function candidate(
  overrides: Partial<NotificationCandidate> & { userId: string }
): NotificationCandidate {
  return {
    email: `${overrides.userId}@example.com`,
    isActive: true,
    preferences: null,
    permissions: grants(["event.read"]),
    ...overrides
  };
}

function grants(
  keys: PermissionKey[],
  scope: ScopeFilter = ALL
): ReadonlyMap<PermissionKey, ScopeFilter> {
  return new Map(keys.map((key) => [key, scope]));
}

function prefs(
  overrides: Partial<NotificationPreferences> = {}
): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...overrides };
}

const select = (
  subject: NotificationSubject,
  candidates: NotificationCandidate[]
) =>
  selectNotificationRecipients({ subject, candidates }).map(
    (recipient) => recipient.userId
  );

const eventCreated: NotificationSubject = {
  kind: "event.created",
  hallId: HALL_A
};

describe("the account gate", () => {
  it("does not notify an inactive member", () => {
    // The membership was switched off. They may still hold a valid Supabase
    // session; they are not staff any more and tonight's booking is not their
    // business.
    expect(
      select(eventCreated, [
        candidate({ userId: "active" }),
        candidate({ userId: "removed", isActive: false })
      ])
    ).toEqual(["active"]);
  });

  it("does not notify somebody with no usable address", () => {
    expect(
      select(eventCreated, [
        candidate({ userId: "no-email", email: null }),
        candidate({ userId: "blank-email", email: "   " })
      ])
    ).toEqual([]);
  });
});

describe("the preference gate", () => {
  it("honours the master switch over everything else", () => {
    // Category on, master off. The master switch is what somebody reaches for
    // when they mean "stop emailing me", and it has to win.
    expect(
      select(eventCreated, [
        candidate({
          userId: "opted-out",
          preferences: prefs({
            emailNotifications: false,
            eventConfirmations: true
          })
        })
      ])
    ).toEqual([]);
  });

  it("honours the category switch", () => {
    expect(
      select(eventCreated, [
        candidate({
          userId: "no-events",
          preferences: prefs({ eventConfirmations: false })
        })
      ])
    ).toEqual([]);
  });

  /**
   * Somebody who has never opened the Settings screen has no row. What happens
   * then has to match the column defaults exactly, or "never saved" behaves
   * differently from "saved without changing anything".
   */
  it("uses the documented defaults when no row has been saved", () => {
    expect(
      select(eventCreated, [candidate({ userId: "never-saved" })])
    ).toEqual(["never-saved"]);
  });

  /**
   * And the default that goes the other way. Product marketing is opt-IN; a
   * default of true would have mailed every user of every tenant the first
   * time this shipped.
   */
  it("does not send announcements to somebody who never opted in", () => {
    expect(
      select({ kind: "system.announcement" }, [
        candidate({ userId: "never-saved" }),
        candidate({
          userId: "opted-in",
          preferences: prefs({ systemAnnouncements: true })
        })
      ])
    ).toEqual(["opted-in"]);
  });
});

describe("the access gate", () => {
  it("does not notify somebody without the permission", () => {
    expect(
      select(eventCreated, [
        candidate({ userId: "reader" }),
        candidate({ userId: "cook", permissions: grants(["kitchen.read"]) })
      ])
    ).toEqual(["reader"]);
  });

  /**
   * HALL SCOPE, and the reason `EffectiveAccess` resolves it per permission.
   * A manager scoped to Hall A hears about Hall A and learns nothing about
   * Hall B - not that it has bookings, not that one was cancelled.
   */
  it("respects hall scope", () => {
    const staff = [
      candidate({ userId: "org-wide" }),
      candidate({
        userId: "hall-a-only",
        permissions: grants(["event.read"], ONLY_A)
      })
    ];

    expect(select({ kind: "event.created", hallId: HALL_A }, staff)).toEqual([
      "org-wide",
      "hall-a-only"
    ]);

    expect(select({ kind: "event.created", hallId: HALL_B }, staff)).toEqual([
      "org-wide"
    ]);
  });

  it("tells everybody holding the key about an event with no hall yet", () => {
    // A booking that has not been given a room is not secretly about some hall,
    // and refusing everybody would mean nobody hears about a draft at all.
    expect(
      select({ kind: "event.created", hallId: null }, [
        candidate({
          userId: "hall-a-only",
          permissions: grants(["event.read"], ONLY_A)
        })
      ])
    ).toEqual(["hall-a-only"]);
  });
});

describe("the assigned coordinator", () => {
  /**
   * Always told, because it is their event. This is the one place the access
   * gate is skipped - and the account and preference gates deliberately are
   * NOT: somebody who turned email off has still turned it off.
   */
  it("is included even without the permission", () => {
    expect(
      select({ ...eventCreated, coordinatorUserId: "coordinator" }, [
        candidate({ userId: "coordinator", permissions: grants([]) })
      ])
    ).toEqual(["coordinator"]);
  });

  it("is included even when scoped to another hall", () => {
    expect(
      select({ kind: "event.created", hallId: HALL_B, coordinatorUserId: "coordinator" }, [
        candidate({
          userId: "coordinator",
          permissions: grants(["event.read"], ONLY_A)
        })
      ])
    ).toEqual(["coordinator"]);
  });

  it("is still not mailed when inactive", () => {
    expect(
      select({ ...eventCreated, coordinatorUserId: "coordinator" }, [
        candidate({ userId: "coordinator", isActive: false })
      ])
    ).toEqual([]);
  });

  it("is still not mailed when they opted out", () => {
    expect(
      select({ ...eventCreated, coordinatorUserId: "coordinator" }, [
        candidate({
          userId: "coordinator",
          preferences: prefs({ emailNotifications: false })
        })
      ])
    ).toEqual([]);
  });

  it("is not mailed twice when they also hold the permission", () => {
    expect(
      select({ ...eventCreated, coordinatorUserId: "coordinator" }, [
        candidate({ userId: "coordinator" })
      ])
    ).toEqual(["coordinator"]);
  });
});

describe("kitchen notifications", () => {
  const menuChange: NotificationSubject = {
    kind: "event.kitchen",
    hallId: HALL_A
  };

  /**
   * `kitchen.read` alone means "may open the board", and the board shows a cook
   * only their own dishes. Whole-board access is what makes somebody entitled
   * to hear about every event.
   */
  it("notifies whole-board kitchen users", () => {
    expect(
      select(menuChange, [
        candidate({
          userId: "kitchen-manager",
          permissions: grants(["kitchen.read", "kitchen.read.all"])
        })
      ])
    ).toEqual(["kitchen-manager"]);
  });

  it("notifies a cook assigned to this event", () => {
    expect(
      select(menuChange, [
        candidate({
          userId: "assigned-cook",
          permissions: grants(["kitchen.read"]),
          isAssignedToEventKitchen: true
        })
      ])
    ).toEqual(["assigned-cook"]);
  });

  /**
   * The one this rule exists for. Without it, a menu change on a Tuesday
   * wedding mails every cook in the building including the ones rostered
   * somewhere else entirely.
   */
  it("does not notify a cook who is not on this event", () => {
    expect(
      select(menuChange, [
        candidate({
          userId: "other-cook",
          permissions: grants(["kitchen.read"]),
          isAssignedToEventKitchen: false
        })
      ])
    ).toEqual([]);
  });

  it("respects hall scope for whole-board users too", () => {
    expect(
      select({ kind: "event.kitchen", hallId: HALL_B }, [
        candidate({
          userId: "hall-a-kitchen",
          permissions: grants(["kitchen.read", "kitchen.read.all"], ONLY_A)
        })
      ])
    ).toEqual([]);
  });
});

describe("billing notifications", () => {
  const invoiceRaised: NotificationSubject = {
    kind: "event.billing",
    hallId: HALL_A
  };

  it("notifies only people with billing access", () => {
    expect(
      select(invoiceRaised, [
        candidate({ userId: "bookkeeper", permissions: grants(["invoice.read"]) }),
        candidate({ userId: "event-manager-no-money", permissions: grants(["event.read"]) })
      ])
    ).toEqual(["bookkeeper"]);
  });

  /**
   * A separate switch, so a venue can have booking confirmations without money
   * emails. Turning off `eventConfirmations` must not silence invoices and
   * vice versa.
   */
  it("answers to the billing switch, not the event one", () => {
    expect(
      select(invoiceRaised, [
        candidate({
          userId: "events-off",
          permissions: grants(["invoice.read"]),
          preferences: prefs({ eventConfirmations: false })
        }),
        candidate({
          userId: "billing-off",
          permissions: grants(["invoice.read"]),
          preferences: prefs({ billingAlerts: false })
        })
      ])
    ).toEqual(["events-off"]);
  });
});

describe("system announcements", () => {
  /**
   * Not event-specific, so none of the access or hall rules apply. A cook and
   * an owner both hear that maintenance is scheduled.
   */
  it("ignores permissions and halls entirely", () => {
    expect(
      select({ kind: "system.announcement" }, [
        candidate({
          userId: "cook",
          permissions: grants([]),
          preferences: prefs({ systemAnnouncements: true })
        }),
        candidate({
          userId: "hall-a-only",
          permissions: grants(["event.read"], ONLY_A),
          preferences: prefs({ systemAnnouncements: true })
        })
      ])
    ).toEqual(["cook", "hall-a-only"]);
  });

  it("still honours the master switch", () => {
    expect(
      select({ kind: "system.announcement" }, [
        candidate({
          userId: "opted-out",
          preferences: prefs({
            emailNotifications: false,
            systemAnnouncements: true
          })
        })
      ])
    ).toEqual([]);
  });
});

describe("the rule table", () => {
  it("maps every kind to the switch a venue would expect", () => {
    expect(notificationCategoryFor("event.created")).toBe("eventConfirmations");
    expect(notificationCategoryFor("event.updated")).toBe("eventConfirmations");
    expect(notificationCategoryFor("event.cancelled")).toBe(
      "eventConfirmations"
    );
    expect(notificationCategoryFor("event.kitchen")).toBe("eventConfirmations");
    expect(notificationCategoryFor("event.billing")).toBe("billingAlerts");
    expect(notificationCategoryFor("system.announcement")).toBe(
      "systemAnnouncements"
    );
  });

  it("matches the column defaults in the schema", () => {
    // "Never saved a preference" and "saved without changing anything" have to
    // behave identically, which means these two lists cannot drift.
    expect(DEFAULT_NOTIFICATION_PREFERENCES).toEqual({
      emailNotifications: true,
      eventConfirmations: true,
      billingAlerts: true,
      systemAnnouncements: false
    });
  });
});
