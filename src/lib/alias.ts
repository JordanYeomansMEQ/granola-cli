import { parse as parseShellQuote } from 'shell-quote';

const UNSAFE_ALIAS_PATTERN = /[`$]/;

/**
 * Parses an alias command using shell-quote while ensuring only literal arguments are present.
 *
 * @param command Alias command string defined by the user.
 * @returns Array of arguments ready to be passed to Commander.
 * @throws If the alias contains shell operators, command separators, or is empty.
 */
export function parseAliasArguments(command: string): string[] {
  const parsed = parseShellQuote(command);
  if (parsed.length === 0) {
    throw new Error('Alias command cannot be empty.');
  }

  const hasUnsafeToken = parsed.some((token) => typeof token !== 'string');
  if (hasUnsafeToken) {
    throw new Error('Alias command contains unsupported shell syntax.');
  }

  const args = parsed as string[];
  const hasSubstitution = args.some((token) => UNSAFE_ALIAS_PATTERN.test(token));
  if (hasSubstitution) {
    throw new Error('Alias command contains unsupported substitution syntax.');
  }

  return args;
}

/**
 * Validates that an alias command only contains literal arguments.
 *
 * @param command Alias command string defined by the user.
 * @returns True when the alias contains no shell operators or expansions.
 */
export function isAliasCommandSafe(command: string): boolean {
  try {
    parseAliasArguments(command);
    return true;
  } catch {
    return false;
  }
}
