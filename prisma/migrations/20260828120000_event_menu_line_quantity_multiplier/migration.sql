-- "2x the brisket": how many complete servings of one line an event is getting.
--
-- A second row for the same dish is impossible by design - `event_menu_lines` is
-- unique on (event_menu_id, menu_item_id) and on (event_menu_id, add_on_id) - so
-- the count is a column on the line. That is also the shape the kitchen wants:
-- one dish, one status row, one number to cook to.
--
-- NOT NULL DEFAULT 1 is load-bearing, not tidiness. Every local branch runs
-- against this one database and the branches that predate this column INSERT
-- without it; the default keeps those writes legal and makes every row already
-- in the table read as exactly what it is today - one serving. Postgres records
-- the default in the catalog rather than rewriting the table, so this takes no
-- long lock.
ALTER TABLE "event_menu_lines"
    ADD COLUMN IF NOT EXISTS "quantity_multiplier" INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.event_menu_lines'::regclass
          AND conname = 'event_menu_lines_quantity_multiplier_check'
    ) THEN
        -- At least one: a line that is on the menu is being served, and zero
        -- servings is spelled by taking the line off rather than counting it
        -- down to nothing. Capped because the only routes to three digits are a
        -- stuck stepper and a typo, and 99 trays of one dish is already past
        -- anything a hall cooks. The app repeats the bound in zod; it is kept
        -- here as well because zod does not guard the psql session that skips it.
        ALTER TABLE "event_menu_lines"
            ADD CONSTRAINT "event_menu_lines_quantity_multiplier_check"
            CHECK ("quantity_multiplier" BETWEEN 1 AND 99);
    END IF;
END
$$;
