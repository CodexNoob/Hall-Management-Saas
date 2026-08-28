export type CalendarGridDay = {
  currentMonth: boolean;
  date: Date;
  dateKey: string;
  day: number;
};

/// Which day a displayed week opens on. Saturday is here because a hall running
/// on the Hebrew calendar reads the week as ending on Shabbos, not starting
/// mid-way through it.
export type WeekStartsOn = "sunday" | "monday" | "saturday";

const weekStartDayIndexes: Record<WeekStartsOn, number> = {
  sunday: 0,
  monday: 1,
  saturday: 6
};

export function weekStartDayIndex(weekStartsOn: WeekStartsOn = "sunday") {
  return weekStartDayIndexes[weekStartsOn] ?? 0;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfWeek(date: Date, weekStartsOn: WeekStartsOn = "sunday") {
  const result = startOfDay(date);
  const startIndex = weekStartDayIndex(weekStartsOn);
  result.setDate(result.getDate() - ((result.getDay() - startIndex + 7) % 7));
  return result;
}

export function addDays(date: Date, amount: number) {
  const result = startOfDay(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateKeyFromIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : dateKey(new Date(value));
}

export function buildMonthGrid(
  month: Date,
  weekStartsOn: WeekStartsOn = "sunday"
): CalendarGridDay[] {
  const monthStart = startOfMonth(month);
  const gridStart = startOfWeek(monthStart, weekStartsOn);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      currentMonth: date.getMonth() === monthStart.getMonth() && date.getFullYear() === monthStart.getFullYear(),
      date,
      dateKey: dateKey(date),
      day: date.getDate()
    };
  });
}

export function moveDateByMonth(date: Date, amount: number) {
  const targetMonth = addMonths(date, amount);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(date.getDate(), lastDay));
}
