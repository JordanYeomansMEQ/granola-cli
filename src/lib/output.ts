import { encode as toonEncode } from '@toon-format/toon';
import chalk from 'chalk';
import Table from 'cli-table3';
import { stringify as yamlStringify } from 'yaml';
import { createGranolaDebug } from './debug.js';

const debug = createGranolaDebug('lib:output');

export type OutputFormat = 'json' | 'yaml' | 'toon';

/**
 * Formats data in the specified output format.
 *
 * @param data - The data to format
 * @param format - Output format: 'json', 'yaml', or 'toon'
 * @returns Formatted string
 */
export function formatOutput(data: unknown, format: OutputFormat): string {
  debug('formatOutput: format=%s, dataType=%s', format, typeof data);
  switch (format) {
    case 'yaml':
      return yamlStringify(data);
    case 'toon':
      return toonEncode(data);
    default:
      return JSON.stringify(data, null, 2);
  }
}

interface Column<T> {
  key: keyof T;
  header: string;
  width?: number;
  format?: (value: unknown) => string;
}

export function table<T extends object>(data: T[], columns: Column<T>[]): string {
  debug('table: rendering %d rows, %d columns', data.length, columns.length);
  const colWidths = columns.map((c) => c.width ?? null);
  const t = new Table({
    head: columns.map((c) => chalk.bold(c.header)),
    colWidths,
    style: { head: [], border: [] },
    chars: {
      top: '',
      'top-mid': '',
      'top-left': '',
      'top-right': '',
      bottom: '',
      'bottom-mid': '',
      'bottom-left': '',
      'bottom-right': '',
      left: '',
      'left-mid': '',
      mid: '',
      'mid-mid': '',
      right: '',
      'right-mid': '',
      middle: '  ',
    },
  });

  for (const row of data) {
    t.push(
      columns.map((c) => {
        const val = row[c.key];
        return c.format ? c.format(val) : String(val ?? '');
      }),
    );
  }

  return t.toString();
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDuration(start: string, end: string): string {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return '--';
  }
  const ms = endMs - startMs;
  if (!Number.isFinite(ms) || ms < 0) {
    return '--';
  }
  const mins = Math.round(ms / 60000);
  return `${mins} min`;
}

export function truncate(s: string, len: number): string {
  if (s.length <= len) return s;
  return `${s.slice(0, len - 1)}…`;
}
