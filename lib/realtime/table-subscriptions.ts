/**
 * Which read endpoints a table's rows appear in.
 *
 * Realtime tells us a row in some table changed; this says which cached GETs
 * are now stale because of it. Keyed on the Postgres table name, because that
 * is what `postgres_changes` reports.
 *
 * Endpoints are matched as prefixes, so `/api/dashboard` covers
 * `/api/dashboard?startDate=...` and `/api/events` covers `/api/events/<id>`.
 * That is deliberately generous: refetching one endpoint too many costs a
 * request, while missing one leaves a screen showing something that is no
 * longer true - which is the whole problem this exists to solve.
 *
 * `/api/client-portal` is listed beside the staff endpoints on every table the
 * portal renders from. It is read by the Preview portal drawer in Event
 * Manager, and it was previously in this map nowhere at all - so the one screen
 * whose whole purpose is "this is what the client sees" was the one screen
 * nothing ever refreshed. With the cache's two-minute stale window, confirming
 * a menu and immediately opening the preview showed the menu as it was before.
 */
export const TABLE_ENDPOINTS: Record<string, readonly string[]> = {
  events: [
    "/api/events",
    "/api/dashboard",
    "/api/kitchen",
    "/api/dining",
    "/api/clients",
    "/api/billing",
    "/api/client-portal"
  ],
  event_menus: ["/api/events", "/api/kitchen", "/api/menu"],
  event_menu_lines: ["/api/events", "/api/kitchen", "/api/menu"],
  // `packages`, not `event_packages` - the model is EventPackage but its
  // @@map is "packages", and postgres_changes reports the table name.
  packages: ["/api/events", "/api/menu", "/api/kitchen", "/api/client-portal"],
  event_types: ["/api/event-types", "/api/events"],
  dining_plans: ["/api/dining", "/api/events"],
  kitchen_item_statuses: ["/api/kitchen", "/api/events"],
  kitchen_workers: ["/api/kitchen"],
  kitchen_notifications: ["/api/kitchen"],
  // A hand-added kitchen job and the progress against its dishes. Only the
  // board draws them - there is no booking behind one, so no event, calendar or
  // billing screen has anything to say about it.
  kitchen_standalone_events: ["/api/kitchen"],
  kitchen_standalone_item_statuses: ["/api/kitchen"],
  // `/api/kitchen` because a card's category line is its hall's name, so a
  // rename left every open board captioned with the old one.
  halls: [
    "/api/halls",
    "/api/events",
    "/api/dashboard",
    "/api/hall-maps",
    "/api/kitchen"
  ],
  hall_map_presets: ["/api/hall-maps", "/api/dining"],
  hall_map_shape_library_items: ["/api/hall-map-shapes"],
  menu_items: [
    "/api/menu",
    "/api/events",
    "/api/kitchen",
    "/api/client-portal"
  ],
  menu_categories: ["/api/menu"],
  menu_item_services: ["/api/menu", "/api/kitchen"],
  add_ons: ["/api/menu", "/api/events", "/api/client-portal"],
  clients: ["/api/clients", "/api/events", "/api/billing"],
  invoices: [
    "/api/billing",
    "/api/events",
    "/api/dashboard",
    "/api/client-portal"
  ],
  payment_transactions: ["/api/billing", "/api/events", "/api/dashboard"],
  payment_refunds: ["/api/billing"],
  payment_receipts: ["/api/billing"],
  file_folders: ["/api/files"],
  stored_files: ["/api/files", "/api/events"],
  today_notes: ["/api/today-notes", "/api/dashboard"],
  /**
   * `/api/me/sessions` is here rather than under `user_sessions`, which is not
   * published and cannot be.
   *
   * Realtime enforces RLS and filters on `organization_id`, and `user_sessions`
   * has neither - it is deny-all by design, because a session belongs to a
   * person rather than to a tenant. Publishing it would mean granting the
   * browser direct SELECT on a table holding IP addresses.
   *
   * It does not need to be. A new sign-in writes `auth.login.success` here, in
   * the same request that records the session row - so the event that puts a
   * device on somebody's list is already announced by a table that is
   * published, tenant-scoped and safe to read. The refetch only costs anything
   * while the Security panel is actually open, because invalidation reaches
   * mounted queries and nothing else.
   */
  activity_logs: ["/api/events", "/api/dashboard", "/api/me/sessions"],
  /**
   * AUTHORIZATION, and the only table that can carry it.
   *
   * No query endpoint, because what has to happen when this row moves is not a
   * refetch of a list - it is a refetch of the SESSION, which is what every
   * permission hint on screen is rendered from. `AUTHORIZATION_TABLES` below is
   * where that is wired; this entry exists so `REALTIME_TABLES` includes the
   * table and the publication stays in step with what the client subscribes to.
   *
   * The three tables that actually record authorization - `principal_roles`,
   * `principal_permissions`, `role_permissions` - have RLS on with NO POLICY at
   * all, by design (prisma/supabase-rls.sql: "a privilege table gets no policy,
   * not a narrow one"). Realtime enforces RLS, so publishing one would deliver
   * nothing; giving it a policy so a sidebar could refresh would be inventing
   * read access to the privilege tables, which is not a trade worth making.
   *
   * `organizations` needs none of that. All three privilege tables already bump
   * `organizations.permissions_epoch` through triggers, so this one row moves
   * for every way authorization can change: a role assigned or removed, a
   * department moved, a direct override, or a role's own permission set edited.
   * The table is already member-readable under `organization_member_access`,
   * and every column on it is already in the session payload - so a subscriber
   * learns nothing it was not holding.
   */
  organizations: [],
  vendors: ["/api/vendors"],
  users: ["/api/staff"],
  organization_memberships: ["/api/staff"],
  // The portal's header - the venue logo and the colour or image behind it -
  // is read out of this document, so a branding change has to reach it too.
  organization_settings: ["/api/settings", "/api/client-portal"],
  support_tickets: ["/api/support/tickets"],
  support_ticket_messages: ["/api/support/tickets"]
};

