-- A hall map preset can carry the hall's real floor plan as a background
-- image. The column stores an org-prefixed Supabase Storage path (validated
-- server-side against the acting organization); the image itself lives in the
-- private hall-floor-plans bucket.
ALTER TABLE "hall_map_presets" ADD COLUMN "background_path" TEXT;
