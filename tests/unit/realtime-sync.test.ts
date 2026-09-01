import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  REALTIME_TABLES,
  TABLE_ENDPOINTS,
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

  it("scopes every subscription to the caller's organization", async () => {
    const { startRealtimeSync } = await import("@/lib/realtime/realtime-sync");
    startRealtimeSync("org-1");

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
