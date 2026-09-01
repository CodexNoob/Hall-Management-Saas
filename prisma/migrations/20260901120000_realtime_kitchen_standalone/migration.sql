-- Publish the standalone kitchen job tables.
--
-- The original publication migration is a historical artifact and is not
-- edited: a shared database has already applied it, and rewriting an applied
-- migration makes `prisma migrate deploy` refuse for everybody. New tables get
-- a new migration.
--
-- These two were missed. A hand-added kitchen job - "cook this menu for eighty
-- people" - and the progress recorded against its dishes appear on the kitchen
-- board like any booking, but neither table announced its changes, so adding a
-- job, deleting one, or ticking a dish on one reached nobody else's screen
-- until they reloaded. Two cooks working the same standalone job could not see
-- each other's progress, which is the one thing realtime is here to prevent.
--
-- Idempotent, like its predecessor: one database serves several branches, and a
-- migration that threw "is already member of publication" would block whoever
-- ran it second.
DO $$
DECLARE
  target text;
  tables text[] := ARRAY[
    'kitchen_standalone_events',
    'kitchen_standalone_item_statuses'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH target IN ARRAY tables LOOP
    -- A table that does not exist yet is skipped rather than failing the
    -- migration, the same way the first publication migration treats one.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = target
    ) THEN
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
END
$$;
