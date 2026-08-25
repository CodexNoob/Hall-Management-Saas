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
 */
export const TABLE_ENDPOINTS: Record<string, readonly string[]> = {
  events: ["/api/events", "/api/dashboard", "/api/kitchen", "/api/dining", "/api/clients", "/api/billing"],
  event_menus: ["/api/events", "/api/kitchen", "/api/menu"],
  event_menu_lines: ["/api/events", "/api/kitchen", "/api/menu"],
  // `packages`, not `event_packages` - the model is EventPackage but its
  // @@map is "packages", and postgres_changes reports the table name.
  packages: ["/api/events", "/api/menu", "/api/kitchen"],
  event_types: ["/api/event-types", "/api/events"],
  dining_plans: ["/api/dining", "/api/events"],
  kitchen_item_statuses: ["/api/kitchen", "/api/events"],
  kitchen_workers: ["/api/kitchen"],
  kitchen_notifications: ["/api/kitchen"],
  halls: ["/api/halls", "/api/events", "/api/dashboard", "/api/hall-maps"],
  hall_map_presets: ["/api/hall-maps", "/api/dining"],
  hall_map_shape_library_items: ["/api/hall-map-shapes"],
  menu_items: ["/api/menu", "/api/events", "/api/kitchen"],
  menu_categories: ["/api/menu"],
  menu_item_services: ["/api/menu", "/api/kitchen"],
  add_ons: ["/api/menu", "/api/events"],
  clients: ["/api/clients", "/api/events", "/api/billing"],
  invoices: ["/api/billing", "/api/events", "/api/dashboard"],
  payment_transactions: ["/api/billing", "/api/events", "/api/dashboard"],
  payment_refunds: ["/api/billing"],
  payment_receipts: ["/api/billing"],
  file_folders: ["/api/files"],
  stored_files: ["/api/files", "/api/events"],
  today_notes: ["/api/today-notes", "/api/dashboard"],
  activity_logs: ["/api/events", "/api/dashboard"],
  vendors: ["/api/vendors"],
  users: ["/api/staff"],
  organization_memberships: ["/api/staff"],
  organization_settings: ["/api/settings"],
  support_tickets: ["/api/support/tickets"],
  support_ticket_messages: ["/api/support/tickets"]
};

/** Every table worth replicating, derived from the map so the two cannot drift. */
export const REALTIME_TABLES = Object.keys(TABLE_ENDPOINTS).sort();

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
