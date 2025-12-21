import chalk from 'chalk';
import { Command } from 'commander';
import { deleteCredentials } from '../../lib/auth.js';
import { createGranolaDebug } from '../../lib/debug.js';

const debug = createGranolaDebug('cmd:auth:logout');

/**
 * Creates the 'logout' command for removing stored credentials.
 *
 * Deletes authentication credentials from the system keychain.
 *
 * @returns Commander command instance
 */
export function createLogoutCommand() {
  return new Command('logout').description('Logout from Granola').action(async () => {
    debug('logout command invoked');
    try {
      await deleteCredentials();
      debug('logout successful');
      console.log(chalk.green('Logged out successfully'));
    } catch (error) {
      debug('logout failed: %O', error);
      console.error(chalk.red('Error:'), 'Failed to logout.');
      if (error instanceof Error) {
        console.error(chalk.dim(error.message));
      }
      process.exit(1);
    }
  });
}

export const logoutCommand = createLogoutCommand();
