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
        /\bauthorize\s*\(|\bauthorizeMember\s*\(/.test(route.source),
        `${relative} exports ${handlers.join(", ")} but never calls authorize() or authorizeMember()`
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
      "support/tickets/[ticketId]/messages/route.ts",
      "support/tickets/route.ts",
      "today-notes/route.ts"
    ]);
  });
});
