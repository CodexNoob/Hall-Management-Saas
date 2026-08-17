CREATE TABLE "hall_map_shape_library_items" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "shape_type" text NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "seats" integer NOT NULL,
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(3) NOT NULL,

  CONSTRAINT "hall_map_shape_library_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hall_map_shape_library_items_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "hall_map_shape_library_items_shape_type_check"
    CHECK ("shape_type" IN ('round-table', 'rect-table')),
  CONSTRAINT "hall_map_shape_library_items_width_check"
    CHECK ("width" BETWEEN 10 AND 5000),
  CONSTRAINT "hall_map_shape_library_items_height_check"
    CHECK ("height" BETWEEN 10 AND 5000),
  CONSTRAINT "hall_map_shape_library_items_seats_check"
    CHECK ("seats" BETWEEN 0 AND 1000)
);

CREATE UNIQUE INDEX "hall_map_shape_library_items_organization_id_name_key"
  ON "hall_map_shape_library_items"("organization_id", "name");

CREATE INDEX "hall_map_shape_library_items_organization_id_updated_at_idx"
  ON "hall_map_shape_library_items"("organization_id", "updated_at");
