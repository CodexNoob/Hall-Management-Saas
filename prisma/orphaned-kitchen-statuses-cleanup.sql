-- Deletes kitchen progress rows for dishes their event no longer serves.
--
-- `kitchen_item_statuses` is keyed on (event, dish), not on a menu line, and
-- until the fix that ships with this file none of the routes that rewrite an
-- event's menu deleted these rows. Taking a dish off a menu therefore left one
-- behind. Nothing rendered it - the kitchen board builds its lines from the
-- menu and looks each status up - so the orphan only surfaced when the menu
-- library refused to delete the dish and named an event that was not serving
-- it.
--
-- Safe to re-run: it deletes by shape, not by id, and matches nothing once the
-- table is clean.
--
--   npm run db:kitchen-status-cleanup

BEGIN;

DELETE FROM public.kitchen_item_statuses AS status
USING public.events AS event
WHERE event.id = status.event_id
  -- No line on any of the event's menus points at this dish...
  AND NOT EXISTS (
    SELECT 1
    FROM public.event_menu_lines AS line
    JOIN public.event_menus AS menu ON menu.id = line.event_menu_id
    WHERE menu.event_id = status.event_id
      AND line.menu_item_id = status.menu_item_id
  )
  -- ...and neither does the legacy mirror the kitchen board still reads. Both
  -- have to miss before a row counts as an orphan: an event predating
  -- `event_menus` would carry its dishes in the mirror alone, and its progress
  -- is real. `menu_item_ids` is text[], so the uuid needs the cast.
  AND NOT (status.menu_item_id::text = ANY(event.menu_item_ids));

COMMIT;
