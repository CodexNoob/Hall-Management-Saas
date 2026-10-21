import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  REALTIME_TABLES,
  TABLE_ENDPOINTS,
  affectsAuthorization,
  endpointsForTable,
  endpointsForTables
} from "@/lib/realtime/table-subscriptions";

describe("realtime table map", () => {
  it("routes a changed table to every endpoint that shows it", () => {
    // A dining plan is read by the Dining Manager and shown on the event, so a
    // save in one has to refresh the other.
    expect(endpointsForTable("dining_plans")).toEqual([
      "/api/dining",
      "/api/events"
    ]);
  });

  /**
   * The session list is pushed by proxy. `user_sessions` is deny-all and has no
   * `organization_id`, so it can be neither published nor filtered - but a new
   * sign-in writes `auth.login.success` in the same request that records the
   * session row, and that table is already published and tenant-scoped.
   *
   * If this mapping is dropped, the Security panel silently stops updating and
   * only the thirty-second poll keeps it honest.
   */
  it("refreshes the session list when a sign-in is recorded", () => {
    expect(endpointsForTable("activity_logs")).toContain("/api/me/sessions");
  });

  /**
   * How a permission change reaches a browser that is already open.
   *
   * `organizations` is published for one reason: all three privilege tables
   * bump its `permissions_epoch` through triggers, so one row covers a role
   * assigned, a role removed, a department moved, a direct override and a
   * role's own permission set being edited. It carries no query endpoint
   * because what it triggers is a session refetch, not a list refresh.
   */
  it("treats an organization row as an authorization signal", () => {
    expect(affectsAuthorization(["organizations"])).toBe(true);
    expect(endpointsForTable("organizations")).toEqual([]);
    expect(REALTIME_TABLES).toContain("organizations");
  });

  it("publishes no table that holds a grant", () => {
    // RLS on with NO POLICY at all, by design. Publishing one would deliver
    // nothing; adding a policy so a sidebar could refresh would be inventing
    // read access to the grants themselves.
    for (const table of [
      "principal_roles",
      "principal_permissions",
      "role_permissions",
      "roles",
      "permissions"
    ]) {
      expect(REALTIME_TABLES, table).not.toContain(table);
    }
  });

  it("does not try to subscribe to the session table itself", () => {
    // Publishing it would mean granting the browser direct SELECT on rows
    // holding IP addresses, which is exactly what its deny-all RLS prevents.
    expect(REALTIME_TABLES).not.toContain("user_sessions");
  });

  it("ignores a table nothing reads instead of refetching everything", () => {
    expect(endpointsForTable("some_write_only_audit_table")).toEqual([]);
  });

  it("de-duplicates endpoints across a batch of changes", () => {
    // One save touches several tables; the reader should be refetched once.
    const endpoints = endpointsForTables([
      "events",
      "activity_logs",
      "dining_plans"
    ]);

    expect(new Set(endpoints).size).toBe(endpoints.length);
    expect(endpoints).toContain("/api/events");
  });

  it("uses endpoint prefixes, so parameterised urls are covered", () => {
    // `/api/events` has to reach `/api/events/<id>` and `/api/dashboard` has to
    // reach `/api/dashboard?startDate=...`, which is why invalidation matches
    // on the prefix rather than the whole url.
    for (const endpoints of Object.values(TABLE_ENDPOINTS)) {
      for (const endpoint of endpoints) {
        expect(endpoint.startsWith("/api/")).toBe(true);
        expect(endpoint.endsWith("/")).toBe(false);
        expect(endpoint).not.toContain("?");
      }
    }
  });

  it("derives the replicated table list from the map so they cannot drift", () => {
    expect(REALTIME_TABLES).toEqual(Object.keys(TABLE_ENDPOINTS).sort());
  });

  /*
   * The Preview portal drawer reads `/api/client-portal/<id>`, and that endpoint
   * was in this map nowhere at all - so the one screen whose entire claim is
   * "this is what the client sees" was the one screen no change ever reached.
   * Every table below feeds something the portal draws.
   */
  it("refreshes the client portal preview from everything it renders", () => {
    for (const table of [
      "events",
      "packages",
      "menu_items",
      "add_ons",
      "invoices",
      // The venue's logo and header background live in the settings document.
      "organization_settings"
    ]) {
      expect(endpointsForTable(table)).toContain("/api/client-portal");
    }
  });

  // Adding a KEY here would mean adding a table to the Supabase publication;
  // adding an endpoint to an existing key is a client-side change only. This
  // pins that distinction so the map cannot quietly get ahead of the database.
  it("adds no replicated table beyond the ones the publication already covers", () => {
    expect(REALTIME_TABLES).not.toContain("tablecloth_options");
  });
});

