import chalk from 'chalk';
import { Command } from 'commander';
import { deleteAlias, getAlias, listAliases, setAlias } from '../lib/config.js';
import { createGranolaDebug } from '../lib/debug.js';
import { formatOutput, type OutputFormat } from '../lib/output.js';

const debug = createGranolaDebug('cmd:alias');

/**
 * Creates the 'alias' command for managing command shortcuts.
 *
 * Provides subcommands for listing, creating, and deleting aliases.
 * Aliases expand to full commands at runtime.
 *
 * @returns Commander command instance
 */
export function createAliasCommand() {
  const cmd = new Command('alias').description('Create command shortcuts');

  cmd
    .command('list')
    .description('List aliases')
    .option('-o, --output <format>', 'Output format (json, yaml, toon)')
    .action((opts) => {
      debug('alias list command invoked');
      const aliases = listAliases();

      const format = opts.output || null;
      if (format) {
        if (!['json', 'yaml', 'toon'].includes(format)) {
          console.error(chalk.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
          process.exit(1);
        }
        console.log(formatOutput(aliases, format as OutputFormat));
        return;
      }

      if (Object.keys(aliases).length === 0) {
        console.log(chalk.dim('No aliases defined.'));
        return;
      }

      for (const [name, command] of Object.entries(aliases)) {
        console.log(`${chalk.bold(name)}: ${command}`);
      }
    });

  cmd
    .command('set <name> <command>')
    .description('Create alias')
    .action((name: string, command: string) => {
      debug('alias set command invoked: %s -> %s', name, command);
      setAlias(name, command);
      console.log(chalk.green(`Created alias: ${name} -> ${command}`));
    });

  cmd
    .command('delete <name>')
    .description('Delete alias')
    .action((name: string) => {
      debug('alias delete command invoked: %s', name);
      const existing = getAlias(name);
      if (!existing) {
        console.log(chalk.yellow(`Alias '${name}' not found`));
        return;
      }
      deleteAlias(name);
      console.log(chalk.green(`Deleted alias: ${name}`));
    });

  return cmd;
}

export const aliasCommand = createAliasCommand();
