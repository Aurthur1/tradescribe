import type { Granularity } from "./dashboard-data";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function monthName(date: Date, format: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("en-US", { month: format }).format(date);
}

export function initialAnchor() {
  return new Date().toISOString();
}

export function stepAnchor(anchor: string, granularity: Granularity, direction: 1 | -1) {
  const date = new Date(anchor);
  if (granularity === "day") date.setDate(date.getDate() + direction);
  if (granularity === "week") date.setDate(date.getDate() + direction * 7);
  if (granularity === "month") date.setMonth(date.getMonth() + direction);
  if (granularity === "year") date.setFullYear(date.getFullYear() + direction);
  return date.toISOString();
}

export function rangeLabel(anchor: string, granularity: Granularity) {
  const date = new Date(anchor);

  if (granularity === "day") {
    return `${monthName(date)} ${date.getDate()}, ${date.getFullYear()}`;
  }

  if (granularity === "week") {
    const start = startOfWeek(date);
    const end = new Date(start.getTime() + 6 * DAY_MS);
    return `${monthName(start)} ${start.getDate()} - ${monthName(end)} ${end.getDate()}, ${end.getFullYear()}`;
  }

  if (granularity === "month") {
    return `${monthName(date, "long")} ${date.getFullYear()}`;
  }

  return String(date.getFullYear());
}

export function daysForRange(anchor: string, granularity: Granularity) {
  const date = new Date(anchor);

  if (granularity === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const days: string[] = [];
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      days.push(toDateKey(cursor));
    }
    return days;
  }

  const start = granularity === "day" ? startOfDay(date) : startOfWeek(date);
  const length = granularity === "day" ? 1 : 7;
  return Array.from({ length }, (_, index) => toDateKey(new Date(start.getTime() + index * DAY_MS)));
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
