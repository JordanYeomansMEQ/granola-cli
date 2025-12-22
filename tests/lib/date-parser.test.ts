import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDate, validateDateOption } from '../../src/lib/date-parser.js';

describe('date-parser', () => {
  describe('parseDate', () => {
    beforeEach(() => {
      // Fix the current date to 2024-12-22 for consistent testing
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 11, 22, 12, 0, 0)); // Dec 22, 2024 12:00:00
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('keywords', () => {
      it('should parse "today"', () => {
        const result = parseDate('today');
        expect(result).toEqual(new Date(2024, 11, 22, 0, 0, 0, 0));
      });

      it('should parse "Today" (case-insensitive)', () => {
        const result = parseDate('Today');
        expect(result).toEqual(new Date(2024, 11, 22, 0, 0, 0, 0));
      });

      it('should parse "yesterday"', () => {
        const result = parseDate('yesterday');
        expect(result).toEqual(new Date(2024, 11, 21, 0, 0, 0, 0));
      });

      it('should parse "tomorrow"', () => {
        const result = parseDate('tomorrow');
        expect(result).toEqual(new Date(2024, 11, 23, 0, 0, 0, 0));
      });
    });

    describe('relative dates', () => {
      it('should parse "last week"', () => {
        const result = parseDate('last week');
        expect(result).toEqual(new Date(2024, 11, 15, 0, 0, 0, 0));
      });

      it('should parse "last month"', () => {
        const result = parseDate('last month');
        expect(result).toEqual(new Date(2024, 10, 22, 0, 0, 0, 0)); // Nov 22
      });

      it('should parse "1 day ago"', () => {
        const result = parseDate('1 day ago');
        expect(result).toEqual(new Date(2024, 11, 21, 0, 0, 0, 0));
      });

      it('should parse "3 days ago"', () => {
        const result = parseDate('3 days ago');
        expect(result).toEqual(new Date(2024, 11, 19, 0, 0, 0, 0));
      });

      it('should parse "1 week ago"', () => {
        const result = parseDate('1 week ago');
        expect(result).toEqual(new Date(2024, 11, 15, 0, 0, 0, 0));
      });

      it('should parse "2 weeks ago"', () => {
        const result = parseDate('2 weeks ago');
        expect(result).toEqual(new Date(2024, 11, 8, 0, 0, 0, 0));
      });

      it('should parse "1 month ago"', () => {
        const result = parseDate('1 month ago');
        expect(result).toEqual(new Date(2024, 10, 22, 0, 0, 0, 0)); // Nov 22
      });

      it('should parse "2 months ago"', () => {
        const result = parseDate('2 months ago');
        expect(result).toEqual(new Date(2024, 9, 22, 0, 0, 0, 0)); // Oct 22
      });
    });

    describe('ISO format', () => {
      it('should parse YYYY-MM-DD', () => {
        const result = parseDate('2024-01-15');
        expect(result).toEqual(new Date(2024, 0, 15, 0, 0, 0, 0));
      });

      it('should parse YYYY/MM/DD', () => {
        const result = parseDate('2024/01/15');
        expect(result).toEqual(new Date(2024, 0, 15, 0, 0, 0, 0));
      });

      it('should parse single-digit month and day', () => {
        const result = parseDate('2024-1-5');
        expect(result).toEqual(new Date(2024, 0, 5, 0, 0, 0, 0));
      });
    });

    describe('month-day format', () => {
      it('should parse "Dec 20"', () => {
        const result = parseDate('Dec 20');
        expect(result).toEqual(new Date(2024, 11, 20, 0, 0, 0, 0));
      });

      it('should parse "December 20"', () => {
        const result = parseDate('December 20');
        expect(result).toEqual(new Date(2024, 11, 20, 0, 0, 0, 0));
      });

      it('should parse "Dec 20 2024"', () => {
        const result = parseDate('Dec 20 2024');
        expect(result).toEqual(new Date(2024, 11, 20, 0, 0, 0, 0));
      });

      it('should parse "jan 5"', () => {
        const result = parseDate('jan 5');
        expect(result).toEqual(new Date(2024, 0, 5, 0, 0, 0, 0));
      });
    });

    describe('day-month format', () => {
      it('should parse "20 Dec"', () => {
        const result = parseDate('20 Dec');
        expect(result).toEqual(new Date(2024, 11, 20, 0, 0, 0, 0));
      });

      it('should parse "20 December 2024"', () => {
        const result = parseDate('20 December 2024');
        expect(result).toEqual(new Date(2024, 11, 20, 0, 0, 0, 0));
      });

      it('should parse "5 jan"', () => {
        const result = parseDate('5 jan');
        expect(result).toEqual(new Date(2024, 0, 5, 0, 0, 0, 0));
      });
    });

    describe('invalid input', () => {
      it('should return null for invalid input', () => {
        expect(parseDate('invalid')).toBeNull();
        expect(parseDate('not a date')).toBeNull();
        expect(parseDate('')).toBeNull();
      });

      it('should return null for unsupported formats', () => {
        expect(parseDate('12/25/2024')).toBeNull(); // MM/DD/YYYY not supported
        expect(parseDate('next week')).toBeNull(); // future relative not supported
      });
    });
  });

  describe('validateDateOption', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 11, 22, 12, 0, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return Date for valid input', () => {
      const result = validateDateOption('today', '--date');
      expect(result).toEqual(new Date(2024, 11, 22, 0, 0, 0, 0));
    });

    it('should throw descriptive error for invalid input', () => {
      expect(() => validateDateOption('invalid', '--date')).toThrow(
        /Invalid date for --date: "invalid"/,
      );
    });

    it('should include format examples in error message', () => {
      expect(() => validateDateOption('bad', '--since')).toThrow(/today, yesterday, last week/);
    });
  });
});
