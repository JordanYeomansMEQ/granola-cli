import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  hasActiveFilters,
  matchesAttendee,
  matchesDate,
  matchesDateRange,
  matchesSearch,
} from '../../src/lib/filters.js';
import type { Meeting } from '../../src/types.js';

function createMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'test-id',
    title: 'Test Meeting',
    created_at: '2024-12-20T10:00:00Z',
    updated_at: '2024-12-20T11:00:00Z',
    ...overrides,
  };
}

describe('filters', () => {
  describe('matchesSearch', () => {
    it('should match case-insensitively', () => {
      const meeting = createMeeting({ title: 'Daily Standup' });
      expect(matchesSearch(meeting, 'standup')).toBe(true);
      expect(matchesSearch(meeting, 'STANDUP')).toBe(true);
      expect(matchesSearch(meeting, 'Standup')).toBe(true);
    });

    it('should match partial titles', () => {
      const meeting = createMeeting({ title: 'Q4 Planning Review' });
      expect(matchesSearch(meeting, 'planning')).toBe(true);
      expect(matchesSearch(meeting, 'Q4')).toBe(true);
      expect(matchesSearch(meeting, 'review')).toBe(true);
    });

    it('should return false for non-matching titles', () => {
      const meeting = createMeeting({ title: 'Team Standup' });
      expect(matchesSearch(meeting, 'planning')).toBe(false);
      expect(matchesSearch(meeting, 'review')).toBe(false);
    });
  });

  describe('matchesAttendee', () => {
    it('should match by partial name in people.attendees', () => {
      const meeting = createMeeting({
        people: {
          attendees: [{ name: 'John Smith', email: 'john@example.com' }],
        },
      });
      expect(matchesAttendee(meeting, 'john')).toBe(true);
      expect(matchesAttendee(meeting, 'smith')).toBe(true);
      expect(matchesAttendee(meeting, 'John Smith')).toBe(true);
    });

    it('should match by partial email', () => {
      const meeting = createMeeting({
        people: {
          attendees: [{ name: 'John', email: 'john.smith@example.com' }],
        },
      });
      expect(matchesAttendee(meeting, 'john.smith')).toBe(true);
      expect(matchesAttendee(meeting, '@example.com')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const meeting = createMeeting({
        people: {
          attendees: [{ name: 'John Smith', email: 'john@example.com' }],
        },
      });
      expect(matchesAttendee(meeting, 'JOHN')).toBe(true);
      expect(matchesAttendee(meeting, 'JOHN@EXAMPLE.COM')).toBe(true);
    });

    it('should check top-level attendees', () => {
      const meeting = createMeeting({
        attendees: [{ name: 'Jane Doe', email: 'jane@example.com' }],
      });
      expect(matchesAttendee(meeting, 'jane')).toBe(true);
      expect(matchesAttendee(meeting, 'doe')).toBe(true);
    });

    it('should check both people.attendees and top-level attendees', () => {
      const meeting = createMeeting({
        people: {
          attendees: [{ name: 'John Smith', email: 'john@example.com' }],
        },
        attendees: [{ name: 'Jane Doe', email: 'jane@example.com' }],
      });
      expect(matchesAttendee(meeting, 'john')).toBe(true);
      expect(matchesAttendee(meeting, 'jane')).toBe(true);
    });

    it('should return false when no attendees', () => {
      const meeting = createMeeting();
      expect(matchesAttendee(meeting, 'john')).toBe(false);
    });

    it('should return false for non-matching attendee', () => {
      const meeting = createMeeting({
        people: {
          attendees: [{ name: 'John Smith', email: 'john@example.com' }],
        },
      });
      expect(matchesAttendee(meeting, 'bob')).toBe(false);
      expect(matchesAttendee(meeting, 'partner.com')).toBe(false);
    });
  });

  describe('matchesDate', () => {
    it('should match same day regardless of time', () => {
      const meeting = createMeeting({ created_at: '2024-12-20T10:30:00Z' });
      const date = new Date(2024, 11, 20, 0, 0, 0); // Dec 20, 2024 00:00
      expect(matchesDate(meeting, date)).toBe(true);
    });

    it('should not match different days', () => {
      const meeting = createMeeting({ created_at: '2024-12-20T10:00:00Z' });
      const date = new Date(2024, 11, 21, 0, 0, 0); // Dec 21
      expect(matchesDate(meeting, date)).toBe(false);
    });
  });

  describe('matchesDateRange', () => {
    it('should include meetings on since date', () => {
      const meeting = createMeeting({ created_at: '2024-12-20T12:00:00Z' });
      const since = new Date(2024, 11, 20, 12, 0, 0); // Same day, noon
      expect(matchesDateRange(meeting, since, undefined)).toBe(true);
    });

    it('should include meetings on until date', () => {
      const meeting = createMeeting({ created_at: '2024-12-20T12:00:00Z' });
      const until = new Date(2024, 11, 20, 12, 0, 0); // Same day, noon
      expect(matchesDateRange(meeting, undefined, until)).toBe(true);
    });

    it('should exclude meetings before since', () => {
      // Meeting is 2 days before since date - clearly excluded
      const meeting = createMeeting({ created_at: '2024-12-18T12:00:00Z' });
      const since = new Date(2024, 11, 20, 12, 0, 0);
      expect(matchesDateRange(meeting, since, undefined)).toBe(false);
    });

    it('should exclude meetings after until', () => {
      // Meeting is 2 days after until date - clearly excluded
      const meeting = createMeeting({ created_at: '2024-12-22T12:00:00Z' });
      const until = new Date(2024, 11, 20, 12, 0, 0);
      expect(matchesDateRange(meeting, undefined, until)).toBe(false);
    });

    it('should handle only since provided', () => {
      const meeting = createMeeting({ created_at: '2024-12-25T12:00:00Z' });
      const since = new Date(2024, 11, 20, 12, 0, 0);
      expect(matchesDateRange(meeting, since, undefined)).toBe(true);
    });

    it('should handle only until provided', () => {
      const meeting = createMeeting({ created_at: '2024-12-15T12:00:00Z' });
      const until = new Date(2024, 11, 20, 12, 0, 0);
      expect(matchesDateRange(meeting, undefined, until)).toBe(true);
    });

    it('should return true when no range specified', () => {
      const meeting = createMeeting();
      expect(matchesDateRange(meeting, undefined, undefined)).toBe(true);
    });
  });

  describe('hasActiveFilters', () => {
    it('should return false for empty options', () => {
      expect(hasActiveFilters({})).toBe(false);
    });

    it('should return true when search is set', () => {
      expect(hasActiveFilters({ search: 'test' })).toBe(true);
    });

    it('should return true when attendee is set', () => {
      expect(hasActiveFilters({ attendee: 'john' })).toBe(true);
    });

    it('should return true when date is set', () => {
      expect(hasActiveFilters({ date: new Date() })).toBe(true);
    });

    it('should return true when since is set', () => {
      expect(hasActiveFilters({ since: new Date() })).toBe(true);
    });

    it('should return true when until is set', () => {
      expect(hasActiveFilters({ until: new Date() })).toBe(true);
    });
  });

  describe('applyFilters', () => {
    const meetings: Meeting[] = [
      createMeeting({
        id: '1',
        title: 'Daily Standup',
        created_at: '2024-12-20T10:00:00Z',
        people: { attendees: [{ name: 'John', email: 'john@example.com' }] },
      }),
      createMeeting({
        id: '2',
        title: 'Q4 Planning',
        created_at: '2024-12-19T14:00:00Z',
        people: { attendees: [{ name: 'Jane', email: 'jane@example.com' }] },
      }),
      createMeeting({
        id: '3',
        title: 'Team Standup',
        created_at: '2024-12-18T09:00:00Z',
        people: {
          attendees: [
            { name: 'John', email: 'john@example.com' },
            { name: 'Jane', email: 'jane@example.com' },
          ],
        },
      }),
    ];

    it('should return all when no filters', () => {
      const result = applyFilters(meetings, {});
      expect(result).toHaveLength(3);
    });

    it('should filter by search', () => {
      const result = applyFilters(meetings, { search: 'standup' });
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['1', '3']);
    });

    it('should filter by attendee', () => {
      const result = applyFilters(meetings, { attendee: 'john' });
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['1', '3']);
    });

    it('should filter by date', () => {
      const result = applyFilters(meetings, { date: new Date(2024, 11, 20) });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter by date range', () => {
      const result = applyFilters(meetings, {
        since: new Date(2024, 11, 19),
        until: new Date(2024, 11, 20),
      });
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['1', '2']);
    });

    it('should apply multiple filters together (AND logic)', () => {
      const result = applyFilters(meetings, {
        search: 'standup',
        attendee: 'john',
      });
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['1', '3']);
    });

    it('should combine search, attendee, and date filters', () => {
      const result = applyFilters(meetings, {
        search: 'standup',
        attendee: 'jane',
        since: new Date(2024, 11, 18),
        until: new Date(2024, 11, 18),
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3');
    });
  });
});
