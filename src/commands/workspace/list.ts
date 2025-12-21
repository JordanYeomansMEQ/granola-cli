import chalk from 'chalk';
import { Command } from 'commander';
import { createGranolaDebug } from '../../lib/debug.js';
import { formatDate, formatOutput, type OutputFormat, table } from '../../lib/output.js';
import * as workspaces from '../../services/workspaces.js';

const debug = createGranolaDebug('cmd:workspace:list');

/**
 * Creates the 'list' command for displaying workspaces.
 *
 * Lists all workspaces the user has access to.
 * Supports -o/--output for structured output.
 *
 * @returns Commander command instance
 */
export function createListCommand() {
  return new Command('list')
    .description('List workspaces')
    .option('-o, --output <format>', 'Output format (json, yaml, toon)')
    .action(async (opts) => {
      debug('workspace list command invoked');

      const data = await workspaces.list();
      debug('fetched %d workspaces', data.length);

      // Handle structured output formats
      const format = opts.output || null;
      if (format) {
        if (!['json', 'yaml', 'toon'].includes(format)) {
          console.error(chalk.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
          process.exit(1);
        }
        console.log(formatOutput(data, format as OutputFormat));
        return;
      }

      if (data.length === 0) {
        console.log(chalk.dim('No workspaces found.'));
        return;
      }

      const output = table(data, [
        { key: 'id', header: 'ID', width: 12, format: (v) => String(v).slice(0, 8) },
        { key: 'name', header: 'NAME', width: 20 },
        { key: 'created_at', header: 'CREATED', width: 14, format: (v) => formatDate(String(v)) },
      ]);

      console.log(output);
    });
}

export const listCommand = createListCommand();
