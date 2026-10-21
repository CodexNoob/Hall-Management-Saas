import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every exported route handler reaches a guard.
 *
 * Adding a route without one fails CI; adding one to the allowlist below is a
 * visible diff in a file called "route coverage", which is the point - the
 * decision to make something public should be reviewable, not implicit in what
 * somebody forgot to type.
 */

const ROOT = path.resolve(__dirname, "../..");
const API = path.join(ROOT, "app", "api");

/**
 * The genuinely public surface, each with the mechanism that actually protects
 * it. None of the four is session RBAC, and that is why none of them can be
 * covered by `authorize()`.
 */
const PUBLIC_ROUTES: Record<string, string> = {
  "health/route.ts": "Liveness probe. Reveals nothing and touches no tenant.",
  "newsletter/subscribe/route.ts":
    "Public marketing form. Rate-limited, writes one row to a table with no tenant.",
  "support/contact/route.ts":
    "Public contact form. Same shape as the newsletter subscribe.",
  "client-portal/[eventId]/route.ts":
    "CAPABILITY LINK. The unguessable URL is the grant - one event, read-mostly. Never a principal, never a role.",
  "client-portal/[eventId]/selections/route.ts":
    "Capability link, the one write it permits.",
  "billing/stripe/webhook/route.ts":
    "PLATFORM CALLBACK. Stripe signature verification, not a tenant actor at all.",
  "auth/session/route.ts":
    "The sign-in exchange itself. It verifies a Supabase token and provisions - it is what produces the principal everything else authorizes against."
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

const HANDLER = /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PATCH|PUT|DELETE)\b/g;
const GUARD = /\bauthorize\s*\(|\bauthorizeMember\s*\(/;

/**
 * A handler may delegate its guard to the module it hands the request to.
 *
 * `staff/[principalId]/route.ts` parses one path segment and calls
 * `updateStaffProfile(request, principalId)`; the guard is the first line of
 * that function. Refusing to follow the call would leave two honest routes
 * failing and the only remedies would be an allowlist entry - a free pass on a
 * route that genuinely needs a guard - or authorizing twice per request.
 *
 * Followed ONE level, and only into the specific exported function the route
 * calls, so this cannot be satisfied by a module that guards some OTHER export.
 */
function delegateIsGuarded(source: string): boolean {
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
      // export, so a guard on the neighbouring export does not count.
      const start = delegate.search(
        new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`)
      );
      if (start === -1) continue;

      const rest = delegate.slice(start);
      const next = rest.slice(1).search(/\nexport\s/);
      const body = next === -1 ? rest : rest.slice(0, next + 1);

      if (GUARD.test(body)) return true;
    }
  }

  return false;
}

describe("every API route reaches a guard", () => {
  const routes = [...walk(API)].map((file) => ({
    relative: path.relative(API, file).split(path.sep).join("/"),
    source: readFileSync(file, "utf8")
  }));

  it("finds the routes at all", () => {
    // Without this, a changed directory layout turns every assertion below into
    // a vacuous pass.
    expect(routes.length).toBeGreaterThan(40);
  });

  it.each(routes.map((route) => route.relative))(
    "%s is guarded or explicitly public",
    (relative) => {
      const route = routes.find((candidate) => candidate.relative === relative);
      if (!route) throw new Error(`Route ${relative} vanished mid-test.`);

      // A pure re-export delegates its guard to the module it re-exports from,
      // which is scanned in its own right.
      const isReExport = /^\s*export\s*\{[^}]*\}\s*from\s*"[^"]+";?\s*$/m.test(
        route.source.trim()
      );

      if (isReExport || relative in PUBLIC_ROUTES) return;

      const handlers = [...route.source.matchAll(HANDLER)].map(
        (match) => match[1]
      );

      expect(
        handlers.length,
        `${relative} exports no handler and is not listed as public`
      ).toBeGreaterThan(0);

      expect(
        GUARD.test(route.source) || delegateIsGuarded(route.source),
        `${relative} exports ${handlers.join(", ")} but neither calls authorize()/authorizeMember() nor delegates to a function that does`
      ).toBe(true);
    }
  );

  it("every allowlisted route still exists", () => {
    // An allowlist entry for a deleted route is worse than useless: it looks
    // like a considered decision and protects nothing, and the next route to
    // land on that path inherits a free pass.
    const present = new Set(routes.map((route) => route.relative));

    for (const relative of Object.keys(PUBLIC_ROUTES)) {
      expect(present.has(relative), `${relative} is allowlisted but gone`).toBe(
        true
      );
    }
  });

  it("names a reason for every public route", () => {
    for (const [relative, reason] of Object.entries(PUBLIC_ROUTES)) {
      expect(reason.length, `${relative} has no reason recorded`).toBeGreaterThan(
        20
      );
    }
  });

  /**
   * THE ROUTES AN UNCONFIRMED BROWSER CAN REACH. Every other route refuses it
   * with `device_confirmation_required`. Adding one here is a visible diff
   * that has to say why refusing it would leave the person no way forward.
   */
  it("pins which routes answer before the device is confirmed", () => {
    const exempt = routes
      .filter((route) => /allowUnconfirmedDevice:\s*true/.test(route.source))
      .map((route) => route.relative)
      .sort();

    expect(exempt).toEqual([
      // Records the password an invite or recovery link was opened to set.
      // The dashboard holds the person on /set-password until it has, so a
      // refusal here loops them there before any gate can show.
      "auth/password-set/route.ts",
      // The two routes that clear the device gate.
      "me/devices/confirm/route.ts",
      "me/devices/resend/route.ts",
      // 2FA comes BEFORE the device gate, so its set-up and its recording
      // must answer on a browser that is not confirmed yet.
      "me/mfa/route.ts",
      "me/security-code/send/route.ts",
      "me/security-code/verify/route.ts"
    ]);
  });

  /**
   * THE ROUTES A SESSION THAT OWES ITS SECOND FACTOR CAN REACH. Same rule as
   * the device list: each one would otherwise leave the person no way to
   * comply, and none serves organization data.
   */
  it("pins which routes answer before the second factor is satisfied", () => {
    const exempt = routes
      .filter((route) => /allowUnsatisfiedMfa:\s*true/.test(route.source))
      .map((route) => route.relative)
      .sort();

    expect(exempt).toEqual([
      // See the device list above: invite and recovery password bookkeeping.
      "auth/password-set/route.ts",
      // Protected enrolment: the email code, then recording the new factor.
      "me/mfa/route.ts",
      "me/security-code/send/route.ts",
      "me/security-code/verify/route.ts"
    ]);
  });

  it("lists which routes are member-gated rather than permission-gated", () => {
    // `authorizeMember` is a real decision - it denies strangers, deactivated
    // accounts and members of other tenants - but it is not keyed on a
    // permission, so the set that uses it is worth seeing in one place.
    const memberGated = routes
      .filter((route) => /\bauthorizeMember\s*\(/.test(route.source))
      .map((route) => route.relative)
      .sort();

    expect(memberGated).toEqual([
      "auth/password-set/route.ts",
      // Reads the caller's own role assignments and effective permissions for
      // the My Account page. Read-only, and there is no id in the request - an
      // employee may always see what they themselves are allowed to do.
      "me/access/route.ts",
      // Writes only the caller's own `users.language`. Keying it on a
      // permission would put a preference about somebody's own screen behind
      // `settings.update`, which the people who need a second language do not
      // hold - see components/forms/profile-language-field.tsx.
      // Stamps "a person just did something" on the caller's own session, and
      // marks that session a shared display. Both are facts about the device
      // in front of the person making the request; there is no id here that
      // could name somebody else's, and no permission it could sensibly be
      // keyed on - every employee's session times out.
      "me/activity/route.ts",
      // The caller's own browsers: list and remove (me/devices, removal needing
      // the code from me/devices/removal-code), and confirm or resend for THIS
      // browser only, identified by its httpOnly cookie. Every id in a request
      // is looked up under the caller's own user id, so none can reach another
      // person's device.
      "me/devices/confirm/route.ts",
      "me/devices/removal-code/route.ts",
      "me/devices/resend/route.ts",
      "me/devices/route.ts",
      "me/language/route.ts",
      // Records that the caller's own second factor changed, by asking
      // Supabase rather than by believing the browser. Every employee enrols
      // their own account, so there is no permission this could sensibly be
      // keyed on - and gating it would mean an administrator had to be present
      // for somebody to turn on 2FA.
      "me/mfa/route.ts",
      // The caller's own notification switches - the row Settings has always
      // edited, reachable without `settings.read`, which the people being
      // emailed mostly do not hold.
      "me/notifications/route.ts",
      // Emails the caller's own reset link, to the address on their own row -
      // "forgot my current password" from inside My Account. Nothing in the
      // request names a person or an address.
      "me/password-reset/route.ts",
      // Changes the caller's own password after proving the current one.
      // Rate-limited; there is no id here that could name another account.
      "me/password/route.ts",
      // Name and phone on the caller's own user row, through a strict schema
      // that refuses title, department and anything touching privilege.
      "me/profile/route.ts",
      // Protected 2FA enrolment: email a code to the caller's OWN address, and
      // check it - turning it into a short-lived grant bound to this session.
      // Both are exempt from the two-factor check like me/mfa, because they
      // are the first steps of getting a factor. Neither names another person.
      "me/security-code/send/route.ts",
      "me/security-code/verify/route.ts",
      // Ends the caller's own other sessions and nothing else. Gating it on a
      // permission would put the response to "my laptop was stolen" behind an
      // administrator.
      "me/sessions/route.ts",
      "support/tickets/[ticketId]/messages/route.ts",
      "support/tickets/route.ts",
      "today-notes/route.ts"
    ]);
  });
});
