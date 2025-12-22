import { createGranolaDebug } from './debug.js';

const debug = createGranolaDebug('lib:date-parser');

const MONTH_NAMES: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Parse a natural language date string into a Date object.
 *
 * Supports:
 * - Keywords: today, yesterday, tomorrow
 * - Relative: N days ago, N weeks ago, last week, last month
 * - ISO: YYYY-MM-DD, YYYY/MM/DD
 * - Simple: Dec 20, Dec 20 2024, 20 Dec 2024
 *
 * @param input - Natural language date string
 * @returns Parsed Date or null if unparseable
 */
export function parseDate(input: string): Date | null {
  const normalized = input.trim().toLowerCase();
  debug('parsing date: %s', normalized);

  // 1. Keywords
  if (normalized === 'today') {
    return startOfDay(new Date());
  }
  if (normalized === 'yesterday') {
    return startOfDay(addDays(new Date(), -1));
  }
  if (normalized === 'tomorrow') {
    return startOfDay(addDays(new Date(), 1));
  }

  // 2. "last week" / "last month"
  if (normalized === 'last week') {
    return startOfDay(addDays(new Date(), -7));
  }
  if (normalized === 'last month') {
    return startOfDay(addMonths(new Date(), -1));
  }

  // 3. "N days ago" / "N weeks ago" / "N months ago"
  const daysAgoMatch = normalized.match(/^(\d+)\s+days?\s+ago$/);
  if (daysAgoMatch) {
    return startOfDay(addDays(new Date(), -Number.parseInt(daysAgoMatch[1], 10)));
  }

  const weeksAgoMatch = normalized.match(/^(\d+)\s+weeks?\s+ago$/);
  if (weeksAgoMatch) {
    return startOfDay(addDays(new Date(), -Number.parseInt(weeksAgoMatch[1], 10) * 7));
  }

  const monthsAgoMatch = normalized.match(/^(\d+)\s+months?\s+ago$/);
  if (monthsAgoMatch) {
    return startOfDay(addMonths(new Date(), -Number.parseInt(monthsAgoMatch[1], 10)));
  }

  // 4. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = input.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10) - 1;
    const day = Number.parseInt(isoMatch[3], 10);
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) {
      return startOfDay(date);
    }
  }

  // 5. "Dec 20" or "Dec 20 2024" format
  const monthDayMatch = normalized.match(/^([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/);
  if (monthDayMatch) {
    const monthNum = MONTH_NAMES[monthDayMatch[1]];
    if (monthNum !== undefined) {
      const day = Number.parseInt(monthDayMatch[2], 10);
      const year = monthDayMatch[3]
        ? Number.parseInt(monthDayMatch[3], 10)
        : new Date().getFullYear();
      const date = new Date(year, monthNum, day);
      if (!Number.isNaN(date.getTime())) {
        return startOfDay(date);
      }
    }
  }

  // 6. "20 Dec" or "20 Dec 2024" format
  const dayMonthMatch = normalized.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/);
  if (dayMonthMatch) {
    const monthNum = MONTH_NAMES[dayMonthMatch[2]];
    if (monthNum !== undefined) {
      const day = Number.parseInt(dayMonthMatch[1], 10);
      const year = dayMonthMatch[3]
        ? Number.parseInt(dayMonthMatch[3], 10)
        : new Date().getFullYear();
      const date = new Date(year, monthNum, day);
      if (!Number.isNaN(date.getTime())) {
        return startOfDay(date);
      }
    }
  }

  debug('failed to parse date: %s', input);
  return null;
}

/**
 * Validate that a date string can be parsed.
 * Returns the parsed Date or throws a descriptive error.
 *
 * @param value - Date string to parse
 * @param optionName - Name of the CLI option (for error messages)
 * @returns Parsed Date
 * @throws Error if the date cannot be parsed
 */
export function validateDateOption(value: string, optionName: string): Date {
  const parsed = parseDate(value);

  if (!parsed) {
    throw new Error(
      `Invalid date for ${optionName}: "${value}". ` +
        'Try formats like: today, yesterday, last week, 2024-01-15, "Dec 20"',
    );
  }

  debug('validated %s: %s -> %s', optionName, value, parsed.toISOString());
  return parsed;
}
