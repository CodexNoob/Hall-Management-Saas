import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveRevocationRedirect } from "@/lib/auth/dashboard-routes";
import { isHiddenDashboardRoute } from "@/lib/ui/mvp-features";
import { starterPermissions } from "./auth-session-fixture";

/**
 * SOMEBODY'S ACCESS IS WITHDRAWN WHILE THEY ARE STANDING ON THE PAGE.
 *
 * Not a security control - the API refuses the request underneath whatever
 * happens here. This decides only what the person looks at next, and the
 * distinction it has to get right is between "you never had this" and "you had
 * this a moment ago". The first gets the refusal card; the second gets moved
 * somewhere usable, because it happened to them rather than being something
 * they did.
 */

const KITCHEN = starterPermissions("kitchen-staff");
const EVENT_MANAGER = starterPermissions("event-manager");

const decide = (input: {
  pathname: string;
  previous: readonly string[] | null;
  current: readonly string[];
}) =>
  resolveRevocationRedirect({ ...input, isHidden: isHiddenDashboardRoute });

describe("a revocation while the page is open", () => {
  it("moves them off the page they just lost", () => {
    expect(
      decide({
        pathname: "/dashboard/events",
        previous: EVENT_MANAGER,
        current: KITCHEN
      })
    ).toBe("/dashboard/kitchen");
  });

  it("leaves them alone when nothing was taken away", () => {
    expect(
      decide({
        pathname: "/dashboard/events",
        previous: EVENT_MANAGER,
        current: EVENT_MANAGER
      })
    ).toBeNull();
  });

  /**
   * The distinction the whole function exists for. Typing a url for a page you
   * never had access to is not a revocation, and answering it with a redirect
   * would quietly convert "direct navigation is refused" into "direct
   * navigation is silently rerouted" - which is a different product and a worse
   * one to reason about.
   */
  it("does not reroute a route they never held", () => {
    expect(
      decide({
        pathname: "/dashboard/events",
        previous: KITCHEN,
        current: KITCHEN
      })
    ).toBeNull();
  });

  it("does nothing on the first render, when there is nothing to compare", () => {
    expect(
      decide({
        pathname: "/dashboard/events",
        previous: null,
        current: KITCHEN
      })
    ).toBeNull();
  });

  /**
   * Nowhere to send them. Falling through to the restricted-access state is the
   * honest answer - redirecting to another route that is equally refused would
   * just move the dead end somewhere less obvious.
   */
  it("returns null when they hold nothing that opens any page", () => {
    expect(
      decide({
        pathname: "/dashboard/events",
        previous: EVENT_MANAGER,
        current: []
      })
    ).toBeNull();
  });

  it("never sends them to a page they also cannot open", () => {
    for (const pathname of [
      "/dashboard/events",
      "/dashboard/calendar",
      "/dashboard/clients"
    ]) {
      const destination = decide({
        pathname,
        previous: EVENT_MANAGER,
        current: KITCHEN
      });

      if (!destination) continue;

      expect(
        resolveRevocationRedirect({
          pathname: destination,
          previous: KITCHEN,
          current: KITCHEN,
          isHidden: isHiddenDashboardRoute
        }),
        destination
      ).toBeNull();
    }
  });

  it("never sends them to a module the product does not ship", () => {
    const destination = decide({
      pathname: "/dashboard/events",
      previous: EVENT_MANAGER,
      current: ["invoice.read"]
    });

    if (destination) expect(isHiddenDashboardRoute(destination)).toBe(false);
  });
});

/**
 * THE SERVER HALF, read from the migration rather than assumed.
 *
 * The browser is told "something changed" by one published table,
 * `organizations`, and that only works because all three privilege tables bump
 * its `permissions_epoch`. If any of these triggers were dropped, the
 * corresponding change would stop reaching anybody's screen and the only
 * symptom would be a user reporting that they still have to sign out and back
 * in - the exact bug this was built to fix.
 */
describe("every authorization change bumps the epoch", () => {
  const sql = readFileSync(
    path.join(
      process.cwd(),
      "prisma/migrations/20260827090000_rbac_roles_as_rows/migration.sql"
    ),
    "utf8"
  );

  it("fires when a role is assigned, removed, or a department changes", () => {
    expect(sql).toContain('CREATE TRIGGER "principal_roles_bump_epoch"');
    expect(sql).toMatch(
      /principal_roles_bump_epoch"\s*\n\s*AFTER INSERT OR UPDATE OR DELETE/
    );
  });

  it("fires on a direct grant or deny against one person", () => {
    expect(sql).toContain('CREATE TRIGGER "principal_permissions_bump_epoch"');
  });

  /**
   * The case that reaches EVERY holder of the role at once, which is why it is
   * worth its own test: editing a role's permission set changes what a dozen
   * people may do, and none of them touched anything.
   */
  it("fires when a role's own permission set is edited", () => {
    expect(sql).toContain('CREATE TRIGGER "role_permissions_bump_epoch"');
    expect(sql).toContain("authz_bump_epoch_by_role");
  });

  it("all three write the same column, so one signal covers them", () => {
    expect(sql.match(/SET permissions_epoch = /g)?.length).toBeGreaterThanOrEqual(
      1
    );
    expect(sql).toContain(
      "SET permissions_epoch = organization.permissions_epoch + 1"
    );
  });
});

describe("the publication", () => {
  const MIGRATIONS = path.join(process.cwd(), "prisma/migrations");

  const publicationSql = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(MIGRATIONS, entry.name, "migration.sql"))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file, "utf8"))
    .filter((contents) => contents.includes("supabase_realtime"))
    .join("\n");

  it("publishes organizations, so a permission change can be announced", () => {
    expect(publicationSql).toContain("'organizations'");
  });

  /**
   * And publishes none of the privilege tables. They have RLS on with NO POLICY
   * at all (prisma/supabase-rls.sql: "a privilege table gets no policy, not a
   * narrow one"), so publishing one would deliver nothing to anybody - and
   * adding a policy to make publication work would be inventing read access to
   * the grants themselves in order to refresh a sidebar.
   */
  it("publishes no table that holds a grant", () => {
    for (const table of [
      "'principal_roles'",
      "'principal_permissions'",
      "'role_permissions'",
      "'roles'",
      "'permissions'"
    ]) {
      expect(publicationSql, table).not.toContain(table);
    }
  });
});
