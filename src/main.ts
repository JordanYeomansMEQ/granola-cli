import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';
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

const debug = createGranolaDebug('cli');
const debugAlias = createGranolaDebug('cli:alias');
const debugSubcmd = createGranolaDebug('cli:subcommand');

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

/**
 * Discovers external subcommands matching the pattern `granola-*` in PATH.
 *
 * Works like git's external subcommand system - any executable named
 * `granola-<name>` becomes available as `granola <name>`.
 *
 * @returns Map of subcommand names to their executable paths
 */
function discoverExternalSubcommands(): Map<string, string> {
  const subcommands = new Map<string, string>();
  const pathDirs = (process.env.PATH || '').split(delimiter);
  debugSubcmd('scanning PATH directories: %d dirs', pathDirs.length);

  for (const dir of pathDirs) {
    if (!existsSync(dir)) continue;

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (!entry.startsWith('granola-')) continue;

        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          // Check if it's executable (for Unix, check mode; for Windows, just existence)
          if (stat.isFile()) {
            const subcommandName = entry.replace(/^granola-/, '').replace(/\.(exe|cmd|bat)$/i, '');
            if (!subcommands.has(subcommandName)) {
              debugSubcmd('found external subcommand: %s at %s', subcommandName, fullPath);
              subcommands.set(subcommandName, fullPath);
            }
          }
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  debugSubcmd('discovered %d external subcommands', subcommands.size);
  return subcommands;
}

// Register external subcommands discovered in PATH
const externalSubcommands = discoverExternalSubcommands();
for (const [name, execPath] of externalSubcommands) {
  // Skip if there's already a built-in command with this name
  if (program.commands.some((cmd) => cmd.name() === name)) continue;

  const externalCmd = new Command(name)
    .description(`[external] ${name}`)
    .allowUnknownOption()
    .allowExcessArguments()
    .action((...args) => {
      // Get all arguments after the subcommand name
      const cmdArgs = args.slice(0, -1) as string[];
      debugSubcmd('executing external command: %s with args: %O', execPath, cmdArgs);

      // Spawn the external command
      const child = spawn(execPath, cmdArgs, {
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });

      child.on('close', (code) => {
        debugSubcmd('external command exited with code: %d', code);
        process.exit(code ?? 0);
      });

      child.on('error', (err) => {
        debugSubcmd('external command error: %O', err);
        console.error(`Failed to run external command: ${err.message}`);
        process.exit(1);
      });
    });

  program.addCommand(externalCmd);
}

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
program.parseAsync(expandedArgs);
