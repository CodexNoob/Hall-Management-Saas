ALTER TABLE "halls"
ADD COLUMN "daily_event_limit" INTEGER;

ALTER TABLE "halls"
ADD CONSTRAINT "halls_daily_event_limit_check"
CHECK ("daily_event_limit" IS NULL OR "daily_event_limit" >= 1);