describe("realtime publication migration", () => {
  const MIGRATIONS = path.join(process.cwd(), "prisma/migrations");
  const PUBLICATION = "20260820210000_enable_realtime_publication";

  const sql = readFileSync(
    path.join(MIGRATIONS, PUBLICATION, "migration.sql"),
    "utf8"
  );

  /**
   * Every migration that adds to the publication, the first one included.
   *
   * New tables get a new migration rather than being appended to the original:
   * a shared database has already applied that one, and rewriting an applied
   * migration makes `prisma migrate deploy` refuse for everybody. So the
   * published set is the union of all of them, not the contents of the first.
   */
  const publicationSql = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(MIGRATIONS, entry.name, "migration.sql"))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file, "utf8"))
    .filter((contents) => contents.includes("supabase_realtime"));

  /** Every table a migration after the publication one has since dropped. */
  const droppedTables = new Set(
    readdirSync(MIGRATIONS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name > PUBLICATION)
      .flatMap((entry) => {
        const file = path.join(MIGRATIONS, entry.name, "migration.sql");

        return existsSync(file)
          ? [
              ...readFileSync(file, "utf8").matchAll(
                /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?([a-z_]+)"?/gi
              )
            ].map((match) => match[1])
          : [];
      })
  );

  it("publishes exactly the tables the client subscribes to", () => {
    // A table the client watches but nobody publishes is a screen that silently
    // never updates; one published but unwatched is replication overhead for
    // nothing. Neither shows up at runtime, so it is checked here.
    //
    // Minus whatever a LATER migration has since dropped. This migration is a
    // historical artifact and does not get edited, but Postgres removes a table
    // from every publication when it is dropped - so a name still listed here
    // for a table that no longer exists is not a gap in coverage, and demanding
    // the client keep subscribing to it would be the actual mistake.
    const published = [
      ...new Set(
        publicationSql.flatMap((contents) =>
          [...contents.matchAll(/^\s*'([a-z_]+)',?$/gm)].map(
            (match) => match[1]
          )
        )
      )
    ]
      .filter((table) => !droppedTables.has(table))
      .sort();

    expect(published).toEqual(REALTIME_TABLES);
  });

  it("is safe to run twice", () => {
    // One shared database serves several branches, so a migration that threw
    // "is already member of publication" would block whoever ran it second.
    expect(sql).toContain("pg_publication_tables");
    expect(sql).toContain("CONTINUE");
  });

  it("leaves replica identity alone", () => {
    // FULL would put every column of every write on the wire, including ones
    // the subscriber has no right to read. The client only needs the table
    // name. Matched as a statement rather than a phrase - the migration's own
    // comment explains this decision and would otherwise trip the check.
    const statements = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");

    expect(statements).not.toMatch(/REPLICA\s+IDENTITY/i);
  });
});