/** Every table worth replicating, derived from the map so the two cannot drift. */
export const REALTIME_TABLES = Object.keys(TABLE_ENDPOINTS).sort();

/**
 * Tables whose movement means "your permissions may have changed".
 *
 * A change here is an INVALIDATION SIGNAL AND NOTHING MORE. The payload is
 * never read: the client refetches `POST /api/auth/session`, which recomputes
 * the permission set on the server from the privilege tables. Nothing about
 * what anybody may do is taken off the wire, which is what makes publishing
 * the table above safe in the first place.
 */
export const AUTHORIZATION_TABLES: readonly string[] = [
  "organizations",
  /**
   * The regional settings ride the same session, so they take the same signal.
   *
   * `organization_settings` holds the language, the timezone and the date and
   * time format, and it was already published and mapped to `/api/settings`
   * above - but that invalidates a QUERY, and the formats are read off the
   * SESSION. Without this entry an administrator saving a new date format
   * updated their own browser and no other open one, which is the "other
   * sessions keep showing the old format" half of the problem.
   *
   * Still only a signal. The refetch asks the server, scoped to the
   * authenticated organization; nothing about how to format is read off the
   * wire.
   */
  "organization_settings"
];

/** Whether a batch of changed tables means the session has to be re-read. */
export function affectsAuthorization(tables: Iterable<string>) {
  for (const table of tables) {
    if (AUTHORIZATION_TABLES.includes(table)) return true;
  }

  return false;
}

/**
 * The endpoints to invalidate for a changed table, or an empty list for a
 * table nothing reads. Unknown tables are ignored rather than triggering a
 * blanket refetch: a noisy write-only table would otherwise re-read the whole
 * dashboard on every insert.
 */
export function endpointsForTable(table: string): readonly string[] {
  return TABLE_ENDPOINTS[table] ?? [];
}

/** The endpoints affected by a batch of table changes, de-duplicated. */
export function endpointsForTables(tables: Iterable<string>) {
  const endpoints = new Set<string>();

  for (const table of tables) {
    for (const endpoint of endpointsForTable(table)) {
      endpoints.add(endpoint);
    }
  }

  return [...endpoints].sort();
}
