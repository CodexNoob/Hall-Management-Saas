-- Let an organization reset finish without letting an activity log be edited.
--
-- This is the same conflict migration 20260820200000 settled for `user_id`,
-- reaching the other two foreign keys and the delete path. Nobody extended it
-- at the time, so three of the four resets in Settings could not run at all:
--
--   1. `deleteEventData` deletes the activity rows an event owns. The trigger
--      refused every DELETE outright, so the statement raised.
--   2. Deleting the events themselves makes Postgres run
--      `UPDATE activity_logs SET event_id = NULL`, which the trigger also
--      refused - it permitted exactly one mutation, and that was `user_id`.
--   3. The full-account reset deletes clients, which is the same cascade again
--      through `client_id`.
--
-- The symptom was a 500 with no detail: the exception aborted a transaction
-- wrapping forty statements, so every reset rolled back and the only thing the
-- operator saw was "An unexpected server error occurred."
--
-- TWO SEPARATE PERMISSIONS, FOR TWO DIFFERENT REASONS.
--
-- DETACHING is the cascade, and it stays as narrow as it was for `user_id`:
-- one owner reference going from a value to NULL, with every other column
-- byte-identical. `to_jsonb(NEW) - '<column>'` is what proves the rest is
-- untouched - checking the column alone would let a statement null the event
-- and rewrite the message together. What the entry SAYS is still immutable,
-- and the log outlives the row it described, which is the point of the
-- denormalized `user_name` snapshot already in the table.
--
-- DELETING is the full-account reset, whose dialog promises the activity
-- history goes. That cannot be a blanket permission, so it is an explicit
-- opt-in the deleting transaction has to make for itself:
--
--   SELECT set_config('app.activity_log_purge', 'on', true)
--
-- The third argument makes it transaction-local, so it cannot leak into the
-- next statement on a pooled connection. Nothing is weakened for ordinary
-- code: a log still cannot be deleted by accident, only by a transaction that
-- said out loud that deleting logs is what it is for. The browser cannot reach
-- this at all either way - `REVOKE INSERT, UPDATE, DELETE ... FROM
-- authenticated` in the security-hardening migration is what stops that, and
-- it is untouched.

CREATE OR REPLACE FUNCTION public.prevent_activity_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.user_id IS NOT NULL
       AND NEW.user_id IS NULL
       AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id')
    THEN
      RETURN NEW;
    END IF;

    IF OLD.event_id IS NOT NULL
       AND NEW.event_id IS NULL
       AND (to_jsonb(NEW) - 'event_id') = (to_jsonb(OLD) - 'event_id')
    THEN
      RETURN NEW;
    END IF;

    IF OLD.client_id IS NOT NULL
       AND NEW.client_id IS NULL
       AND (to_jsonb(NEW) - 'client_id') = (to_jsonb(OLD) - 'client_id')
    THEN
      RETURN NEW;
    END IF;
  END IF;

  -- `true` is missing_ok: an ordinary transaction has never set this, and
  -- `current_setting` returns NULL rather than raising. NULL = 'on' is NULL,
  -- which is not true, so the refusal below is what happens.
  IF TG_OP = 'DELETE'
     AND pg_catalog.current_setting('app.activity_log_purge', true) = 'on'
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'activity logs are append-only';
END;
$$;
