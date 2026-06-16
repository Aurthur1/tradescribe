export type Granularity = "day" | "week" | "month" | "year";

export interface Period {
  start: Date;
  end: Date;
  label: string;
}

export interface PeriodWithPrevious {
  current: Period;
  previous: Period;
  granularity: Granularity;
}

function monthName(month: number, format: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("en-US", { month: format, timeZone: "UTC" }).format(new Date(Date.UTC(2025, month - 1, 1)));
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
}

function addYears(date: Date, years: number) {
  const copy = new Date(date);
  copy.setUTCFullYear(copy.getUTCFullYear() + years);
  return copy;
}

interface LocalDateParts {
  day: number;
  month: number;
  year: number;
}

function localDateFromAnchor(anchor: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(anchor);

  return {
    day: Number(parts.find((part) => part.type === "day")?.value ?? "1"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "1"),
    year: Number(parts.find((part) => part.type === "year")?.value ?? "1970")
  };
}

function zonedDateToUtc(parts: LocalDateParts, timeZone: string) {
  const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  let candidateUtc = targetUtc;

  for (let index = 0; index < 3; index += 1) {
    const candidateParts = localDateFromAnchor(new Date(candidateUtc), timeZone);
    const candidateAsUtc = Date.UTC(candidateParts.year, candidateParts.month - 1, candidateParts.day);
    candidateUtc += targetUtc - candidateAsUtc;
  }

  return new Date(candidateUtc);
}

function addLocalDays(parts: LocalDateParts, days: number): LocalDateParts {
  const date = addDays(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)), days);
  return { day: date.getUTCDate(), month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
}

function addLocalMonths(parts: LocalDateParts, months: number): LocalDateParts {
  const date = addMonths(new Date(Date.UTC(parts.year, parts.month - 1, 1)), months);
  return { day: 1, month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
}

function addLocalYears(parts: LocalDateParts, years: number): LocalDateParts {
  return { day: 1, month: 1, year: parts.year + years };
}

function localWeekday(parts: LocalDateParts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function labelDay(parts: LocalDateParts) {
  return `${monthName(parts.month)} ${parts.day}, ${parts.year}`;
}

function labelWeek(start: LocalDateParts, endExclusive: LocalDateParts) {
  const end = addLocalDays(endExclusive, -1);
  return `${monthName(start.month)} ${start.day} - ${monthName(end.month)} ${end.day}, ${end.year}`;
}

export function resolvePeriod(granularity: Granularity, anchorISO: string | undefined, timeZone = "UTC"): PeriodWithPrevious {
  const anchor = anchorISO ? new Date(anchorISO) : new Date();
  const anchorLocal = localDateFromAnchor(anchor, timeZone);
  let startLocal: LocalDateParts;
  let endLocal: LocalDateParts;
  let start: Date;
  let end: Date;
  let label: string;

  if (granularity === "day") {
    startLocal = anchorLocal;
    endLocal = addLocalDays(startLocal, 1);
    start = zonedDateToUtc(startLocal, timeZone);
    end = zonedDateToUtc(endLocal, timeZone);
    label = labelDay(startLocal);
  } else if (granularity === "week") {
    startLocal = addLocalDays(anchorLocal, -localWeekday(anchorLocal));
    endLocal = addLocalDays(startLocal, 7);
    start = zonedDateToUtc(startLocal, timeZone);
    end = zonedDateToUtc(endLocal, timeZone);
    label = labelWeek(startLocal, endLocal);
  } else if (granularity === "month") {
    startLocal = { day: 1, month: anchorLocal.month, year: anchorLocal.year };
    endLocal = addLocalMonths(startLocal, 1);
    start = zonedDateToUtc(startLocal, timeZone);
    end = zonedDateToUtc(endLocal, timeZone);
    label = `${monthName(startLocal.month, "long")} ${startLocal.year}`;
  } else {
    startLocal = { day: 1, month: 1, year: anchorLocal.year };
    endLocal = addLocalYears(startLocal, 1);
    start = zonedDateToUtc(startLocal, timeZone);
    end = zonedDateToUtc(endLocal, timeZone);
    label = String(startLocal.year);
  }

  const spanMs = end.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - spanMs);

  return {
    current: { start, end, label },
    granularity,
    previous: {
      start: previousStart,
      end: start,
      label: `previous ${granularity}`
    }
  };
}

export function stepAnchor(anchorISO: string, granularity: Granularity, direction: 1 | -1): string {
  const anchor = new Date(anchorISO);
  if (granularity === "day") return addDays(anchor, direction).toISOString();
  if (granularity === "week") return addDays(anchor, direction * 7).toISOString();
  if (granularity === "month") return addMonths(anchor, direction).toISOString();
  return addYears(anchor, direction).toISOString();
}
