import chalk from 'chalk';
import { ApiError } from './http.js';

/**
 * Handles global errors from CLI execution.
 * Returns the appropriate exit code.
 */
export function handleGlobalError(error: unknown): number {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      console.error(chalk.red('Error:'), 'Authentication required.');
      console.error(`Run ${chalk.cyan('granola auth login')} to authenticate.`);
      return 2;
    }
    console.error(chalk.red('Error:'), error.message);
    return 1;
  }

  if (error instanceof Error && error.message.includes('fetch failed')) {
    console.error(chalk.red('Error:'), 'Network error. Check your connection.');
    return 1;
  }

  if (error instanceof Error) {
    console.error(chalk.red('Error:'), error.message || 'An unexpected error occurred.');
  } else {
    console.error(chalk.red('Error:'), 'An unexpected error occurred.');
  }
  return 1;
}
