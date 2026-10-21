import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every mutating route in the six phase-1 modules records what it did.
 *
 * Adding one without an entry fails CI; adding it to the allowlist below is a
 * visible diff in a file called "activity coverage", which is the point - the
 * decision that something is NOT worth recording should be reviewable, not
 * implicit in what somebody forgot to type.
 *
 * Built the same way as tests/unit/authz-route-coverage.test.ts, and for the
 * same reason its header gives: an inline `transaction.activityLog.create` is
 * correct today and unenumerable forever. `recordActivity` is a CALL, and a
 * missing call is something a test can see.
 */

const ROOT = path.resolve(__dirname, "../..");
const API = path.join(ROOT, "app", "api");

/**
 * The modules the phase-1 sidebar ships, and the two settings panels that live
 * inside the Settings modal rather than at a route of their own.
 *
 * Billing, Clients, Files, Vendors, Hall maps and Dining are deliberately
 * outside this list. They still write history through their own
 * `activityLog.create` calls, in the older human-readable shape; converting them
 * is follow-up work, not a gap this test should assert against.
 */
const IN_SCOPE = [
  "events",
  "menu",
  "kitchen",
  "calendar",
  "staff",
  "settings",
  // Rendered by the Halls and Event Types panels of the Settings modal.
  "halls",
  "event-types"
];

/**
 * Mutations that are deliberately NOT recorded, each with the reason.
 *
 * Two kinds only: per-viewer UI state, and writes whose history already lives in
 * `authorization_audit` - which the Activity feed unions, so recording them here
 * would show each of them twice.
 */
const NOT_LOGGED: Record<string, string> = {
  "kitchen/notifications/route.ts":
    "PER-VIEWER READ STATE. Marking a kitchen notification read or dismissing it is one person's view of the board, not something the organization did. Recorded, it would be the highest-volume entry in the table and would bury every real change.",
  "kitchen/notifications/[notificationId]/route.ts":
    "Per-viewer read state, the single-notification form of the above.",
  "staff/route.ts":
    "PRIVILEGE, NOT PROFILE. Inviting somebody writes an `authorization_audit` row inside the same transaction as the membership (INV-7, lib/authz/admin/audit.ts). The Activity feed unions that table, so an entry here would duplicate it.",
  "staff/[principalId]/deactivate/route.ts":
    "Deactivate and restore both write `authorization_audit` rows in the privilege transaction, for the same reason as the invite above.",
  "staff/[principalId]/password-reset/route.ts":
    "An administrator issuing somebody's password reset is authority over that person, so it writes a `staff.password.reset` row to `authorization_audit` like deactivation does. The Activity feed unions that table; an entry here would show it twice."
};

function* walk(directory: string): Generator<string> {
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);

    if (statSync(full).isDirectory()) {
      yield* walk(full);
      continue;
    }

    if (entry === "route.ts") yield full;
  }
}

const MUTATION =
  /export\s+(?:async\s+)?(?:function|const)\s+(POST|PATCH|PUT|DELETE)\b/g;
const RECORDS = /\brecordActivity\s*\(/;

/**
 * A handler may delegate its recording to the module it hands the request to.
 *
 * `staff/[principalId]/route.ts` parses one path segment and calls
 * `updateStaffProfile(request, principalId)`; the entry is written inside that
 * function. `events/route.ts` hands off to `createBooking`, and
 * `events/[eventId]/status` to `transitionBooking`. Refusing to follow the call
 * would leave four honest routes failing, and the only remedies would be
 * allowlist entries - free passes on routes that genuinely do record - or a
 * second, duplicate entry per request.
 *
 * Followed ONE level, and only into the specific exported function the route
 * calls, so this cannot be satisfied by a module that records from some OTHER
 * export.
 */
function delegateRecords(source: string): boolean {
  const imports = [
    ...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"(@\/[^"]+)"/g)
  ];

  for (const [, names, specifier] of imports) {
    const called = names
      .split(",")
      .map((name) => name.trim().split(/\s+as\s+/).pop()!.trim())
      .filter((name) => name && new RegExp(`\\b${name}\\s*\\(`).test(source));

    if (called.length === 0) continue;

    const target = path.join(ROOT, `${specifier.slice(2)}.ts`);
    let delegate: string;
    try {
      delegate = readFileSync(target, "utf8");
    } catch {
      continue;
    }

    for (const name of called) {
      // The function's own body: from its declaration to the next top-level
      // export, so a call in the neighbouring export does not count.
      const start = delegate.search(
        new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`)
      );
      if (start === -1) continue;

      const rest = delegate.slice(start);
      const next = rest.slice(1).search(/\nexport\s/);
      const body = next === -1 ? rest : rest.slice(0, next + 1);

      if (RECORDS.test(body)) return true;
    }
  }

  return false;
}

describe("every in-scope mutation records what it did", () => {
  const routes = [...walk(API)]
    .map((file) => ({
      relative: path.relative(API, file).split(path.sep).join("/"),
      source: readFileSync(file, "utf8")
    }))
    .filter((route) => IN_SCOPE.includes(route.relative.split("/")[0]));

  it("finds the routes at all", () => {
    // Without this, a changed directory layout turns every assertion below into
    // a vacuous pass.
    expect(routes.length).toBeGreaterThan(15);
  });

  const mutating = routes.filter(
    (route) =>
      [...route.source.matchAll(MUTATION)].length > 0 ||
      // A pure re-export's handlers live in the module it re-exports from.
      /^\s*export\s*\{[^}]*\bPOST\b[^}]*\}\s*from\s*"[^"]+";?\s*$/m.test(
        route.source.trim()
      )
  );

  it("finds mutating handlers in every in-scope module", () => {
    const modules = new Set(
      mutating.map((route) => route.relative.split("/")[0])
    );

    expect([...modules].sort()).toEqual([...IN_SCOPE].sort());
  });

  it.each(mutating.map((route) => route.relative))(
    "%s records activity or is explicitly exempt",
    (relative) => {
      const route = mutating.find(
        (candidate) => candidate.relative === relative
      );
      if (!route) throw new Error(`Route ${relative} vanished mid-test.`);

      if (relative in NOT_LOGGED) return;

      const handlers = [...route.source.matchAll(MUTATION)].map(
        (match) => match[1]
      );

      expect(
        RECORDS.test(route.source) || delegateRecords(route.source),
        `${relative} exports ${handlers.join(", ") || "re-exported handlers"} but neither calls recordActivity() nor delegates to a function that does`
      ).toBe(true);
    }
  );

  it("every exempt route still exists and still mutates", () => {
    // An allowlist entry for a deleted route is worse than useless: it looks
    // like a considered decision and protects nothing, and the next route to
    // land on that path inherits a free pass.
    const present = new Set(mutating.map((route) => route.relative));

    for (const relative of Object.keys(NOT_LOGGED)) {
      expect(present.has(relative), `${relative} is exempt but gone`).toBe(true);
    }
  });

  it("names a reason for every exemption", () => {
    for (const [relative, reason] of Object.entries(NOT_LOGGED)) {
      expect(
        reason.length,
        `${relative} has no reason recorded`
      ).toBeGreaterThan(40);
    }
  });

  it("nothing writes activity_logs directly any more, in scope", () => {
    // One write path, or the coverage check above is decorative: a route could
    // satisfy it by calling `recordActivity` for one branch and
    // `transaction.activityLog.create` for another.
    for (const route of routes) {
      expect(
        /\.activityLog\.create\s*\(/.test(route.source),
        `${route.relative} calls activityLog.create directly - use recordActivity from @/lib/audit/activity-log`
      ).toBe(false);
    }
  });
});
