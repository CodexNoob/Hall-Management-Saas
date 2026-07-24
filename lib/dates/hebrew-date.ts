import { HDate } from "hebcal";

export function formatHebrewDate(date: Date) {
  return new HDate(date).toString("h");
}

export function formatHebrewDateWithoutYear(date: Date) {
  return formatHebrewDate(date).replace(/\s+\S+$/u, "");
}
