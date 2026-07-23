ALTER TABLE "organization_settings"
ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en-US';
