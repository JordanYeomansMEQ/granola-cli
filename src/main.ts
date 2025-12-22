import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { aliasCommand } from './commands/alias.js';
import { authCommand } from './commands/auth/index.js';
import { configCommand } from './commands/config.js';
import { folderCommand } from './commands/folder/index.js';
import { meetingCommand } from './commands/meeting/index.js';
import { workspaceCommand } from './commands/workspace/index.js';
import { parseAliasArguments } from './lib/alias.js';
import { getAlias } from './lib/config.js';
import { createGranolaDebug } from './lib/debug.js';
import { handleGlobalError } from './lib/errors.js';

const debug = createGranolaDebug('cli');
const debugAlias = createGranolaDebug('cli:alias');

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

debug('granola-cli v%s starting', packageJson.version);
debug('arguments: %O', process.argv.slice(2));

const program = new Command();

program
  .name('granola')
  .description('CLI for Granola meeting notes')
  .version(packageJson.version)
  .option('--no-pager', 'Disable pager');

// Add built-in commands
program.addCommand(authCommand);
program.addCommand(meetingCommand);
program.addCommand(workspaceCommand);
program.addCommand(folderCommand);
program.addCommand(configCommand);
program.addCommand(aliasCommand);

// Handle alias expansion
function expandAlias(args: string[]): string[] {
  if (args.length < 3) return args;

  const command = args[2];
  debugAlias('checking alias for command: %s', command);
  const alias = getAlias(command);

  if (alias) {
    debugAlias('alias found: %s -> %s', command, alias);
    try {
      const aliasArgs = parseAliasArguments(alias);
      const expanded = [...args.slice(0, 2), ...aliasArgs, ...args.slice(3)];
      debugAlias('expanded args: %O', expanded.slice(2));
      return expanded;
    } catch (err) {
      debugAlias('failed to expand alias %s: %O', command, err);
      return args;
    }
  }

  return args;
}

// Parse with alias expansion
const expandedArgs = expandAlias(process.argv);
debug('parsing with args: %O', expandedArgs.slice(2));
program.parseAsync(expandedArgs).catch((error: unknown) => {
  const exitCode = handleGlobalError(error);
  process.exit(exitCode);
});
