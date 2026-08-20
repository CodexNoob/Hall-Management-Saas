"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { invalidateAuthenticatedQueryPrefix } from "@/features/dashboard/hooks/use-authenticated-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  REALTIME_TABLES,
  endpointsForTables
} from "@/lib/realtime/table-subscriptions";

/**
 * How long changes are collected before anything is refetched.
 *
 * A single save writes several rows - a dining plan and its tables, an event
 * and its activity log - and each arrives as its own event. Without this, one
 * user pressing Save would fire a burst of refetches at every other open
 * browser. 250ms is below what anyone perceives as lag and collapses a save
 * into one refresh.
 */
const COALESCE_MS = 250;

type SyncState = {
  channel: RealtimeChannel;
  organizationId: string;
  pendingTables: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
};

let state: SyncState | null = null;

function flush() {
  if (!state) return;

  const tables = [...state.pendingTables];
  state.pendingTables.clear();
  state.timer = null;

  for (const endpoint of endpointsForTables(tables)) {
    invalidateAuthenticatedQueryPrefix(endpoint);
  }
}

function queueTable(table: string) {
  if (!state) return;

  state.pendingTables.add(table);
  if (state.timer) return;

  state.timer = setTimeout(flush, COALESCE_MS);
}

/**
 * Keeps every open screen current by refetching what a database change made
 * stale.
 *
 * One channel for the whole app rather than one per screen: Supabase meters
 * concurrent connections, and a dashboard with six panels open would otherwise
 * hold six sockets doing the same job.
 *
 * Rows are filtered to the caller's organization. Realtime also enforces RLS,
 * so this filter is a bandwidth saving rather than the security boundary - but
 * it means another tenant's writes never reach the browser at all.
 */
export function startRealtimeSync(organizationId: string) {
  if (!organizationId) return;

  // Already watching this organization. Switching organizations tears the old
  // channel down first, so a stale subscription cannot keep refetching against
  // the organization the user just left.
  if (state?.organizationId === organizationId) return;
  if (state) stopRealtimeSync();

  const supabase = createSupabaseBrowserClient();
  const channel = supabase.channel(`org-sync:${organizationId}`);

  for (const table of REALTIME_TABLES) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `organization_id=eq.${organizationId}`
      },
      () => queueTable(table)
    );
  }

  channel.subscribe();

  state = {
    channel,
    organizationId,
    pendingTables: new Set(),
    timer: null
  };
}

export function stopRealtimeSync() {
  if (!state) return;

  if (state.timer) clearTimeout(state.timer);
  void createSupabaseBrowserClient().removeChannel(state.channel);
  state = null;
}

/** Test seam: what the sync is currently watching, or null. */
export function getRealtimeSyncOrganizationId() {
  return state?.organizationId ?? null;
}
