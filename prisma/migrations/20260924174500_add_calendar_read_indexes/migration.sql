CREATE INDEX "event_types_organization_id_is_active_name_idx"
  ON "event_types"("organization_id", "is_active", "name");

CREATE INDEX "holiday_blocked_dates_organization_id_is_blocked_start_date_end_date_idx"
  ON "holiday_blocked_dates"("organization_id", "is_blocked", "start_date", "end_date");
