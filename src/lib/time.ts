import { APP_TIME_ZONE, APP_UTC_OFFSET } from "@/lib/config";
import { HttpError } from "@/lib/http";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function assertDateString(value: string): string {
  if (!DATE_PATTERN.test(value)) {
    throw new HttpError(400, "INVALID_DATE", "Дата должна быть в формате ГГГГ-ММ-ДД.");
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, "INVALID_DATE", "Указана несуществующая дата.");
  }

  return value;
}

export function addDays(date: string, days: number): string {
  assertDateString(date);
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

export function assertMonthString(value: string): string {
  if (!MONTH_PATTERN.test(value)) {
    throw new HttpError(400, "INVALID_MONTH", "Месяц должен быть в формате ГГГГ-ММ.");
  }

  const [year, month] = value.split("-").map(Number);

  if (year < 1970 || year > 2100 || month < 1 || month > 12) {
    throw new HttpError(400, "INVALID_MONTH", "Указан несуществующий месяц.");
  }

  return value;
}

export function dayBounds(date: string): { timeMin: string; timeMax: string } {
  return {
    timeMin: `${assertDateString(date)}T00:00:00${APP_UTC_OFFSET}`,
    timeMax: `${addDays(date, 1)}T00:00:00${APP_UTC_OFFSET}`,
  };
}

export function monthBounds(month: string): { timeMin: string; timeMax: string } {
  const [year, monthNumber] = assertMonthString(month).split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1))
    .toISOString()
    .slice(0, 7);

  return {
    timeMin: `${month}-01T00:00:00${APP_UTC_OFFSET}`,
    timeMax: `${nextMonth}-01T00:00:00${APP_UTC_OFFSET}`,
  };
}

export function currentDateInSamara(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function currentMonthInSamara(now = new Date()): string {
  return currentDateInSamara(now).slice(0, 7);
}

export function formatTimeInSamara(dateTime: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateTime));
}
