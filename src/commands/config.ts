import chalk from 'chalk';
import { Command } from 'commander';
import { getConfig, getConfigValue, resetConfig, setConfigValue } from '../lib/config.js';
import { createGranolaDebug } from '../lib/debug.js';
import { formatOutput, type OutputFormat } from '../lib/output.js';
import type { Config } from '../types.js';

const debug = createGranolaDebug('cmd:config');

type ConfigKey = keyof Config;
const CONFIG_VALUE_PARSERS: Record<ConfigKey, (value: string) => Config[ConfigKey]> = {
  default_workspace: (value: string) => value,
  pager: (value: string) => value,
  aliases: (value: string) => {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Aliases must be a JSON object of { "name": "command" } pairs.');
      }
      for (const [alias, command] of Object.entries(parsed)) {
        if (typeof command !== 'string') {
          throw new Error(`Alias "${alias}" must map to a string command.`);
        }
      }
      return parsed as Record<string, string>;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Aliases must be valid JSON (example: {"meetings":"meeting list"}).');
      }
      throw error;
    }
  },
};

const CONFIG_KEYS = Object.keys(CONFIG_VALUE_PARSERS) as ConfigKey[];

function isConfigKey(key: string): key is ConfigKey {
  return CONFIG_KEYS.includes(key as ConfigKey);
}

/**
 * Creates the 'config' command for managing CLI configuration.
 *
 * Provides subcommands for listing, getting, setting, and resetting
 * configuration values (e.g., default workspace, pager settings).
 *
 * @returns Commander command instance
 */
export function createConfigCommand() {
  const cmd = new Command('config').description('Manage CLI configuration');

  cmd
    .command('list')
    .description('View current config')
    .option('-o, --output <format>', 'Output format (json, yaml, toon)')
    .action((opts) => {
      debug('config list command invoked');
      const config = getConfig();

      const format = opts.output || null;
      if (format) {
        if (!['json', 'yaml', 'toon'].includes(format)) {
          console.error(chalk.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
          process.exit(1);
        }
        console.log(formatOutput(config, format as OutputFormat));
        return;
      }

      if (Object.keys(config).length === 0) {
        console.log(chalk.dim('No configuration set.'));
        return;
      }

      for (const [key, value] of Object.entries(config)) {
        if (typeof value === 'object') {
          console.log(`${chalk.bold(key)}:`);
          for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            console.log(`  ${k}: ${v}`);
          }
        } else {
          console.log(`${chalk.bold(key)}: ${value}`);
        }
      }
    });

  cmd
    .command('get <key>')
    .description('Get a config value')
    .option('-o, --output <format>', 'Output format (json, yaml, toon)')
    .action((key: string, opts) => {
      debug('config get command invoked with key: %s', key);
      const value = getConfigValue(key as keyof ReturnType<typeof getConfig>);

      const format = opts.output || null;
      if (format) {
        if (!['json', 'yaml', 'toon'].includes(format)) {
          console.error(chalk.red(`Invalid format: ${format}. Use 'json', 'yaml', or 'toon'.`));
          process.exit(1);
        }
        console.log(formatOutput({ [key]: value }, format as OutputFormat));
        return;
      }

      if (value === undefined) {
        console.log(chalk.dim('(not set)'));
      } else {
        console.log(value);
      }
    });

  cmd
    .command('set <key> <value>')
    .description('Set a config value')
    .action((key: string, value: string) => {
      debug('config set command invoked: %s = %s', key, value);
      if (!isConfigKey(key)) {
        console.error(
          chalk.red(
            `Invalid config key: ${key}. Allowed keys: ${CONFIG_KEYS.map((k) => `'${k}'`).join(', ')}.`,
          ),
        );
        process.exit(1);
      }

      const parser = CONFIG_VALUE_PARSERS[key];
      let parsedValue: Config[typeof key];
      try {
        parsedValue = parser(value) as Config[typeof key];
      } catch (error) {
        console.error(chalk.red('Invalid value for config key:'), key);
        if (error instanceof Error) {
          console.error(chalk.dim(error.message));
        }
        process.exit(1);
      }

      setConfigValue(key, parsedValue);
      console.log(chalk.green(`Set ${key} = ${value}`));
    });

  cmd
    .command('reset')
    .description('Reset to defaults')
    .action(() => {
      debug('config reset command invoked');
      resetConfig();
      console.log(chalk.green('Configuration reset'));
    });

  return cmd;
}

export const configCommand = createConfigCommand();