describe("realtime sync lifecycle", () => {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis()
  };
  const supabase = {
    channel: vi.fn().mockReturnValue(channel),
    removeChannel: vi.fn()
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    vi.doMock("@/lib/supabase/browser", () => ({
      createSupabaseBrowserClient: () => supabase
    }));
    vi.doMock("@/features/dashboard/hooks/use-authenticated-query", () => ({
      invalidateAuthenticatedQueryPrefix: vi.fn()
    }));
  });

  it("opens one channel for the whole app, not one per table", async () => {
    const { startRealtimeSync } = await import("@/lib/realtime/realtime-sync");
    startRealtimeSync("org-1");

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(channel.on).toHaveBeenCalledTimes(REALTIME_TABLES.length);
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
  });

  /**
   * ANOTHER TENANT CANNOT MOVE THIS USER'S PERMISSIONS.
   *
   * Two independent reasons, and this pins the first. Every subscription -
   * including the `organizations` one that carries the authorization signal -
   * is filtered to the caller's own organization, and Realtime enforces RLS on
   * top of that, so another tenant's row never arrives at all.
   *
   * The second is that the payload is never read: an event only causes a
   * refetch of `POST /api/auth/session`, which recomputes the permission set
   * server-side for the authenticated user. Even a forged event could not widen
   * anybody's access, because nothing about what a person may do is taken off
   * the wire.
   */
  it("scopes every subscription to the caller's organization", async () => {
    const { startRealtimeSync } = await import("@/lib/realtime/realtime-sync");
    startRealtimeSync("org-1");

    expect(channel.on.mock.calls.length).toBe(REALTIME_TABLES.length);

    for (const call of channel.on.mock.calls) {
      expect(call[1].filter).toBe("organization_id=eq.org-1");
      expect(call[1].schema).toBe("public");
    }
  });

  it("does not reopen the channel for the same organization", async () => {
    const { startRealtimeSync } = await import("@/lib/realtime/realtime-sync");
    startRealtimeSync("org-1");
    startRealtimeSync("org-1");

    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it("tears the old channel down when the organization changes", async () => {
    // Otherwise the previous organization keeps streaming and refetching after
    // the user has switched away from it.
    const { startRealtimeSync } = await import("@/lib/realtime/realtime-sync");
    startRealtimeSync("org-1");
    startRealtimeSync("org-2");

    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    expect(supabase.channel).toHaveBeenLastCalledWith("org-sync:org-2");
  });

  it("stops cleanly on sign-out", async () => {
    const { startRealtimeSync, stopRealtimeSync, getRealtimeSyncOrganizationId } =
      await import("@/lib/realtime/realtime-sync");

    startRealtimeSync("org-1");
    expect(getRealtimeSyncOrganizationId()).toBe("org-1");

    stopRealtimeSync();
    expect(getRealtimeSyncOrganizationId()).toBeNull();
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("ignores an empty organization id rather than subscribing to everything", async () => {
    const { startRealtimeSync } = await import("@/lib/realtime/realtime-sync");
    startRealtimeSync("");

    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it("keeps local development quiet unless realtime is explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { startRealtimeSync, isRealtimeSyncEnabled } = await import(
      "@/lib/realtime/realtime-sync"
    );

    expect(isRealtimeSyncEnabled()).toBe(false);
    startRealtimeSync("org-1");

    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it("allows local development to opt back into realtime", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_REALTIME_SYNC", "true");
    const { startRealtimeSync, isRealtimeSyncEnabled } = await import(
      "@/lib/realtime/realtime-sync"
    );

    expect(isRealtimeSyncEnabled()).toBe(true);
    startRealtimeSync("org-1");

    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it("collapses a burst of changes into one refetch per endpoint", async () => {
    vi.useFakeTimers();
    const { startRealtimeSync } = await import("@/lib/realtime/realtime-sync");
    const { invalidateAuthenticatedQueryPrefix } = await import(
      "@/features/dashboard/hooks/use-authenticated-query"
    );

    startRealtimeSync("org-1");

    // One save writes the plan and its activity log; both arrive separately.
    const fire = (table: string) => {
      const call = channel.on.mock.calls.find((c) => c[1].table === table);
      call?.[2]({});
    };
    fire("dining_plans");
    fire("dining_plans");
    fire("events");

    expect(invalidateAuthenticatedQueryPrefix).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);

    const invalidated = vi
      .mocked(invalidateAuthenticatedQueryPrefix)
      .mock.calls.map((call) => call[0]);

    // /api/events is reached by both tables but refetched once.
    expect(invalidated.filter((url) => url === "/api/events")).toHaveLength(1);
    expect(invalidated).toContain("/api/dining");

    vi.useRealTimers();
  });
});
