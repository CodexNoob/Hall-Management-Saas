import { z } from "zod";

/**
 * One row of a day-of schedule.
 *
 * Shared rather than declared per route: the same array is written to an event
 * (`Event.workspaceData.timeline`) and saved onto a package as its default
 * (`EventPackage.defaultTimeline`), and the two have to accept exactly the same
 * rows or a timeline could be saved to one and refused by the other.
 */
export const timelineItemSchema = z.object({
  id: z.string().min(1).max(100),
  // No longer required: a cue row is placed by what happens before it rather
  // than by the clock, and sends this blank.
  time: z.string().trim().max(20).optional(),
  // Sent only by a cue row, and sent even when still empty - its presence is
  // what marks the row as sequence-driven, so a cue the manager has not typed
  // yet has to come back as a cue row rather than as a midnight time row.
  cue: z.string().trim().max(200).optional(),
  text: z.string().trim().min(1).max(500),
  type: z.enum(["Event", "Kitchen", "Staff"])
});

export const timelineSchema = z.array(timelineItemSchema).max(100);

export type TimelineRow = z.infer<typeof timelineItemSchema>;

/**
 * The rows stored on a package or an event, or an empty list when the value is
 * missing or was written by something that did not agree with the shape above.
 *
 * A stored default is read back through the same parser that accepted it, so a
 * column holding anything else - a hand-edited row, an older shape - reads as
 * "no default" rather than reaching the UI as a broken timeline.
 */
export function readStoredTimeline(value: unknown): TimelineRow[] {
  const parsed = timelineSchema.safeParse(value);

  return parsed.success ? parsed.data : [];
}
