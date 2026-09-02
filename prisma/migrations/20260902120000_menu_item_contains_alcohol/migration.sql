-- Whether a drink contains alcohol.
--
-- The drink form asks this in place of the category and kashrut selects, which
-- are food vocabulary: a bottle of wine has no course, and "Parve" is not what
-- anyone is looking for on a drinks list. Whether it is alcoholic is.
--
-- Nullable with no default, exactly as `kosher_type` is. A dish is never asked
-- this, and NULL is the honest way to say the question was not put - defaulting
-- every existing row to false would assert an answer nobody gave.
ALTER TABLE "menu_items"
    ADD COLUMN IF NOT EXISTS "contains_alcohol" BOOLEAN;
