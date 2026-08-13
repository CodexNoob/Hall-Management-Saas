import { z } from "zod";
import { countSchema, dimensionSchema } from "@/lib/validation/number";

/**
 * Shared by the hall-map API route and the object inspector, so the bounds the
 * form enforces are literally the ones the server checks.
 */

export const shapeTypeSchema = z.enum([
  "round-table",
  "rect-table",
  "kids-table",
  "box",
  "circle",
  "divider",
  "buffet",
  "head-table",
  "drinks"
]);

export const mapObjectFieldSchemas = {
  x: dimensionSchema({ min: 0, max: 10_000, label: "X" }),
  y: dimensionSchema({ min: 0, max: 10_000, label: "Y" }),
  width: dimensionSchema({ min: 10, max: 5_000, label: "Width" }),
  height: dimensionSchema({ min: 10, max: 5_000, label: "Height" }),
  rotation: dimensionSchema({ min: 0, max: 360, label: "Rotation" }),
  seats: countSchema({ max: 1_000, label: "Seats" })
};

export const mapObjectSchema = z.object({
  id: z.string().min(1).max(150),
  type: shapeTypeSchema,
  name: z.string().trim().min(1).max(100),
  ...mapObjectFieldSchemas,
  seatingUse: z.enum(["none", "adult", "kids", "head"])
});

export type MapObject = z.infer<typeof mapObjectSchema>;
