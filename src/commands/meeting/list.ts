import chalk from 'chalk';
import { Command } from 'commander';
import { getConfigValue } from '../../lib/config.js';
import { validateDateOption } from '../../lib/date-parser.js';
import { createGranolaDebug } from '../../lib/debug.js';
import { formatDate, formatOutput, type OutputFormat, table, truncate } from '../../lib/output.js';
import * as meetings from '../../services/meetings.js';

const debug = createGranolaDebug('cmd:meeting:list');

/**
 * Creates the 'list' command for displaying meetings.
 *
 * Lists meetings with optional filtering by workspace, folder, title search,
 * attendee, and date range. Supports pagination via --limit and -o/--output
 * for structured formats.
 *
 * @returns Commander command instance
 */
export function createListCommand() {
  return new Command('list')
    .description('List meetings')
    .option('-l, --limit <n>', 'Number of meetings', '20')
    .option('-w, --workspace <id>', 'Filter by workspace')
    .option('-f, --folder <id>', 'Filter by folder')
    .option('-s, --search <query>', 'Search in meeting titles')
    .option('-a, --attendee <name>', 'Filter by attendee name or email')
    .option('-d, --date <date>', 'Filter meetings on a specific date')
    .option('--since <date>', 'Filter meetings from date (inclusive)')
    .option('--until <date>', 'Filter meetings up to date (inclusive)')
    .option('-o, --output <format>', 'Output format (json, yaml, toon)')
    .action(async (opts) => {
      debug('list command invoked with opts: %O', opts);

      const limit = Number.parseInt(opts.limit, 10);
      if (!Number.isFinite(limit) || limit < 1) {
        console.error(chalk.red('Invalid --limit value. Please provide a positive number.'));
        process.exit(1);
      }

      const configuredWorkspace = getConfigValue('default_workspace');
      const workspace = opts.workspace ?? configuredWorkspace;

      // Parse date options
      let date: Date | undefined;
      let since: Date | undefined;
      let until: Date | undefined;

      try {
        if (opts.date) {
          date = validateDateOption(opts.date, '--date');
        }
        if (opts.since) {
          since = validateDateOption(opts.since, '--since');
        }
        if (opts.until) {
          until = validateDateOption(opts.until, '--until');
        }
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }

      // Validate date range
      if (since && until && since > until) {
        console.error(chalk.red('--since date must be before --until date'));
        process.exit(1);
      }

      const data = await meetings.list({
        limit,
        workspace,
        folder: opts.folder,
        search: opts.search,
        attendee: opts.attendee,
        date,
        since,
        until,
      });
      debug('fetched %d meetings', data.length);

      // Handle structured output formats
      const format = opts.output || null;
      debug('output format: %s', format || 'table');
      if (format) {
        if (!['json', 'yaml', 'toon'].includes(format)) {
          console.error(chalk.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
          process.exit(1);
        }
        console.log(formatOutput(data, format as OutputFormat));
        return;
      }

      if (data.length === 0) {
        console.log(chalk.dim('No meetings found.'));
        return;
      }

      console.log(chalk.dim(`Showing ${data.length} meetings\n`));

      const output = table(data, [
        { key: 'id', header: 'ID', width: 12, format: (v) => String(v).slice(0, 8) },
        { key: 'title', header: 'TITLE', width: 36, format: (v) => truncate(String(v), 35) },
        { key: 'created_at', header: 'DATE', width: 14, format: (v) => formatDate(String(v)) },
      ]);

      console.log(output);
    });
}

export const listCommand = createListCommand();
