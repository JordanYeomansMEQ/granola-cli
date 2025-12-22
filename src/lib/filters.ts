import type { Meeting } from '../types.js';
import { createGranolaDebug } from './debug.js';

const debug = createGranolaDebug('lib:filters');

export interface FilterOptions {
  search?: string;
  attendee?: string;
  date?: Date;
  since?: Date;
  until?: Date;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Case-insensitive partial match on meeting title.
 */
export function matchesSearch(meeting: Meeting, query: string): boolean {
  const normalizedQuery = query.toLowerCase();
  const normalizedTitle = meeting.title.toLowerCase();
  return normalizedTitle.includes(normalizedQuery);
}

/**
 * Partial match on attendee name or email (case-insensitive).
 * Checks both `people.attendees` and top-level `attendees`.
 */
export function matchesAttendee(meeting: Meeting, query: string): boolean {
  const normalizedQuery = query.toLowerCase();

  // Check people.attendees
  const peopleAttendees = meeting.people?.attendees ?? [];
  // Check top-level attendees
  const topLevelAttendees = meeting.attendees ?? [];

  const allAttendees = [...peopleAttendees, ...topLevelAttendees];

  return allAttendees.some((attendee) => {
    const name = attendee.name?.toLowerCase() ?? '';
    const email = attendee.email?.toLowerCase() ?? '';
    return name.includes(normalizedQuery) || email.includes(normalizedQuery);
  });
}

/**
 * Check if meeting falls on a specific date (ignoring time).
 */
export function matchesDate(meeting: Meeting, date: Date): boolean {
  const meetingDate = new Date(meeting.created_at);
  return isSameDay(meetingDate, date);
}

/**
 * Check if meeting is within date range (inclusive).
 */
export function matchesDateRange(meeting: Meeting, since?: Date, until?: Date): boolean {
  const meetingDate = new Date(meeting.created_at);

  if (since && meetingDate < startOfDay(since)) {
    return false;
  }
  if (until && meetingDate > endOfDay(until)) {
    return false;
  }

  return true;
}

/**
 * Check if any filters are active.
 */
export function hasActiveFilters(options: FilterOptions): boolean {
  return !!(options.search || options.attendee || options.date || options.since || options.until);
}

/**
 * Apply all filters to a meeting list.
 * All filters are combined with AND logic.
 */
export function applyFilters(meetings: Meeting[], options: FilterOptions): Meeting[] {
  if (!hasActiveFilters(options)) {
    return meetings;
  }

  debug('applying filters: %O', options);
  const startCount = meetings.length;

  const filtered = meetings.filter((meeting) => {
    if (options.search && !matchesSearch(meeting, options.search)) {
      return false;
    }
    if (options.attendee && !matchesAttendee(meeting, options.attendee)) {
      return false;
    }
    if (options.date && !matchesDate(meeting, options.date)) {
      return false;
    }
    if (!matchesDateRange(meeting, options.since, options.until)) {
      return false;
    }
    return true;
  });

  debug('filtered %d -> %d meetings', startCount, filtered.length);
  return filtered;
}
