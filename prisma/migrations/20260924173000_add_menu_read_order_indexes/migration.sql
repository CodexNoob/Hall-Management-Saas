CREATE INDEX "add_ons_organization_id_name_idx"
  ON "add_ons"("organization_id", "name");

CREATE INDEX "menu_categories_organization_id_sort_order_name_idx"
  ON "menu_categories"("organization_id", "sort_order", "name");
