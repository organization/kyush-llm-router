import { env } from '../config/env.js';

function getFormatter(
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    ...options,
  });
}

function getParts(date: Date, timeZone: string): Record<string, string> {
  const formatter = getFormatter(timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  return formatter
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});
}

export function getConfiguredTimeZone(): string {
  return env.TIME_ZONE;
}

export function getUtcTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export function getLocalDateKey(
  date: Date = new Date(),
  timeZone: string = getConfiguredTimeZone(),
): string {
  const parts = getParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getLocalMonthKey(
  date: Date = new Date(),
  timeZone: string = getConfiguredTimeZone(),
): string {
  const parts = getParts(date, timeZone);
  return `${parts.year}-${parts.month}`;
}

export function getMonthKeyFromDateString(dateString: string): string {
  return dateString.slice(0, 7);
}
