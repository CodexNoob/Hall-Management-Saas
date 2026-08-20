-- Publish row changes so open screens can refresh themselves.
--
-- Supabase Realtime only forwards changes for tables in the
-- `supabase_realtime` publication, so nothing here changes what any query
-- returns - it only decides which tables announce that they changed.
--
-- Two properties worth keeping in mind:
--
--  * Realtime enforces RLS. A subscriber receives a row only if the tenant
--    policies in supabase-rls.sql would have let them SELECT it, so publishing
--    a table does not widen who can read it. The client also filters on
--    organization_id, which every table below has - that is bandwidth, not the
--    security boundary.
--
--  * REPLICA IDENTITY stays at the default (primary key). The client is told
--    only which table moved and refetches through the API, so it never needs
--    the old column values a FULL identity would ship - and FULL would put
--    every column of every write on the wire, including ones the subscriber is
--    not allowed to see.
--
-- Written as a loop so re-running is harmless: a table already in the
-- publication is skipped rather than raising `is already member of
-- publication`.

DO $$
DECLARE
  target text;
  tables text[] := ARRAY[
    'activity_logs',
    'add_ons',
    'clients',
    'dining_plans',
    'event_menu_lines',
    'event_menus',
    'event_types',
    'events',
    'file_folders',
    'hall_map_presets',
    'hall_map_shape_library_items',
    'halls',
    'invoices',
    'kitchen_item_statuses',
    'kitchen_notifications',
    'kitchen_workers',
    'menu_categories',
    'menu_item_services',
    'menu_items',
    'organization_memberships',
    'organization_settings',
    'packages',
    'payment_receipts',
    'payment_refunds',
    'payment_transactions',
    'stored_files',
    'support_ticket_messages',
    'support_tickets',
    'today_notes',
    'user_access',
    'users',
    'vendors'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH target IN ARRAY tables LOOP
    -- Skip a table this branch has not created yet rather than failing the
    -- whole migration: one shared database serves several branches.
    IF to_regclass('public.' || target) IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = target
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
      target
    );
  END LOOP;
END $$;
