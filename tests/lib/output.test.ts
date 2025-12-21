import { describe, expect, it } from 'vitest';
import { formatDate, formatDuration, formatOutput, table, truncate } from '../../src/lib/output.js';

describe('output', () => {
  describe('formatOutput', () => {
    it('should format data as JSON by default', () => {
      const data = { name: 'test', value: 42 };
      const result = formatOutput(data, 'json');
      expect(JSON.parse(result)).toEqual(data);
    });

    it('should format data as YAML', () => {
      const data = { name: 'test', value: 42 };
      const result = formatOutput(data, 'yaml');
      expect(result).toContain('name: test');
      expect(result).toContain('value: 42');
    });

    it('should format data as Toon', () => {
      const data = { name: 'test', value: 42 };
      const result = formatOutput(data, 'toon');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('table', () => {
    it('should create a table with headers and data', () => {
      const data = [
        { id: '123', name: 'Test', value: 42 },
        { id: '456', name: 'Another', value: 100 },
      ];

      const result = table(data, [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'NAME' },
        { key: 'value', header: 'VALUE' },
      ]);

      expect(result).toContain('ID');
      expect(result).toContain('NAME');
      expect(result).toContain('VALUE');
      expect(result).toContain('123');
      expect(result).toContain('Test');
      expect(result).toContain('42');
      expect(result).toContain('456');
      expect(result).toContain('Another');
      expect(result).toContain('100');
    });

    it('should apply custom format functions', () => {
      const data = [{ date: '2025-12-18T14:00:00Z' }];

      const result = table(data, [
        {
          key: 'date',
          header: 'DATE',
          format: (v) => new Date(v as string).getFullYear().toString(),
        },
      ]);

      expect(result).toContain('2025');
    });

    it('should handle empty data array', () => {
      const result = table([], [{ key: 'id', header: 'ID' }]);
      expect(result).toContain('ID');
    });

    it('should handle null/undefined values', () => {
      const data = [{ id: null, name: undefined }];

      const result = table(data as unknown as Array<Record<string, unknown>>, [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'NAME' },
      ]);

      expect(result).toBeDefined();
    });

    it('should respect column widths', () => {
      const data = [{ id: 'a-very-long-id-that-might-need-truncation' }];

      const result = table(data, [{ key: 'id', header: 'ID', width: 20 }]);

      expect(result).toBeDefined();
    });
  });

  describe('formatDate', () => {
    it('should format ISO date to human-readable format', () => {
      const result = formatDate('2025-12-18T14:00:00Z');
      expect(result).toMatch(/Dec 18, 2025/);
    });

    it('should handle different timezones', () => {
      const result = formatDate('2025-01-01T00:00:00Z');
      expect(result).toMatch(/2025/);
      expect(result).toMatch(/Jan/);
    });

    it('should handle date-only strings', () => {
      const result = formatDate('2025-06-15');
      expect(result).toMatch(/Jun/);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2025/);
    });
  });

  describe('formatDuration', () => {
    it('should calculate duration in minutes', () => {
      const start = '2025-12-18T14:00:00Z';
      const end = '2025-12-18T14:47:00Z';

      const result = formatDuration(start, end);
      expect(result).toBe('47 min');
    });

    it('should round to nearest minute', () => {
      const start = '2025-12-18T14:00:00Z';
      const end = '2025-12-18T14:30:30Z';

      const result = formatDuration(start, end);
      expect(result).toBe('31 min');
    });

    it('should handle short durations', () => {
      const start = '2025-12-18T14:00:00Z';
      const end = '2025-12-18T14:01:00Z';

      const result = formatDuration(start, end);
      expect(result).toBe('1 min');
    });

    it('should handle long durations', () => {
      const start = '2025-12-18T14:00:00Z';
      const end = '2025-12-18T16:30:00Z';

      const result = formatDuration(start, end);
      expect(result).toBe('150 min');
    });

    it('should return fallback for invalid dates', () => {
      expect(formatDuration('not-a-date', 'still-not-a-date')).toBe('--');
    });

    it('should return fallback when end precedes start', () => {
      const start = '2025-12-18T14:00:00Z';
      const end = '2025-12-18T13:00:00Z';
      expect(formatDuration(start, end)).toBe('--');
    });
  });

  describe('truncate', () => {
    it('should not truncate strings shorter than limit', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('should truncate strings longer than limit with ellipsis', () => {
      expect(truncate('Hello World', 8)).toBe('Hello W…');
    });

    it('should handle exact length strings', () => {
      expect(truncate('Hello', 5)).toBe('Hello');
    });

    it('should handle empty strings', () => {
      expect(truncate('', 10)).toBe('');
    });

    it('should handle single character limit', () => {
      expect(truncate('Hello', 1)).toBe('…');
    });

    it('should handle limit of 2', () => {
      expect(truncate('Hello', 2)).toBe('H…');
    });
  });
});
