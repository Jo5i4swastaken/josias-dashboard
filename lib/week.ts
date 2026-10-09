import type { WeekDayView, Weekday } from "@/lib/types";
import { WEEKDAYS } from "@/lib/types";

const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function dashboardTimeZone(): string {
  const configured = process.env.DASHBOARD_TIMEZONE?.trim() || "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: configured }).format(new Date());
  } catch {
    throw new Error(`Invalid DASHBOARD_TIMEZONE: ${configured}`);
  }
  return configured;
}

export function isValidDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return false;
  }
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isMonday(iso: string): boolean {
  if (!isValidDate(iso)) {
    return false;
  }
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 1;
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function prettyDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function zonedParts(now: Date, timeZone: string): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayLabel = read("weekday").toLowerCase().slice(0, 3);
  const weekday = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(weekdayLabel);
  if (weekday < 0) {
    throw new Error(`Could not read the weekday in ${timeZone}`);
  }
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    weekday,
  };
}

export function todayIso(timeZone: string, now = new Date()): string {
  const { year, month, day } = zonedParts(now, timeZone);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

export function currentWeekStart(timeZone: string, now = new Date()): string {
  const { year, month, day, weekday } = zonedParts(now, timeZone);
  const iso = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  const sinceMonday = (weekday + 6) % 7;
  return addDays(iso, -sinceMonday);
}

export function buildWeekDays(timeZone: string, now = new Date()): WeekDayView[] {
  const start = currentWeekStart(timeZone, now);
  const today = todayIso(timeZone, now);
  return WEEKDAYS.map((id, index) => {
    const date = addDays(start, index);
    return {
      id,
      date,
      label: LABELS[index] ?? id,
      pretty: prettyDate(date),
      isToday: date === today,
    };
  });
}

export function isWeekday(value: string): value is Weekday {
  return (WEEKDAYS as readonly string[]).includes(value);
}
