-- Let a user be deleted without letting an activity log be edited.
--
-- activity_logs.user_id is ON DELETE SET NULL, so deleting a user makes
-- Postgres run `UPDATE activity_logs SET user_id = NULL`. The append-only
-- trigger blocked every UPDATE, so the cascade failed and the whole DELETE
-- rolled back: any user who had ever appeared in a log could never be removed.
--
-- Two decisions were in conflict - logs are immutable, and logs outlive the
-- user - and the model already shows which one was intended, because
-- activity_logs stores `user_name` as a denormalized snapshot precisely so the
-- entry still reads correctly once the account is gone.
--
-- This permits exactly one mutation: user_id going from a value to NULL, with
-- every other column unchanged. The `to_jsonb(NEW) - 'user_id'` comparison is
-- what proves that - it is not enough to check user_id alone, because an
-- update could null the user and rewrite the message in the same statement.
-- Everything the log actually says stays as immutable as before, and DELETE is
-- still refused outright.

CREATE OR REPLACE FUNCTION public.prevent_activity_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.user_id IS NOT NULL
     AND NEW.user_id IS NULL
     AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'activity logs are append-only';
END;
$$;
