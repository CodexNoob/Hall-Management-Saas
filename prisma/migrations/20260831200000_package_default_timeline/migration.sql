-- The day-of schedule a package is normally run to.
--
-- A venue that sells the same package fifty times a year retypes the same
-- timeline fifty times. This is where the answer it already worked out once
-- gets kept: staff save a timeline they are happy with onto the package, and
-- applying that package to an event with no timeline of its own copies the rows
-- across as a draft.
--
-- Json rather than a table of rows. It is the same array that already lives in
-- `events.workspace_data -> 'timeline'`, and giving it a shape of its own here
-- would mean two representations of one thing and a translation between them
-- that could drift. Nothing joins to these rows or queries inside them; they are
-- read whole and written whole.
--
-- Nullable with no default: a package having no saved timeline is the ordinary
-- state, not a missing value, and NULL is the honest way to say so.
ALTER TABLE "packages"
    ADD COLUMN IF NOT EXISTS "default_timeline" JSONB;
