/**
 * The four resets, described once for both sides of the wire.
 *
 * Deliberately free of `server-only` and of Prisma: the panel in Settings draws
 * its cards from these descriptions and the API validates against the same
 * phrases, so what somebody is told they are about to lose and what the server
 * then deletes cannot drift apart. The deletions themselves live in
 * features/settings/server/organization-reset.ts.
 */

import type { MessageKey } from "@/lib/i18n/messages";

export const RESET_SCOPES = [
  "events",
  "events-and-menus",
  "settings",
  "full-account"
] as const;

export type ResetScope = (typeof RESET_SCOPES)[number];

/**
 * What the person has to type to arm each one.
 *
 * Different words per scope on purpose: a single "RESET" would let somebody who
 * meant to clear last season's events confirm a full account wipe with the
 * muscle memory of the previous dialog.
 */
export const RESET_CONFIRMATIONS: Record<ResetScope, string> = {
  events: "DELETE EVENTS",
  "events-and-menus": "DELETE EVENTS AND MENUS",
  settings: "RESET SETTINGS",
  "full-account": "RESET ACCOUNT"
};

export type ResetDescription = {
  title: string;
  summary: string;
  removes: string[];
  keeps: string[];
};

/**
 * The same four descriptions, as catalog keys.
 *
 * The English below stays where it is: the reset route writes the scope's title
 * into the activity log, which is a record rather than a screen, and a log line
 * that changes language with whoever happened to press the button is not a
 * record anybody can search. The panel reads these instead.
 */
export const RESET_DESCRIPTION_KEYS: Record<
  ResetScope,
  {
    title: MessageKey;
    summary: MessageKey;
    removes: MessageKey[];
    keeps: MessageKey[];
  }
> = {
  events: {
    title: "reset.events.title",
    summary: "reset.events.summary",
    removes: [
      "reset.events.removes1",
      "reset.events.removes2",
      "reset.events.removes3",
      "reset.events.removes4"
    ],
    keeps: ["reset.events.keeps1", "reset.events.keeps2"]
  },
  "events-and-menus": {
    title: "reset.events-and-menus.title",
    summary: "reset.events-and-menus.summary",
    removes: [
      "reset.events-and-menus.removes1",
      "reset.events-and-menus.removes2",
      "reset.events-and-menus.removes3",
      "reset.events-and-menus.removes4"
    ],
    keeps: ["reset.events-and-menus.keeps1"]
  },
  settings: {
    title: "reset.settings.title",
    summary: "reset.settings.summary",
    removes: [
      "reset.settings.removes1",
      "reset.settings.removes2",
      "reset.settings.removes3",
      "reset.settings.removes4"
    ],
    keeps: ["reset.settings.keeps1", "reset.settings.keeps2"]
  },
  "full-account": {
    title: "reset.full-account.title",
    summary: "reset.full-account.summary",
    removes: [
      "reset.full-account.removes1",
      "reset.full-account.removes2",
      "reset.full-account.removes3",
      "reset.full-account.removes4"
    ],
    keeps: ["reset.full-account.keeps1", "reset.full-account.keeps2"]
  }
};

export const RESET_DESCRIPTIONS: Record<ResetScope, ResetDescription> = {
  events: {
    title: "Event reset",
    summary: "Deletes every event and everything recorded against one.",
    removes: [
      "All events, confirmed and held",
      "Their menus, kitchen progress and kitchen notifications",
      "Their invoices, payments, receipts and refunds",
      "Their generated documents, emails, files and dining plans"
    ],
    keeps: [
      "The menu library, packages and add-ons",
      "Halls, clients, staff and every setting"
    ]
  },
  "events-and-menus": {
    title: "Events and menu reset",
    summary:
      "Everything the event reset removes, plus the menu library it was built from.",
    removes: [
      "Everything in the event reset",
      "Saved menu items, categories and services",
      "Packages, add-ons and tablecloth options",
      "Kitchen-only events raised against a menu"
    ],
    keeps: ["Halls, clients, staff and every setting"]
  },
  settings: {
    title: "Settings reset",
    summary:
      "Puts configuration, roles and permissions back to how a new organization starts.",
    removes: [
      "Every custom role and per-person permission exception",
      "Every other person's access, and their sign-in",
      "Service accounts and the authorization history",
      "Saved preferences, notification settings and payment settings"
    ],
    keeps: [
      "Events, menus and halls",
      "Your own account, and the organization's plan"
    ]
  },
  "full-account": {
    title: "Full account reset",
    summary:
      "Empties the organization completely, leaving the account and your own login.",
    removes: [
      "Everything the other three resets remove",
      "Halls, hall maps, event types and blocked dates",
      "Clients, vendors, files and stored documents",
      "Kitchen workers, day notes and the activity history"
    ],
    keeps: [
      "The organization itself and its subscription",
      "Your own login, membership and the Owner role"
    ]
  }
};
