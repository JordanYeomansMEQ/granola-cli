import createDebug from 'debug';

/**
 * Creates a namespaced debug logger for granola-cli.
 *
 * @param namespace - The namespace suffix (e.g., 'lib:auth', 'service:client')
 * @returns A debug logger function
 *
 * @example
 * const debug = createGranolaDebug('lib:auth');
 * debug('loading credentials');  // [granola:lib:auth] loading credentials
 */
export function createGranolaDebug(namespace: string) {
  return createDebug(`granola:${namespace}`);
}

/**
 * Safely formats sensitive data for debug output.
 * Masks tokens and credentials while keeping them identifiable.
 *
 * @param token - The token to mask
 * @returns Masked token showing only first/last 4 characters
 *
 * @example
 * maskToken('abc123xyz789longtoken')  // 'abc1...oken'
 */
export function maskToken(token: string): string {
  if (!token || token.length < 12) return '[REDACTED]';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
