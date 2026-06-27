import { HDate } from "hebcal";

export function formatHebrewDate(date: Date) {
  return new HDate(date).toString("h");
}
